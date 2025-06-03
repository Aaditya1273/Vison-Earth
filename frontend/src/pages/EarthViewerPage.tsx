import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Tooltip, IconButton, Slider
} from '@mui/material';
import WeatherMapOptions from '../components/WeatherMapOptions';
import SimpleEarthViewerFallback from './SimpleEarthViewerFallback';
import { getCurrentWeather, CurrentWeather } from '../services/weatherService';

// Define the window interface extension for Cesium global object
declare global {
  interface Window {
    Cesium: any;
    CESIUM_BASE_URL: string;
    CESIUM_LOADED: boolean;
    CESIUM_READY: Promise<any>;
    CESIUM_RESOLVE: (value: any) => void;
    CESIUM_REJECT: (reason?: any) => void;
  }
}

// Cesium Ion access token - using a default token that should work for development
// In production, use environment variables
const CESIUM_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyMjY0NjQ5NH0.XcKpgANiY19MC4bdFUXMVEBToBmBLjssJwHxjN-SGWo';

// Weather layer icons (using emoji for now)
const LAYER_ICONS: Record<string, string> = {
  'Satellite': '🛰️',
  'Live': '✓',
  'HD': '🔍',
  'Radar': '📡',
  'Precipitation': '🌧️',
  'Wind': '💨',
  'Temperature': '🌡️',
  'Humidity': '💧',
  'Pressure': '⭕',
};

const EarthViewerPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState('Satellite');
  const [weatherData, setWeatherData] = useState<CurrentWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number, name: string} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const weatherEntityRef = useRef<any>(null);
  
  // Check if Cesium is loaded
  const isCesiumLoaded = () => {
    return typeof window !== 'undefined' && window.Cesium !== undefined;
  };
  
  // Function to wait for Cesium to be loaded
  const waitForCesium = async () => {
    if (isCesiumLoaded()) {
      console.log('Cesium is already loaded');
      return true;
    }
    
    try {
      // If CESIUM_READY promise exists, use it
      if (window.CESIUM_READY) {
        console.log('Waiting for CESIUM_READY promise...');
        await window.CESIUM_READY;
        console.log('CESIUM_READY promise resolved');
        return true;
      } else {
        // Fallback polling mechanism if CESIUM_READY is not defined
        console.log('CESIUM_READY not defined, using polling fallback');
        return new Promise<boolean>((resolve) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds total
          
          const checkInterval = setInterval(() => {
            attempts++;
            if (isCesiumLoaded()) {
              console.log(`Cesium loaded after ${attempts} attempts`);
              clearInterval(checkInterval);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              console.error(`Failed to load Cesium after ${attempts} attempts`);
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 100);
        });
      }
    } catch (error) {
      console.error('Error waiting for Cesium:', error);
      return false;
    }
  };
  
  // Function to check if WebGL is supported
  const isWebGLSupported = () => {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  };
  
  // Function to fetch weather data for a specific location
  const fetchWeatherData = async (lat: number, lon: number, locationName: string = 'Selected Location') => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);
      const data = await getCurrentWeather(lat, lon);
      if (data) {
        setWeatherData(data);
        
        // Add a marker for the weather location
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          addWeatherMarker(lat, lon, data);
        }
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setWeatherError('Failed to fetch weather data');
    } finally {
      setWeatherLoading(false);
    }
  };
  
  // Function to add a weather marker to the map
  const addWeatherMarker = (lat: number, lon: number, weather: CurrentWeather) => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    
    const viewer = viewerRef.current;
    
    // Remove existing weather entity if any
    if (weatherEntityRef.current) {
      viewer.entities.remove(weatherEntityRef.current);
    }
    
    // Create a custom pin with weather info
    const pinBuilder = new window.Cesium.PinBuilder();
    
    // Get weather icon
    const weatherIconUrl = getWeatherIconUrl(weather.weathercode);
    
    // Create a pin with the weather icon
    const weatherPin = pinBuilder.fromUrl(weatherIconUrl, window.Cesium.Color.WHITE, 48);
    
    // Add the entity to the viewer
    weatherEntityRef.current = viewer.entities.add({
      name: `Weather at ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      position: window.Cesium.Cartesian3.fromDegrees(lon, lat),
      billboard: {
        image: weatherPin,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: `${weather.temperature}°C\nWind: ${weather.windspeed} km/h`,
        font: '14px sans-serif',
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.TOP,
        pixelOffset: new window.Cesium.Cartesian2(0, -50),
        heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });
  };
  
  // Helper function to get weather icon URL based on weather code
  const getWeatherIconUrl = (code: number): string => {
    // Map weather codes to icon URLs
    // This is a simplified version - in a real app, you'd have a more complete mapping
    if (code < 300) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/386.png'; // Thunderstorm
    } else if (code < 500) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/263.png'; // Drizzle
    } else if (code < 600) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/308.png'; // Rain
    } else if (code < 700) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/338.png'; // Snow
    } else if (code < 800) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/248.png'; // Atmosphere (fog, mist)
    } else if (code === 800) {
      return 'https://cdn.weatherapi.com/weather/64x64/day/113.png'; // Clear
    } else {
      return 'https://cdn.weatherapi.com/weather/64x64/day/116.png'; // Clouds
    }
  };
  
  // Function to switch between different imagery layers
  const switchLayer = (layerName: string) => {
    try {
      const viewer = viewerRef.current;
      if (!viewer) {
        console.error('Cannot switch layer: Cesium viewer not initialized');
        return;
      }
      
      // Update the active layer state
      setActiveLayer(layerName);
      console.log(`Switching to layer: ${layerName}`);
    
      // Remove all existing imagery layers except the base layer
      while (viewer.imageryLayers.length > 0) {
        viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
      }
    
      // Add the selected layer
      switch (layerName) {
      case 'Temperature':
        // For temperature map, use Cesium's built-in imagery
        // Add base Earth layer
        viewer.imageryLayers.addImageryProvider(
          new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Imagery courtesy Natural Earth'
          })
        );
        
        // Add a simple color overlay for temperature visualization
        const tempLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.SingleTileImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NightLights.png'),
            rectangle: window.Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0)
          })
        );
        
        // Set transparency and color for temperature overlay
        if (tempLayer) {
          tempLayer.alpha = 0.5;
          tempLayer.brightness = 2.0;
          tempLayer.contrast = 1.5;
          tempLayer.hue = 0.0; // Red hue for temperature
        }
        break;
        
      case 'Precipitation':
        // For precipitation map, use Cesium's built-in imagery
        // Add base Earth layer
        viewer.imageryLayers.addImageryProvider(
          new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Imagery courtesy Natural Earth'
          })
        );
        
        // Add a simple color overlay for precipitation visualization
        const precipLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.SingleTileImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/watercolor.jpg'),
            rectangle: window.Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0)
          })
        );
        
        // Set transparency and color for precipitation overlay
        if (precipLayer) {
          precipLayer.alpha = 0.5;
          precipLayer.brightness = 1.5;
          precipLayer.contrast = 1.0;
          precipLayer.hue = 0.5; // Blue hue for precipitation
        }
        break;
        
      case 'Clouds':
        // For cloud map, use Cesium's built-in imagery
        // Add base Earth layer
        viewer.imageryLayers.addImageryProvider(
          new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Imagery courtesy Natural Earth'
          })
        );
        
        // Add a simple color overlay for cloud visualization
        const cloudLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.SingleTileImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/moonSmall.jpg'),
            rectangle: window.Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0)
          })
        );
        
        // Set transparency and color for cloud overlay
        if (cloudLayer) {
          cloudLayer.alpha = 0.3;
          cloudLayer.brightness = 2.0;
          cloudLayer.contrast = 1.0;
          cloudLayer.hue = 0.7; // White-blue hue for clouds
        }
        break;
        
      case 'Satellite':
      default:
        // For satellite view, use Cesium's built-in Natural Earth imagery
        viewer.imageryLayers.addImageryProvider(
          new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Imagery courtesy Natural Earth'
          })
        );
        break;
      }
    } catch (error) {
      console.error('Error switching layer:', error);
      setError('Failed to switch to the selected layer. Please try again.');
    }
  };
  
  // Initialize Cesium viewer when component mounts
  useEffect(() => {
    // Ensure we start with clean state
    setLoading(true);
    setError(null);
    
    let initTimer: number;
    
    // Initialize Cesium viewer and set up the globe
    const initCesium = async () => {
      try {
        console.log('Initializing Cesium...');
        
        // Check if WebGL is supported
        if (!isWebGLSupported()) {
          console.error('WebGL is not supported');
          setError('WebGL is not supported in your browser. Please try a different browser.');
          setLoading(false);
          return;
        }
        
        // Import Cesium directly
        if (!window.Cesium) {
          try {
            // Set base URL for Cesium assets
            window.CESIUM_BASE_URL = '/cesium/';
            
            // Try to load Cesium from the global scope
            const script = document.createElement('script');
            script.src = '/cesium/Cesium.js';
            script.async = false;
            document.head.appendChild(script);
            
            // Wait for script to load
            await new Promise<void>((resolve, reject) => {
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Failed to load Cesium script'));
              
              // Timeout after 10 seconds
              setTimeout(() => reject(new Error('Cesium script load timeout')), 10000);
            });
            
            console.log('Cesium script loaded');
          } catch (error) {
            console.error('Error loading Cesium:', error);
            setError('Failed to load Cesium. Please refresh the page and try again.');
            setLoading(false);
            return;
          }
        }
        
        // Wait for Cesium to be fully available
        let attempts = 0;
        while (!window.Cesium && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!window.Cesium) {
          console.error('Cesium failed to initialize after waiting');
          setError('Failed to load Cesium. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
        
        console.log('Cesium loaded successfully');
        
        // Set Cesium Ion access token
        window.Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_ACCESS_TOKEN || CESIUM_ACCESS_TOKEN;
        
        // Create the Cesium viewer with minimal configuration for reliability
        if (cesiumContainerRef.current && !viewerRef.current) {
          try {
            // Create the viewer with NASA GIBS imagery configuration
            viewerRef.current = new window.Cesium.Viewer(cesiumContainerRef.current, {
              animation: false,
              baseLayerPicker: false,
              fullscreenButton: false,
              geocoder: false,
              homeButton: false,
              infoBox: false,
              sceneModePicker: false,
              selectionIndicator: false,
              timeline: false,
              navigationHelpButton: false,
              navigationInstructionsInitiallyVisible: false,
              // Initially create with no imagery layer - we'll add it manually
              imageryProvider: false,
              // Use simple terrain provider for reliability
              terrainProvider: new window.Cesium.EllipsoidTerrainProvider(),
              // Enable continuous rendering to ensure the globe is always visible
              requestRenderMode: false,
              // Optimize for performance
              targetFrameRate: 60,
              scene3DOnly: true,
              // Set a blue base color for immediate visual feedback while loading
              baseColor: new window.Cesium.Color(0.0, 0.0, 0.5, 1.0)
            });
            
            // Set the initial camera position to show the Earth
            viewerRef.current.camera.setView({
              destination: window.Cesium.Cartesian3.fromDegrees(0, 0, 20000000)
            });
            
            // Force a render to ensure the globe is visible
            viewerRef.current.scene.requestRender();
            
            // Set loading to false once the viewer is created
            setLoading(false);
          } catch (viewerError) {
            console.error('Error creating Cesium viewer:', viewerError);
            setError('Failed to create Earth viewer. Please refresh the page and try again.');
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error initializing Cesium:', error);
        setError('Failed to initialize Earth viewer. Please refresh the page and try again.');
        setLoading(false);
      }
    };
    
    // Start the initialization process with a short delay
    initTimer = window.setTimeout(() => {
      initCesium();
    }, 100) as unknown as number;
    
    // Clean up function
    return () => {
      // Clear the initialization timer
      if (initTimer) {
        window.clearTimeout(initTimer);
      }
      
      // Destroy the viewer if it exists
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);
  
  // Handle zoom in
  const handleZoomIn = () => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      const cameraHeight = viewerRef.current.camera.positionCartographic.height;
      viewerRef.current.camera.zoomIn(cameraHeight * 0.2);
    }
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      const cameraHeight = viewerRef.current.camera.positionCartographic.height;
      viewerRef.current.camera.zoomOut(cameraHeight * 0.2);
    }
  };
  
  // Toggle play/pause animation
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    
    // Control animation if needed
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      // Animation logic can be added here
    }
  };

  // Render the Earth viewer UI
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* If there's an error, show the fallback Earth viewer */}
      {error && <SimpleEarthViewerFallback />}
      
      {/* Only show the main viewer if there's no error */}
      {!error && (
        <>
          {/* Logo Header - Moved to top left corner */}
          <Box sx={{ 
            position: 'absolute', 
            top: '10px', 
            left: '10px', 
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            padding: '5px 15px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src="/images/vision-earth-logo.svg" 
              alt="Vision Earth Logo" 
              style={{ height: '40px', marginRight: '10px' }} 
            />
            <Typography variant="h5" sx={{ margin: 0, color: '#1a365d', fontWeight: 'bold' }}>
              Vision Earth
            </Typography>
          </Box>
          
          {/* Weather Map Options Panel */}
          <WeatherMapOptions 
            activeLayer={activeLayer}
            onLayerChange={switchLayer}
          />
          
          {/* Main Cesium container */}
          <Box
            ref={cesiumContainerRef}
            id="cesiumContainer"
            sx={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
          
          {/* Right vertical mini toolbar - styled like Zoom Earth */}
          {!loading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                right: 10,
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 1000,
              }}
            >
              <Paper
                elevation={3}
                sx={{
                  bgcolor: 'rgba(33, 33, 33, 0.85)',
                  color: 'white',
                  borderRadius: 28,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  p: 1,
                }}
              >
                <Tooltip title="Search" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    🔍
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Settings" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    ⚙️
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Info" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    ℹ️
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Share" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    📤
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Measure" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    📏
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Crosshair" placement="left">
                  <IconButton size="small" sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}>
                    ⊕
                  </IconButton>
                </Tooltip>
              </Paper>
              
              <Paper
                elevation={3}
                sx={{
                  bgcolor: 'rgba(33, 33, 33, 0.85)',
                  color: 'white',
                  borderRadius: 28,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  p: 1,
                  mt: 2
                }}
              >
                <Tooltip title="Zoom In" placement="left">
                  <IconButton 
                    onClick={handleZoomIn}
                    size="small" 
                    sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}
                  >
                    +
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Zoom Out" placement="left">
                  <IconButton 
                    onClick={handleZoomOut}
                    size="small" 
                    sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}
                  >
                    -
                  </IconButton>
                </Tooltip>
                
                <Tooltip title={isPlaying ? "Pause" : "Play"} placement="left">
                  <IconButton 
                    onClick={togglePlayPause}
                    size="small" 
                    sx={{ color: 'white', width: 40, height: 40 }}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </IconButton>
                </Tooltip>
              </Paper>
            </Box>
          )}
        </>
      )}
      
      {/* Loading indicator */}
      {loading && !error && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ color: 'white' }}>
            Loading Earth Viewer...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Export the component
export default EarthViewerPage;

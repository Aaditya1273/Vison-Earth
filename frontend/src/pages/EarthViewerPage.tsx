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

  // Function to check if WebGL is supported with detailed diagnostics
  const isWebGLSupported = (): boolean => {
    try {
      console.log('Checking WebGL support...');
      const canvas = document.createElement('canvas');
      
      // Try to get WebGL 2.0 context first (preferred)
      let gl: WebGLRenderingContext | WebGL2RenderingContext | null = canvas.getContext('webgl2');
      
      if (!gl) {
        console.log('WebGL 2.0 not available, falling back to WebGL 1.0');
        // Fall back to WebGL 1.0
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      } else {
        console.log('WebGL 2.0 is supported');
      }
      
      if (!gl) {
        console.error('Failed to get WebGL context');
        return false;
      }
      
      // Get WebGL info for diagnostics
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.log(`WebGL Vendor: ${vendor}`);
        console.log(`WebGL Renderer: ${renderer}`);
      }
      
      // Check for required extensions
      const requiredExtensions = ['OES_texture_float', 'OES_element_index_uint'];
      const missingExtensions = requiredExtensions.filter(ext => !gl.getExtension(ext));
      
      if (missingExtensions.length > 0) {
        console.warn(`Missing WebGL extensions: ${missingExtensions.join(', ')}`);
        // Continue anyway, as Cesium has fallbacks for some extensions
      }
      
      // Get max texture size for diagnostics
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      console.log(`WebGL Max Texture Size: ${maxTextureSize}`);
      
      // Clean up
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      
      console.log('WebGL is supported');
      return true;
    } catch (e) {
      console.error('Error checking WebGL support:', e);
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
      
      if (viewer.isDestroyed()) {
        console.error('Cannot switch layer: Cesium viewer has been destroyed');
        return;
      }
      
      setActiveLayer(layerName);
      console.log(`Switching to layer: ${layerName}`);

      // Remove all existing imagery layers with robust error handling
      let retryCount = 0;
      const maxRetries = 3;
      
      const clearLayers = () => {
        try {
          while (viewer.imageryLayers.length > 0) {
            viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
          }
          return true;
        } catch (layerError) {
          console.error(`Error removing existing imagery layers (attempt ${retryCount + 1}/${maxRetries}):`, layerError);
          retryCount++;
          if (retryCount < maxRetries) {
            // Small delay before retry
            setTimeout(clearLayers, 100);
            return false;
          }
          // Continue anyway after max retries
          console.warn('Failed to clear all imagery layers after maximum retries, continuing anyway');
          return false;
        }
      };
      
      clearLayers();

      // Use hardcoded date for NASA GIBS imagery to ensure availability
      // This date (2025-06-03) is known to have valid imagery data
      // Using a fixed date prevents issues with missing or stale tiles
      const fixedDate = '2025-06-03';
      console.log('Using fixed date for imagery:', fixedDate);

      // Add the selected layer
      switch (layerName) {
      case 'Temperature':
        // Add temperature overlay
        const temperatureLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.WebMapTileServiceImageryProvider({
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${fixedDate}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
            layer: 'MODIS_Terra_Land_Surface_Temp_Day',
            style: 'default',
            format: 'image/png',
            tileMatrixSetID: 'GoogleMapsCompatible_Level7',
            maximumLevel: 7,
            credit: 'NASA MODIS Temperature Data'
          })
        );
        
        // Set transparency and coloring
        if (temperatureLayer) {
          temperatureLayer.alpha = 0.6;  // Semi-transparent
          temperatureLayer.brightness = 1.5;
          temperatureLayer.contrast = 1.2;
          temperatureLayer.hue = 0.0;  // Red hue for temperature
        }
        break;
        
      case 'Precipitation':
        // Add precipitation overlay
        const precipitationLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.WebMapTileServiceImageryProvider({
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${fixedDate}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
            layer: 'IMERG_Precipitation_Rate',
            style: 'default',
            format: 'image/png',
            tileMatrixSetID: 'GoogleMapsCompatible_Level7',
            maximumLevel: 7,
            credit: 'NASA IMERG Precipitation Data'
          })
        );
        
        // Set transparency and coloring
        if (precipitationLayer) {
          precipitationLayer.alpha = 0.7;  // Semi-transparent
          precipitationLayer.brightness = 1.3;
          precipitationLayer.contrast = 1.0;
          precipitationLayer.hue = 0.6;  // Blue hue for precipitation
        }
        break;
        
      case 'Clouds':
        // Add cloud overlay
        const cloudLayer = viewer.imageryLayers.addImageryProvider(
          new window.Cesium.WebMapTileServiceImageryProvider({
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Cloud_Top_Temp_Day/default/${fixedDate}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
            layer: 'MODIS_Terra_Cloud_Top_Temp_Day',
            style: 'default',
            format: 'image/png',
            tileMatrixSetID: 'GoogleMapsCompatible_Level7',
            maximumLevel: 7,
            credit: 'NASA MODIS Cloud Data'
          })
        );
        
        // Set transparency and coloring
        if (cloudLayer) {
          cloudLayer.alpha = 0.7;  // Semi-transparent
          cloudLayer.brightness = 1.8;
          cloudLayer.contrast = 1.0;
          cloudLayer.hue = 0.7; // White-blue hue for clouds
        }
        break;
        
      case 'Satellite':
      default:
        // For satellite view, use VIIRS_SNPP imagery
        viewer.imageryLayers.addImageryProvider(
          new window.Cesium.WebMapTileServiceImageryProvider({
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${fixedDate}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg`,
            layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
            style: 'default',
            format: 'image/jpeg',
            tileMatrixSetID: 'GoogleMapsCompatible_Level8',
            maximumLevel: 8,
            credit: 'NASA VIIRS SNPP'
          })
        );
        break;
      }
    } catch (error) {
      console.error('Error switching layer:', error);
      
      // Try to recover with a fallback imagery provider if NASA GIBS fails
      try {
        console.log('Attempting to recover with fallback imagery provider');
        const viewer = viewerRef.current;
        if (viewer) {
          // Clear any remaining layers
          while (viewer.imageryLayers.length > 0) {
            viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
          }
          
          // Add a simple Cesium Natural Earth II imagery as fallback
          const fallbackProvider = new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Cesium Natural Earth II'
          });
          
          viewer.imageryLayers.addImageryProvider(fallbackProvider);
          console.log('Fallback imagery provider added successfully');
        }
      } catch (fallbackError) {
        console.error('Fallback imagery provider also failed:', fallbackError);
        setError('Failed to switch to the selected layer. Please try again.');
      }
    }
  };
  
  // Main effect for Cesium initialization (runs once on mount)
  useEffect(() => {
    const initCesium = async () => {
      setLoading(true);
      setError(null);
      console.log('EarthViewerPage mounted, initializing Cesium...');

      // Ensure Cesium is loaded globally (e.g., via script tag in index.html)
      if (!window.Cesium) {
        console.error('Cesium global object not found. Ensure Cesium.js is loaded before this component.');
        setError('Cesium library not loaded. Please check console and ensure index.html includes Cesium.js.');
        setLoading(false);
        return;
      }

      if (!isWebGLSupported()) {
        console.error('WebGL is not supported');
        setError('WebGL is not supported in your browser. Please try a different browser.');
        setLoading(false);
        return;
      }

      console.log('EarthViewerPage: After WebGL check. Is window.Cesium defined?', window.Cesium);
      window.Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_ACCESS_TOKEN || CESIUM_ACCESS_TOKEN;

      if (cesiumContainerRef.current && !viewerRef.current) {
        try {
          console.log('Creating Cesium viewer with target configuration');
          
          // Ensure the container has dimensions
          cesiumContainerRef.current.style.width = '100%';
          cesiumContainerRef.current.style.height = '100%';
          
          // Create a simple ellipsoid terrain provider as fallback
          const terrainProvider = new window.Cesium.EllipsoidTerrainProvider();
          
          // Create viewer with minimal configuration
          const viewer = new window.Cesium.Viewer(cesiumContainerRef.current, {
            // Basic configuration
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            animation: false,
            creditContainer: document.createElement('div'),
            fullscreenButton: false,
            
            // Use simple ellipsoid terrain provider for maximum compatibility
            terrainProvider: new window.Cesium.EllipsoidTerrainProvider(),
            
            // Start with no base layer - we'll add NASA GIBS after initialization
            imageryProvider: false,
            
            // Performance settings
            requestRenderMode: true,
            targetFrameRate: 60,
            
            // Scene settings
            scene3DOnly: true,
            skyAtmosphere: false,
            skyBox: false,
            
            // Disable effects that might cause issues
            shadows: false,
            fxaa: false,
            orderIndependentTranslucency: false,
            
            // Use software rendering if needed
            contextOptions: {
              webgl: {
                alpha: true,
                depth: true,
                stencil: true,
                antialias: true,
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
                failIfMajorPerformanceCaveat: false
              }
            }
            // Imagery provider will be set by switchLayer
          });
          viewerRef.current = viewer;

          viewer.scene.globe.enableLighting = false;
          viewer.scene.globe.baseColor = window.Cesium.Color.BLUE; // Set to blue so globe is visible even if imagery fails

          // Add NASA GIBS base layer
          try {
            const fixedDate = '2025-06-03';
            const nasaProvider = new window.Cesium.WebMapTileServiceImageryProvider({
              url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${fixedDate}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg`,
              layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
              style: 'default',
              format: 'image/jpeg',
              tileMatrixSetID: 'GoogleMapsCompatible_Level8',
              maximumLevel: 8,
              credit: 'NASA GIBS',
              enablePickFeatures: false
            });
            
            // Remove any existing layers
            while (viewer.imageryLayers.length > 0) {
              viewer.imageryLayers.remove(viewer.imageryLayers.get(0), true);
            }
            
            // Add NASA layer
            viewer.imageryLayers.addImageryProvider(nasaProvider);
            console.log('NASA GIBS layer added successfully');
          } catch (nasaError) {
            console.error('Failed to add NASA GIBS layer:', nasaError);
            // Fallback to Cesium World Imagery if NASA fails
            const worldImagery = new window.Cesium.IonImageryProvider({ assetId: 3 });
            viewer.imageryLayers.addImageryProvider(worldImagery);
            console.log('Falling back to Cesium World Imagery');
          }
          
          // Set the camera to a good initial position
          viewer.camera.flyTo({
            destination: window.Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
            orientation: {
              heading: 0.0,
              pitch: -window.Cesium.Math.PI_OVER_TWO,
              roll: 0.0
            }
          });

          viewer.camera.setView({
            destination: window.Cesium.Cartesian3.fromDegrees(0, 0, 15000000),
            orientation: {
              heading: 0.0,
              pitch: -window.Cesium.Math.PI_OVER_TWO,
              roll: 0.0
            }
          });

          // Add event listener for WebGL context lost
          viewer.scene.canvas.addEventListener('webglcontextlost', function(event: Event) {
            console.error('WebGL context lost:', event);
            setError('WebGL context was lost. Please refresh the page.');
            if (event.preventDefault) event.preventDefault();
          }, false);

          // Add event listener for WebGL context restoration
          viewer.scene.canvas.addEventListener('webglcontextrestored', function(event: Event) {
            console.log('WebGL context restored:', event);
            setError(''); // Clear error
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              viewerRef.current.scene.requestRender();
            }
          }, false);
          
          // Add NASA GIBS MODIS imagery layer for true color Earth
try {
  try {
    // Add NASA GIBS layer
    // Use a fixed date for NASA GIBS imagery to ensure consistent display
    const fixedDate = '2025-06-03';
    
    const nasaLayer = new window.Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi',
      layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: 'GoogleMapsCompatible',
      maximumLevel: 8,
      credit: 'NASA GIBS',
      tileWidth: 256,
      tileHeight: 256,
      dimensions: { time: fixedDate }
    });
    viewer.imageryLayers.addImageryProvider(nasaLayer);
    console.log('NASA GIBS MODIS imagery layer added successfully');
  } catch (nasaErr) {
    console.error('Failed to add NASA GIBS imagery layer, falling back:', nasaErr);
    // Add fallback provider
    const fallbackProvider = new window.Cesium.TileMapServiceImageryProvider({
      url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
      maximumLevel: 5,
      credit: 'Cesium Natural Earth II'
    });
    viewer.imageryLayers.addImageryProvider(fallbackProvider);
    console.log('Fallback imagery provider added');
  }
  console.log('NASA GIBS MODIS imagery layer added successfully');
} catch (nasaErr) {
  console.error('Failed to add NASA GIBS imagery layer', nasaErr);
}
// Initial layer will be set by the activeLayer useEffect
console.log('Cesium viewer core initialized.');
          // setLoading(false) will be handled by the activeLayer useEffect after the first layer is loaded.

        } catch (initError) {
          console.error('Error initializing Cesium viewer:', initError);
          setError('Failed to initialize Earth Viewer. Check console.');
          setLoading(false);
        }
      }
    };

    initCesium();

    return () => {
      // Clean up Cesium viewer when component unmounts
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        console.log('Destroying Cesium viewer');
        try {
          // if (viewerRef.current.clock) viewerRef.current.clock.onTick.removeAll();
          if (viewerRef.current.camera?.flyTo) viewerRef.current.camera.cancelFlight();
          
          // Type assertion for canvas if necessary, or ensure it exists
          const canvas = viewerRef.current.scene?.canvas as HTMLCanvasElement | undefined;
          if (canvas) {
             // Removing specific listeners can be tricky if anonymous functions were used.
             // For simplicity, Cesium's destroy() should handle most internal listeners.
          }

          if (viewerRef.current.entities) viewerRef.current.entities.removeAll();
          
          // Ensure imageryLayers exists before trying to access its length or methods
          if (viewerRef.current.imageryLayers) {
            while (viewerRef.current.imageryLayers.length > 0) {
              viewerRef.current.imageryLayers.remove(viewerRef.current.imageryLayers.get(0), true);
            }
          }
          
          viewerRef.current.destroy();
        } catch (error) {
          console.error('Error during Cesium viewer cleanup:', error);
        } finally {
          viewerRef.current = null;
        }
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount and unmount

  // Effect for handling activeLayer changes and initial layer loading
  useEffect(() => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      console.log(`Active layer changed to: ${activeLayer}, applying...`);
      setLoading(true); // Show loading while switching layers
      try {
        switchLayer(activeLayer);
      } catch (e) {
        console.error(`Error applying layer ${activeLayer}:`, e);
        setError(`Failed to apply layer: ${activeLayer}`);
      } finally {
        setLoading(false);
      }
    } else if (!viewerRef.current && !loading && error === null) {
      // This case might indicate that the viewer initialization is pending or failed silently
      // and activeLayer changed. setLoading(true) in initCesium should cover this.
      console.warn('Attempted to switch layer, but viewer is not ready.');
    }
  }, [activeLayer]); // Runs when activeLayer changes (and after initial mount due to state update flow)

  
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
      if (!isPlaying) {
        // Start animation
        viewerRef.current.clock.shouldAnimate = true;
      } else {
        // Stop animation
        viewerRef.current.clock.shouldAnimate = false;
      }
    }
  };

  // Render the Earth viewer UI
  return (
    <Box sx={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
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
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: 1,
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            backdropFilter: 'blur(5px)'
          }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
              Vision Earth
            </Typography>
          </Box>
          
          {/* Layer controls - top right */}
          <Box sx={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px', 
            zIndex: 1000 
          }}>
            <WeatherMapOptions 
              activeLayer={activeLayer} 
              onLayerChange={switchLayer} 
            />
          </Box>
        
          {/* Cesium container */}
          <div 
            ref={cesiumContainerRef}
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#000011'
            }}
          >
            {loading && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                zIndex: 1000
              }}>
                <CircularProgress />
                <div>Loading Earth...</div>
              </div>
            )}
          </div>
          
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

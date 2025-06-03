import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Tooltip, IconButton, Slider
} from '@mui/material';
import WeatherMapOptions from '../components/WeatherMapOptions';
import { getCurrentWeather, CurrentWeather } from '../services/weatherService';

// Define the window interface extension for Cesium global object
declare global {
  interface Window {
    Cesium: any;
  }
}

// Cesium Ion access token from environment variables
const CESIUM_ACCESS_TOKEN = process.env.REACT_APP_CESIUM_ACCESS_TOKEN || '9ff13709-5bab-46ad-a792-bba5db573d07';

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
  
  // Function to check if Cesium is loaded
  const isCesiumLoaded = () => {
    return typeof window.Cesium !== 'undefined';
  };
  
  // Function to check if WebGL is supported
  const isWebGLSupported = () => {
    try {
      const canvas = document.createElement('canvas');
      return (
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  };
  
  // Function to fetch weather data for a specific location
  const fetchWeatherData = async (lat: number, lon: number, locationName: string = 'Selected Location') => {
    if (weatherLoading) return;
    
    setWeatherLoading(true);
    setWeatherError(null);
    
    try {
      console.log(`Fetching weather data for ${locationName} (${lat}, ${lon})`);
      const data = await getCurrentWeather(lat, lon);
      setWeatherData(data);
      setSelectedLocation({ lat, lon, name: locationName });
      
      // If we have a Cesium viewer, add a weather marker at this location
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        addWeatherMarker(lat, lon, data);
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setWeatherError('Failed to fetch weather data. Please try again.');
    } finally {
      setWeatherLoading(false);
    }
  };
  
  // Function to add a weather marker to the map
  const addWeatherMarker = (lat: number, lon: number, weather: CurrentWeather) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    
    // Remove existing weather entity if it exists
    if (weatherEntityRef.current && viewer.entities.contains(weatherEntityRef.current)) {
      viewer.entities.remove(weatherEntityRef.current);
    }
    
    // Get weather icon URL based on weather code
    const iconUrl = getWeatherIconUrl(weather.weathercode);
    
    // Create a new entity for the weather marker
    weatherEntityRef.current = viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(lon, lat),
      billboard: {
        image: iconUrl,
        width: 32,
        height: 32,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `${Math.round(weather.temperature)}°C`,
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        outlineColor: window.Cesium.Color.BLACK,
        outlineWidth: 2,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: window.Cesium.VerticalOrigin.TOP,
        pixelOffset: new window.Cesium.Cartesian2(0, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    
    // Fly to the weather location
    viewer.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(lon, lat, 1000000),
      duration: 2
    });
  };
  
  // Helper function to get weather icon URL based on weather code
  const getWeatherIconUrl = (code: number): string => {
    // Map weather codes to icon names
    let iconName = 'unknown';
    
    if (code === 0) iconName = 'clear-day';
    else if (code === 1 || code === 2) iconName = 'partly-cloudy-day';
    else if (code === 3) iconName = 'cloudy';
    else if (code === 45 || code === 48) iconName = 'fog';
    else if (code >= 51 && code <= 57) iconName = 'drizzle';
    else if (code >= 61 && code <= 67) iconName = 'rain';
    else if (code >= 71 && code <= 77) iconName = 'snow';
    else if (code >= 80 && code <= 82) iconName = 'rain';
    else if (code >= 85 && code <= 86) iconName = 'snow';
    else if (code >= 95) iconName = 'thunderstorm';
    
    // Return a placeholder URL - in a real app, you would use actual weather icons
    return `https://cdn.weatherapi.com/weather/64x64/day/${iconName}.png`;
  };
  
  // Function to switch between different imagery layers
  const switchImageryLayer = (layerName: string) => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    
    setActiveLayer(layerName);
    
    const viewer = viewerRef.current;
    const imageryLayers = viewer.imageryLayers;
    
    // Remove all existing layers except the base layer
    while (imageryLayers.length > 1) {
      imageryLayers.remove(imageryLayers.get(1));
    }
    
    // Add the selected layer
    try {
      switch (layerName) {
        case 'Satellite':
          // Use high-resolution satellite imagery (similar to Radio Garden)
          const satelliteLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          // Enhance the satellite imagery
          satelliteLayer.brightness = 1.1;
          satelliteLayer.contrast = 1.1;
          satelliteLayer.gamma = 1.05;
          break;
          
        case 'Live':
          // Use Bing Maps Aerial with Labels imagery for a "live" view
          const liveLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 3 // Bing Maps Aerial with Labels
            })
          );
          // Enhance the live imagery
          liveLayer.brightness = 1.0;
          liveLayer.contrast = 1.1;
          break;
          
        case 'HD':
          // Use Sentinel imagery for HD view (high-resolution satellite imagery)
          const hdLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 3812 // Sentinel-2 imagery
            })
          );
          // Enhance the HD imagery
          hdLayer.brightness = 1.1;
          hdLayer.contrast = 1.2;
          hdLayer.saturation = 1.2;
          break;
          
        case 'Radar':
          // Create a more realistic radar view with multiple layers
          // Base satellite layer
          const radarBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          radarBaseLayer.brightness = 0.8; // Darken the base layer
          
          // Add a colorized radar overlay
          const radarOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.SingleTileImageryProvider({
              url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/latest.jpg',
              rectangle: window.Cesium.Rectangle.fromDegrees(-130, 20, -60, 55)
            })
          );
          radarOverlay.alpha = 0.6;
          radarOverlay.brightness = 1.5;
          radarOverlay.contrast = 1.2;
          radarOverlay.hue = 0.5; // Blue tint
          break;
          
        case 'Precipitation':
          // Create a precipitation visualization
          // Base satellite layer
          const precipBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          precipBaseLayer.brightness = 0.7; // Darken the base layer
          
          // Add a blue-tinted precipitation overlay
          const precipOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.GridImageryProvider({
              cells: 4,
              color: window.Cesium.Color.BLUE.withAlpha(0.3)
            })
          );
          precipOverlay.alpha = 0.5;
          break;
          
        case 'Wind':
          // Create a wind visualization
          // Base satellite layer
          const windBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          windBaseLayer.brightness = 0.8;
          
          // Add a stylized wind overlay
          const windOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.GridImageryProvider({
              cells: 8,
              color: window.Cesium.Color.WHITE.withAlpha(0.2),
              glowWidth: 2
            })
          );
          windOverlay.alpha = 0.3;
          break;
          
        case 'Temperature':
          // Create a temperature visualization with a heat map effect
          // Base satellite layer
          const tempBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          tempBaseLayer.brightness = 0.7;
          
          // Add a red-tinted temperature overlay
          const tempOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.GridImageryProvider({
              cells: 6,
              color: window.Cesium.Color.RED.withAlpha(0.3)
            })
          );
          tempOverlay.alpha = 0.5;
          tempOverlay.brightness = 1.5;
          tempOverlay.contrast = 1.0;
          tempOverlay.hue = 0.0; // Red tint
          tempOverlay.saturation = 2.0;
          break;
          
        case 'Humidity':
          // Create a humidity visualization
          // Base satellite layer
          const humidityBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          humidityBaseLayer.brightness = 0.8;
          
          // Add a green-tinted humidity overlay
          const humidityOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.GridImageryProvider({
              cells: 5,
              color: window.Cesium.Color.LIGHTGREEN.withAlpha(0.3)
            })
          );
          humidityOverlay.alpha = 0.4;
          humidityOverlay.hue = 0.33; // Green tint
          break;
          
        case 'Pressure':
          // Create a pressure visualization
          // Base satellite layer
          const pressureBaseLayer = imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          pressureBaseLayer.brightness = 0.8;
          
          // Add a purple-tinted pressure overlay with concentric circles
          const pressureOverlay = imageryLayers.addImageryProvider(
            new window.Cesium.GridImageryProvider({
              cells: 10,
              color: window.Cesium.Color.PURPLE.withAlpha(0.3)
            })
          );
          pressureOverlay.alpha = 0.4;
          pressureOverlay.hue = 0.83; // Purple tint
          break;
          
        default:
          // Default to satellite view
          imageryLayers.addImageryProvider(
            new window.Cesium.IonImageryProvider({
              assetId: 2 // Bing Maps Aerial
            })
          );
          break;
      }
    } catch (error) {
      console.error(`Error switching to ${layerName} layer:`, error);
      // Fallback to basic imagery if there's an error
      try {
        imageryLayers.addImageryProvider(
          new window.Cesium.IonImageryProvider({
            assetId: 2 // Bing Maps Aerial
          })
        );
      } catch (fallbackError) {
        console.error('Error loading fallback imagery:', fallbackError);
      }
    }
  };
  
  // Initialize Cesium viewer when component mounts
  useEffect(() => {
    // Ensure we start with clean state
    setLoading(true);
    setError(null);
    
    // Delay initialization slightly to ensure DOM is ready
    const initTimer = setTimeout(() => {
      // Skip initialization if Cesium is not loaded
      if (!isCesiumLoaded()) {
        console.error('Cesium library not loaded');
        setError('Cesium library not loaded. Please check your internet connection and reload the page.');
        setLoading(false);
        return;
      }
      
      // Check if WebGL is supported
      if (!isWebGLSupported()) {
        console.error('WebGL is not supported');
        setError('WebGL is not supported or enabled in your browser. Please enable WebGL or try a different browser.');
        setLoading(false);
        return;
      }
      
      // Make sure the container is visible and properly sized
      if (!cesiumContainerRef.current) {
        console.error('Cesium container ref is null');
        setError('Failed to initialize the Earth viewer. Container element not found.');
        setLoading(false);
        return;
      }
      
      cesiumContainerRef.current.style.width = '100%';
      cesiumContainerRef.current.style.height = '100%';
      cesiumContainerRef.current.style.position = 'absolute';
      cesiumContainerRef.current.style.top = '0';
      cesiumContainerRef.current.style.left = '0';
      
      // Set Cesium Ion access token
      try {
        window.Cesium.Ion.defaultAccessToken = CESIUM_ACCESS_TOKEN;
        console.log('Set Cesium Ion token:', CESIUM_ACCESS_TOKEN);
      } catch (tokenError) {
        console.error('Error setting Cesium Ion token:', tokenError);
        setError('Failed to set Cesium access token. Please check your configuration.');
        setLoading(false);
        return;
      }
      
      // Initialize the Cesium Viewer
      try {
        // Make sure we don't have an existing viewer
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
        
        console.log('Initializing Cesium viewer');
        
        // Create the Cesium viewer with basic options first, then upgrade
        const viewer = new window.Cesium.Viewer(cesiumContainerRef.current, {
          // Start with a simple terrain provider
          terrainProvider: new window.Cesium.EllipsoidTerrainProvider(),
          // Use a simple imagery provider that doesn't require Ion
          imageryProvider: new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
          }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          vrButton: false,
          selectionIndicator: false,
          infoBox: false,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          targetFrameRate: 60
        });
      
      // Store the viewer reference
      viewerRef.current = viewer;
      
      // Enable atmosphere, lighting and other visual enhancements
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.globe.baseColor = window.Cesium.Color.BLACK;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.2;
      viewer.scene.skyAtmosphere.hueShift = 0.0;
      viewer.scene.skyAtmosphere.saturationShift = 0.1;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0002;
      viewer.scene.fog.screenSpaceErrorFactor = 4.0;
      
      // Add stars in the background (like Radio Garden)
      viewer.scene.skyBox.show = true;
      viewer.scene.backgroundColor = window.Cesium.Color.BLACK;
      viewer.scene.moon.show = false; // Hide the moon
      
      // Enhance globe appearance
      viewer.scene.globe.maximumScreenSpaceError = 2.0; // Higher detail
      viewer.scene.globe.tileCacheSize = 1000; // Larger cache for smoother experience
      viewer.scene.globe.depthTestAgainstTerrain = true; // Better depth testing
      
      // Set initial camera position to focus on India with a more dramatic angle
      viewer.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 5000000),
        orientation: {
          heading: window.Cesium.Math.toRadians(0.0),
          pitch: window.Cesium.Math.toRadians(-45.0), // More tilted view
          roll: 0.0
        },
        duration: 3.0
      });
      
      // Add click event handler to get weather at clicked location
      viewer.screenSpaceEventHandler.setInputAction((click: any) => {
        const cartesian = viewer.camera.pickEllipsoid(
          click.position,
          viewer.scene.globe.ellipsoid
        );
        
        if (cartesian) {
          const cartographic = window.Cesium.Cartographic.fromCartesian(cartesian);
          const lon = window.Cesium.Math.toDegrees(cartographic.longitude);
          const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
          
          // Fetch weather for the clicked location
          fetchWeatherData(lat, lon, 'Selected Location');
        }
      }, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
      
      // Fetch weather for default location (India)
      fetchWeatherData(20.5937, 78.9629, 'India');
      
      // Set loading to false once viewer is initialized
      setLoading(false);
    } catch (error) {
      console.error('Error initializing Cesium viewer:', error);
      setError('Failed to initialize the Earth viewer. Please check your browser compatibility and try again.');
      setLoading(false);
    }
    }, 100); // Short delay to ensure DOM is ready
    
    // Cleanup function to destroy viewer when component unmounts
    return () => {
      clearTimeout(initTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);
  
  // Handle zoom in
  const handleZoomIn = () => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      const camera = viewerRef.current.camera;
      const cameraHeight = camera.positionCartographic.height;
      camera.zoomIn(cameraHeight * 0.2);
    }
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      const camera = viewerRef.current.camera;
      const cameraHeight = camera.positionCartographic.height;
      camera.zoomOut(cameraHeight * 0.2);
    }
  };
  
  // Toggle play/pause
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Weather Map Options Panel */}
      <WeatherMapOptions 
        activeLayer={activeLayer}
        onLayerChange={switchImageryLayer}
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
      {!loading && !error && (
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
                size="small" 
                sx={{ color: 'white', mb: 1.5, width: 40, height: 40 }}
                onClick={() => handleZoomIn()}
              >
                +
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Zoom Out" placement="left">
              <IconButton 
                size="small" 
                sx={{ color: 'white', width: 40, height: 40 }}
                onClick={() => handleZoomOut()}
              >
                -
              </IconButton>
            </Tooltip>
          </Paper>
        </Box>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
          }}
        >
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <CircularProgress color="inherit" size={60} thickness={4} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Loading Earth Viewer...
            </Typography>
          </Box>
        </Box>
      )}
      
      {/* Error message */}
      {!loading && error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            p: 3,
          }}
        >
          <Paper sx={{ p: 3, maxWidth: 500, bgcolor: 'rgba(50, 50, 50, 0.9)', color: 'white' }}>
            <Typography variant="h5" sx={{ mb: 2, color: '#ff5252' }}>
              Error Loading Earth Viewer
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {error}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default EarthViewerPage;

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
  
  // Function to check if Cesium is loaded
  const isCesiumLoaded = () => {
    return typeof window.Cesium !== 'undefined' && window.CESIUM_LOADED === true;
  };
  
  // Function to wait for Cesium to be loaded
  const waitForCesium = async () => {
    if (isCesiumLoaded()) {
      return true;
    }
    
    try {
      if (window.CESIUM_READY) {
        await window.CESIUM_READY;
        return true;
      } else {
        // Fallback if CESIUM_READY is not defined
        return new Promise<boolean>((resolve) => {
          const checkInterval = setInterval(() => {
            if (isCesiumLoaded()) {
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(false);
          }, 10000);
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
    
    // Remove all existing layers
    while (imageryLayers.length > 0) {
      imageryLayers.remove(imageryLayers.get(0));
    }
    
    // Always add a high-quality NASA GIBS base layer first
    try {
      // Add NASA GIBS imagery as the base layer for all options
      imageryLayers.addImageryProvider(
        new window.Cesium.WebMapTileServiceImageryProvider({
          url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
          layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
          style: 'default',
          format: 'image/jpeg',
          tileMatrixSetID: 'GoogleMapsCompatible_Level9',
          maximumLevel: 9,
          credit: 'NASA Global Imagery Browse Services for EOSDIS',
          tilingScheme: new window.Cesium.WebMercatorTilingScheme(),
          times: new window.Cesium.TimeIntervalCollection([
            new window.Cesium.TimeInterval({
              start: window.Cesium.JulianDate.fromDate(new Date()),
              stop: window.Cesium.JulianDate.fromDate(new Date())
            })
          ])
        })
      );
    } catch (error) {
      console.error('Error adding NASA GIBS imagery layer:', error);
      // Fallback to a simpler imagery provider if NASA GIBS fails
      imageryLayers.addImageryProvider(
        new window.Cesium.TileMapServiceImageryProvider({
          url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
        })
      );
    }
    
    // Add the selected layer overlay based on the type
    try {
      switch (layerName) {
        case 'Satellite':
          // Already using Bing Maps Aerial as base layer
          break;
          
        case 'Live':
          // Add OpenStreetMap as an overlay with transparency
          const osmLayer = imageryLayers.addImageryProvider(
            new window.Cesium.OpenStreetMapImageryProvider({
              url: 'https://a.tile.openstreetmap.org/'
            })
          );
          osmLayer.alpha = 0.5; // Make it semi-transparent
          break;
          
        case 'HD':
          // Already using Bing Maps Aerial as base layer
          break;
          
        case 'Radar':
        case 'Precipitation':
        case 'Wind':
        case 'Temperature':
        case 'Humidity':
        case 'Pressure':
          // Add a colored grid overlay for weather visualization
          let color;
          switch (layerName) {
            case 'Radar':
              color = window.Cesium.Color.BLUE;
              break;
            case 'Precipitation':
              color = window.Cesium.Color.CYAN;
              break;
            case 'Wind':
              color = window.Cesium.Color.WHITE;
              break;
            case 'Temperature':
              color = window.Cesium.Color.RED;
              break;
            case 'Humidity':
              color = window.Cesium.Color.GREEN;
              break;
            case 'Pressure':
              color = window.Cesium.Color.PURPLE;
              break;
            default:
              color = window.Cesium.Color.WHITE;
          }
          
          // Add a grid overlay with the appropriate color
          if (window.Cesium.GridImageryProvider) {
            const overlay = imageryLayers.addImageryProvider(
              new window.Cesium.GridImageryProvider({
                cells: 8,
                color: color.withAlpha(0.5)
              })
            );
            overlay.alpha = 0.7;
          }
          
          // Also add a colored material to the globe for better visualization
          viewer.scene.globe.material = window.Cesium.Material.fromType('Color', {
            color: color.withAlpha(0.2)
          });
          break;
          
        default:
          // Default to just showing the base layer
          break;
      }
      
      // Force a render to ensure changes are visible
      viewer.scene.requestRender();
      
    } catch (error) {
      console.error(`Error switching to ${layerName} layer:`, error);
      // The base layer is already set, so we don't need a fallback here
    }
  };
  
  // Initialize Cesium viewer when component mounts
  useEffect(() => {
    // Ensure we start with clean state
    setLoading(true);
    setError(null);
    
    let initTimer: number;
    
    // Initialize Cesium viewer asynchronously
    const initCesium = async () => {
      try {
        // Wait for Cesium to be loaded
        const cesiumLoaded = await waitForCesium();
        if (!cesiumLoaded) {
          console.error('Cesium library not loaded after waiting');
          setError('Cesium library not loaded. Please check your internet connection and reload the page.');
          setLoading(false);
          return;
        }
        
        console.log('Cesium loaded successfully, proceeding with initialization');
        
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
        
        // Set container styles
        if (cesiumContainerRef.current) {
          cesiumContainerRef.current.style.width = '100%';
          cesiumContainerRef.current.style.height = '100%';
          cesiumContainerRef.current.style.position = 'absolute';
          cesiumContainerRef.current.style.top = '0';
          cesiumContainerRef.current.style.left = '0';
        }
        
        // Set Cesium Ion access token
        try {
          // Make sure Cesium is fully loaded before setting the token
          if (window.Cesium && window.Cesium.Ion) {
            window.Cesium.Ion.defaultAccessToken = CESIUM_ACCESS_TOKEN;
            console.log('Set Cesium Ion token successfully');
          } else {
            throw new Error('Cesium Ion not available');
          }
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
          }
          
          console.log('Initializing Cesium viewer');
          
          // Create the Cesium viewer with realistic Earth imagery immediately
          // Use non-null assertion since we've already checked cesiumContainerRef.current above
          const viewer = new window.Cesium.Viewer(cesiumContainerRef.current!, {
            // Use Cesium World Terrain for realistic terrain
            terrainProvider: new window.Cesium.CesiumTerrainProvider({
              url: window.Cesium.IonResource.fromAssetId(1),
              requestWaterMask: true,
              requestVertexNormals: true
            }),
            // Use NASA GIBS imagery for high-quality Earth view
            imageryProvider: new window.Cesium.WebMapTileServiceImageryProvider({
              url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
              layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
              style: 'default',
              format: 'image/jpeg',
              tileMatrixSetID: 'GoogleMapsCompatible_Level9',
              maximumLevel: 9,
              credit: 'NASA Global Imagery Browse Services for EOSDIS',
              tilingScheme: new window.Cesium.WebMercatorTilingScheme(),
              times: new window.Cesium.TimeIntervalCollection([
                new window.Cesium.TimeInterval({
                  start: window.Cesium.JulianDate.fromDate(new Date()),
                  stop: window.Cesium.JulianDate.fromDate(new Date())
                })
              ])
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
          
          // Configure globe for maximum visual quality immediately
          viewer.scene.globe.enableLighting = true;
          viewer.scene.globe.depthTestAgainstTerrain = true;
          viewer.scene.fog.enabled = true;
          viewer.scene.fog.density = 0.0002;
          viewer.scene.skyAtmosphere.show = true;
          viewer.scene.skyBox.show = true;
          viewer.scene.backgroundColor = window.Cesium.Color.BLACK;
          
          console.log('Using high-quality terrain and imagery from start');
          
          // Set initial camera position to show Earth clearly
          viewer.camera.flyTo({
            destination: window.Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 8000000),
            orientation: {
              heading: 0.0,
              pitch: -0.5,
              roll: 0.0
            },
            duration: 0.0 // Immediate positioning
          });
          
          // Make sure we can see the Earth
          viewer.scene.screenSpaceCameraController.enableLook = true;
          viewer.scene.screenSpaceCameraController.enableRotate = true;
          viewer.scene.screenSpaceCameraController.enableTilt = true;
          viewer.scene.screenSpaceCameraController.enableZoom = true;
          
          // Force a render to ensure the globe appears
          viewer.scene.requestRender();
          
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
      } catch (error) {
        console.error('Error during Cesium initialization:', error);
        setError('An error occurred during initialization. Please reload the page.');
        setLoading(false);
      }
    };
    
    // Start the initialization process with a short delay
    initTimer = window.setTimeout(() => {
      initCesium();
    }, 100) as unknown as number;
    
    // Cleanup function to destroy viewer when component unmounts
    return () => {
      if (initTimer) {
        clearTimeout(initTimer);
      }
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
  
  // Toggle play/pause animation
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    
    // Control animation if needed
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      // Animation logic can be added here
    }
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

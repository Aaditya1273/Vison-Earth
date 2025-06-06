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
  
  // Function to check if Cesium is loaded
  const isCesiumLoaded = () => {
    // Check both the flag and the actual Cesium object
    const isLoaded = window.CESIUM_LOADED === true && typeof window.Cesium !== 'undefined';
    console.log(`Cesium loaded check: ${isLoaded ? 'YES' : 'NO'}`);
    return isLoaded;
  };
  
  // Function to wait for Cesium to be fully loaded
  const waitForCesium = () => {
    return new Promise((resolve, reject) => {
      try {
        // Check if Cesium is already loaded
        if (isCesiumLoaded()) {
          console.log('Cesium already loaded, resolving immediately');
          resolve(true);
          return;
        }
        
        console.log('Waiting for Cesium to load...');
        
        // Try to load the Cesium loader script if it hasn't been loaded yet
        if (!document.querySelector('script[src*="/cesium-loader.js"]')) {
          console.log('Cesium loader script not found, adding it now');
          const loaderScript = document.createElement('script');
          loaderScript.src = '/cesium-loader.js';
          loaderScript.type = 'text/javascript';
          
          loaderScript.onload = () => {
            console.log('Cesium loader script loaded, now waiting for Cesium');
            // The script will create window.CESIUM_READY promise
            if (window.CESIUM_READY) {
              // Use the CESIUM_READY promise to wait for Cesium
              window.CESIUM_READY
                .then(() => {
                  console.log('Cesium loaded via CESIUM_READY promise');
                  resolve(true);
                })
                .catch(error => {
                  console.error('Error waiting for Cesium:', error);
                  reject(error);
                });
            } else {
              console.error('CESIUM_READY promise not found from loader');
              reject(new Error('CESIUM_READY promise not found'));
            }
          };
          
          loaderScript.onerror = (e) => {
            console.error('Failed to load Cesium loader script:', e);
            reject(new Error('Failed to load Cesium loader script'));
          };
          
          document.head.appendChild(loaderScript);
          
          // Set a timeout for the loader script itself
          setTimeout(() => {
            if (!isCesiumLoaded()) {
              console.error('Cesium script load timeout');
              reject(new Error('Cesium script load timeout'));
            }
          }, 15000);
        } else {
          // Loader script is already in the page, check for the promise
          if (window.CESIUM_READY) {
            // Use the CESIUM_READY promise to wait for Cesium
            window.CESIUM_READY
              .then(() => {
                console.log('Cesium loaded via existing CESIUM_READY promise');
                resolve(true);
              })
              .catch(error => {
                console.error('Error waiting for Cesium:', error);
                reject(error);
              });
          } else {
            // Start polling as a last resort
            let attempts = 0;
            const maxAttempts = 30;
            const interval = setInterval(() => {
              attempts++;
              if (isCesiumLoaded()) {
                clearInterval(interval);
                console.log(`Cesium loaded after ${attempts} polling attempts`);
                resolve(true);
              } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                const error = new Error(`Cesium failed to load after ${maxAttempts} polling attempts`);
                console.error(error);
                reject(error);
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error('Error in waitForCesium:', error);
        reject(error);
      }
    });
  };
  
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

      // Try to add base Earth layer first (for all layer types)
      try {
        console.log('Adding base Blue Marble layer');
        const baseProvider = new window.Cesium.WebMapTileServiceImageryProvider({
          url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpeg`,
          layer: 'BlueMarble_ShadedRelief_Bathymetry',
          style: 'default',
          format: 'image/jpeg',
          tileMatrixSetID: 'GoogleMapsCompatible_Level8',
          maximumLevel: 8,
          credit: 'NASA Blue Marble'
        });
        
        // Add event listeners for tile loading errors
        baseProvider.errorEvent.addEventListener((error: any) => {
          console.error('Base layer tile loading error:', error);
        });
        
        viewer.imageryLayers.addImageryProvider(baseProvider);
        console.log('Base Blue Marble layer added successfully');
      } catch (baseLayerError) {
        console.error('Error adding base Blue Marble layer:', baseLayerError);
        // Fall back to Cesium's built-in imagery if NASA GIBS fails
        try {
          console.log('Falling back to Cesium Natural Earth II for base layer');
          const fallbackBaseProvider = new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Cesium Natural Earth II'
          });
          viewer.imageryLayers.addImageryProvider(fallbackBaseProvider);
          console.log('Fallback base layer added successfully');
        } catch (fallbackError) {
          console.error('Even fallback base layer failed:', fallbackError);
          throw new Error('Failed to add any base imagery layer');
        }
      }
      
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
  
  // Initialize Cesium viewer when component mounts
  useEffect(() => {
    // Ensure we start with clean state
    setLoading(true);
    setError(null);
    
    console.log('EarthViewerPage mounted, initializing Cesium...');
    
    // Check if we're running in development mode
    const isDev = process.env.NODE_ENV === 'development';
    console.log(`Running in ${isDev ? 'development' : 'production'} mode`);
    
    // Timer reference for the delayed Phase 2 initialization
    let initTimer: number | null = null;
    
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
        
        // Load Cesium dynamically if not loaded yet
        if (!isCesiumLoaded()) {
          console.log('Loading Cesium script...');
          try {
            try {
              console.log('Loading Cesium using cesium-loader.js');
              
              // First load the cesium-loader.js which handles Cesium initialization
              const loaderScript = document.createElement('script');
              loaderScript.src = '/cesium-loader.js';
              loaderScript.async = false;
              loaderScript.type = 'text/javascript';
              
              // Create a promise to track loader script loading
              const loaderPromise = new Promise<void>((resolve, reject) => {
                loaderScript.onload = () => {
                  console.log('Cesium loader script loaded successfully');
                  resolve();
                };
                loaderScript.onerror = (e) => {
                  console.error('Failed to load Cesium loader script:', e);
                  reject(new Error('Failed to load Cesium loader script'));
                };
              });
              
              // Add the loader script to the document
              document.head.appendChild(loaderScript);
              console.log('Cesium loader script added to head');
              
              // Wait for loader script to load
              await loaderPromise;
              
              // Now load the main Cesium.js script
              const mainScript = document.createElement('script');
              mainScript.src = '/cesium/Cesium.js';
              mainScript.async = false;
              mainScript.type = 'text/javascript';
              document.head.appendChild(mainScript);
              
              // Wait for Cesium to be fully loaded using the global promise from cesium-loader.js
              if (window.CESIUM_READY) {
                console.log('Waiting for CESIUM_READY promise from loader...');
                const timeoutPromise = new Promise<void>((_, reject) => {
                  setTimeout(() => reject(new Error('Cesium script load timeout')), 15000);
                });
                
                await Promise.race([window.CESIUM_READY, timeoutPromise]);
                console.log('Cesium script loaded and ready');
              } else {
                console.error('CESIUM_READY promise not found from loader');
                throw new Error('CESIUM_READY promise not found');
              }
            } catch (error) {
              console.error('Error during Cesium script loading:', error);
              throw error;
            }
            
            console.log('Cesium script loaded');
          } catch (error) {
            console.error('Error loading Cesium:', error);
            setError('Failed to load Cesium. Please refresh the page and try again.');
            setLoading(false);
            return;
          }
        }
        
        // Wait for Cesium to be fully loaded
        const cesiumLoaded = await waitForCesium();
        if (!cesiumLoaded) {
          console.error('Failed to load Cesium via waitForCesium');
          setError('Failed to load Cesium. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
        
        // Set Cesium Ion access token
        window.Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_ACCESS_TOKEN || CESIUM_ACCESS_TOKEN;
        
        // Initialize the Cesium Viewer
        if (cesiumContainerRef.current && !viewerRef.current) {
          console.log('Initializing Cesium viewer');
          
          // Implement two-phase initialization for reliable loading
          console.log('Implementing two-phase Cesium initialization');
          
          // PHASE 1: Initialize with simple imagery and terrain that don't require Cesium Ion token
          console.log('PHASE 1: Creating Cesium viewer with basic configuration');
          
          // First, create a simple imagery provider to avoid the blue sphere
          const defaultImageryProvider = new window.Cesium.TileMapServiceImageryProvider({
            url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            maximumLevel: 5,
            credit: 'Cesium Natural Earth II'
          });
          
          const viewer = new window.Cesium.Viewer(cesiumContainerRef.current, {
            terrain: new window.Cesium.EllipsoidTerrainProvider(),
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            animation: false,
            creditContainer: document.createElement('div'), // Hide credits
            fullscreenButton: false,
            requestRenderMode: false, // Enable continuous rendering
            targetFrameRate: 60,
            imageryProvider: defaultImageryProvider // Use default imagery provider to start
          });
          
          // Store viewer reference
          viewerRef.current = viewer;
          
          // Set globe properties for better visibility
          viewer.scene.globe.enableLighting = false;
          viewer.scene.globe.baseColor = new window.Cesium.Color(0.0, 0.0, 0.2, 1.0); // Slight blue base color
          
          // Force render to ensure the globe appears
          viewer.scene.requestRender();
          
          // Ensure WebGL context is valid
          if (!viewer.scene.context || !viewer.scene.context.gl) {
            console.error('WebGL context is not available after viewer creation');
            setError('WebGL context initialization failed. Please check your browser settings or try a different browser.');
            setLoading(false);
            viewerRef.current = null;
            throw new Error('WebGL context initialization failed');
          }
          
          // Add event listener for WebGL context lost
          viewer.scene.canvas.addEventListener('webglcontextlost', function(event: Event) {
            console.error('WebGL context lost:', event);
            setError('WebGL context was lost. Please refresh the page.');
            // Prevent default behavior to allow for potential context restoration
            if (event.preventDefault) {
              event.preventDefault();
            }
            
            // Try to handle context restoration
            console.log('Attempting to handle WebGL context loss gracefully');
          }, false);
          
          // Add event listener for WebGL context restoration
          viewer.scene.canvas.addEventListener('webglcontextrestored', function(event: Event) {
            console.log('WebGL context restored:', event);
            // Clear error message if context is restored
            setError('');
            // Request a render to refresh the scene
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              viewerRef.current.scene.requestRender();
            }
          }, false);
          
          // Setup camera position - closer view for better visibility
          viewer.camera.setView({
            destination: window.Cesium.Cartesian3.fromDegrees(0, 0, 15000000),
            orientation: {
              heading: 0.0,
              pitch: -window.Cesium.Math.PI_OVER_TWO,
              roll: 0.0
            }
          });
          
          // Force another render after camera position change
          viewer.scene.requestRender();
          
          // PHASE 2: Schedule upgrade to higher quality imagery after confirming basic functionality
          console.log('PHASE 1 complete, scheduling PHASE 2 upgrade in 3 seconds');
          
          // Set a timeout to upgrade to higher quality imagery after 3 seconds
          initTimer = window.setTimeout(() => {
            try {
              console.log('PHASE 2: Upgrading to high-quality imagery');
              
              if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                // Set globe base color to transparent for better imagery visibility
                viewerRef.current.scene.globe.baseColor = new window.Cesium.Color(0, 0, 0, 0);
                
                // Verify the viewer is still valid before switching layers
                if (viewerRef.current.scene && viewerRef.current.scene.canvas) {
                  // Switch to the current active layer or default to Satellite
                  try {
                    switchLayer(activeLayer || 'Satellite');
                    console.log(`PHASE 2 complete: Upgraded to high-quality imagery with layer: ${activeLayer || 'Satellite'}`);
                  } catch (layerError) {
                    console.error('Error switching to high-quality imagery layer:', layerError);
                    // Fallback to Natural Earth II if layer switch fails
                    try {
                      console.log('Falling back to Natural Earth II imagery');
                      const fallbackProvider = new window.Cesium.TileMapServiceImageryProvider({
                        url: window.Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
                        maximumLevel: 5,
                        credit: 'Cesium Natural Earth II'
                      });
                      
                      // Clear existing layers
                      while (viewerRef.current.imageryLayers.length > 0) {
                        viewerRef.current.imageryLayers.remove(viewerRef.current.imageryLayers.get(0));
                      }
                      
                      // Add fallback layer
                      viewerRef.current.imageryLayers.addImageryProvider(fallbackProvider);
                      console.log('Fallback to Natural Earth II complete');
                    } catch (fallbackError) {
                      console.error('Even fallback imagery failed:', fallbackError);
                    }
                  }
                  
                  // Force a render to show the updated imagery
                  viewerRef.current.scene.requestRender();
                } else {
                  console.error('Viewer scene or canvas is not available for PHASE 2 upgrade');
                }
              } else {
                console.error('Viewer is no longer valid for PHASE 2 upgrade');
              }
            } catch (error) {
              console.error('Error during PHASE 2 upgrade:', error);
            }
          }, 3000);
          
          // Phase 2 will handle switching to the appropriate layer after initialization
          console.log('Initial Cesium viewer setup complete, waiting for Phase 2 to load high-quality imagery');
          
          // Force a render to show the globe
          viewer.scene.requestRender();
          
          console.log('Cesium viewer initialized successfully');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing Cesium viewer:', error);
        setError('Failed to initialize Earth Viewer. Please refresh the page and try again.');
        setLoading(false);
      }
    };
    
    // Call the initialization function
    initCesium().catch(error => {
      console.error('Unhandled error during Cesium initialization:', error);
      setError('Failed to initialize Earth Viewer. Please refresh the page and try again.');
      setLoading(false);
    });
    
    // Using the initTimer declared earlier in the component
    
    // Clean up function
    return () => {
      // Clear any pending initialization timers
      if (initTimer !== null) {
        console.log('Clearing pending initialization timer');
        window.clearTimeout(initTimer);
        initTimer = null;
      }
      
      // Clean up Cesium viewer when component unmounts
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        console.log('Destroying Cesium viewer');
        try {
          // Stop any active animations or camera flights
          if (viewerRef.current.clock) {
            viewerRef.current.clock.onTick.removeAll();
          }
          
          if (viewerRef.current.camera && viewerRef.current.camera.flyTo) {
            viewerRef.current.camera.cancelFlight();
          }
          
          // Remove all event listeners
          if (viewerRef.current.scene && viewerRef.current.scene.canvas) {
            viewerRef.current.scene.canvas.removeEventListener('webglcontextlost', () => {});
            viewerRef.current.scene.canvas.removeEventListener('webglcontextrestored', () => {});
          }
          
          // Remove all entities
          if (viewerRef.current.entities) {
            viewerRef.current.entities.removeAll();
          }
          
          // Remove all imagery layers first to prevent memory leaks
          while (viewerRef.current.imageryLayers && viewerRef.current.imageryLayers.length > 0) {
            viewerRef.current.imageryLayers.remove(viewerRef.current.imageryLayers.get(0), true);
          }
          
          // Destroy the viewer
          viewerRef.current.destroy();
          viewerRef.current = null;
        } catch (error) {
          console.error('Error during Cesium viewer cleanup:', error);
          // Still set the ref to null to prevent further access attempts
          viewerRef.current = null;
        }
      }
      
      // Clear any pending timers
      if (initTimer) {
        window.clearTimeout(initTimer);
      }
    };
  }, [activeLayer]); // Re-initialize if activeLayer changes
  
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

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Slider, FormControl, InputLabel,
  Select, MenuItem, SelectChangeEvent, Stack, Chip,
  IconButton, TextField, Autocomplete, CircularProgress
} from '@mui/material';
import {
  Timeline, Layers, Opacity, PlayArrow, Pause,
  ZoomIn, ZoomOut, Search, AddCircleOutline
} from '@mui/icons-material';
import {
  Ion, Viewer, createWorldTerrainAsync, createOsmBuildingsAsync, PolygonGraphics,
  Cartesian3, JulianDate, Clock, ClockRange,
  TimeIntervalCollection, TimeInterval, ImageryLayer,
  WebMapServiceImageryProvider, GeoJsonDataSource, Color,
  ColorMaterialProperty, ConstantProperty, ScreenSpaceEventHandler,
  ScreenSpaceEventType, defined, Rectangle, Math as CesiumMath
} from 'cesium';

// Import the CesiumComponentLibrary types
// Note: In a full implementation you'd use the Resium component library
// but for now we're using the direct Cesium API

// Import the SpatialDataClient
import { SpatialDataClient, SatelliteImage, WeatherData, EnvironmentalAnomaly } from '../api/SpatialDataClient';

// Note: You'll need to register for a Cesium ion access token at https://cesium.com/ion/
// and replace 'YOUR_CESIUM_ACCESS_TOKEN' with your actual token
// You'll need to register for a Cesium ion access token at https://cesium.com/ion/
const CESIUM_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWY0LTQzN2YtOGNkNC0yYTVmZjEwZGJmM2QiLCJpZCI6MTYyMTY3LCJpYXQiOjE2OTY5MDk2MTZ9.jaESQs38ACb1-OXgPt-FA-lARxYzBr_NLzEEZ7C27KQ';

// Create the API client
const apiClient = new SpatialDataClient('/api/v1');

const EarthViewerPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dataLayer, setDataLayer] = useState('satellite');
  const [timePoint, setTimePoint] = useState<Date>(new Date());
  const [opacity, setOpacity] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [satelliteImages, setSatelliteImages] = useState<SatelliteImage[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [anomalies, setAnomalies] = useState<EnvironmentalAnomaly[]>([]);
  const [dataLayerOptions, setDataLayerOptions] = useState<string[]>(['satellite', 'weather', 'anomalies']);
  const [weatherTypes, setWeatherTypes] = useState<string[]>([]);
  const [anomalyTypes, setAnomalyTypes] = useState<string[]>([]);
  const [selectedWeatherType, setSelectedWeatherType] = useState<string>('');
  const [selectedAnomalyType, setSelectedAnomalyType] = useState<string>('');
  
  const [availableRegions] = useState([
    'San Francisco Bay Area',
    'Amazon Rainforest',
    'Arctic Ice Cap',
    'Great Barrier Reef',
    'Sahara Desert',
    'Himalayas',
    'Mediterranean Sea'
  ]);
  
  // Map region names to bounding boxes [west, south, east, north]
  const regionBounds: Record<string, [number, number, number, number]> = {
    'San Francisco Bay Area': [-122.5, 37.7, -122.2, 37.9],
    'Amazon Rainforest': [-60.0, -3.0, -59.7, -2.7],
    'Arctic Ice Cap': [-160.0, 70.0, -140.0, 80.0],
    'Great Barrier Reef': [145.0, -18.0, 147.0, -16.0],
    'Sahara Desert': [2.0, 25.0, 5.0, 28.0],
    'Himalayas': [80.0, 27.0, 85.0, 29.0],
    'Mediterranean Sea': [12.0, 38.0, 15.0, 41.0]
  };

  const viewerRef = useRef<Viewer | null>(null);
  const cesiumContainerRef = useRef<HTMLDivElement>(null);

  // Configure Cesium Ion access token
  useEffect(() => {
    Ion.defaultAccessToken = CESIUM_ACCESS_TOKEN;
  }, []);

  // Fetch available data types
  useEffect(() => {
    const fetchDataTypes = async () => {
      try {
        setLoading(true);
        
        // Fetch weather data types
        const weatherTypes = await apiClient.getWeatherDataTypes();
        setWeatherTypes(weatherTypes);
        if (weatherTypes.length > 0) {
          setSelectedWeatherType(weatherTypes[0]);
        }
        
        // Fetch anomaly types
        const anomalyTypes = await apiClient.getAnomalyTypes();
        setAnomalyTypes(anomalyTypes);
        if (anomalyTypes.length > 0) {
          setSelectedAnomalyType(anomalyTypes[0]);
        }
      } catch (error) {
        console.error('Error fetching data types:', error);
        // Set default values in case API fails
        setWeatherTypes(['Temperature', 'Precipitation', 'Wind Speed', 'Cloud Cover']);
        setAnomalyTypes(['Wildfire', 'Deforestation', 'Flooding', 'Drought']);
        setSelectedWeatherType('Temperature');
        setSelectedAnomalyType('Wildfire');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDataTypes();
  }, []);
  
  // Update viewer when timePoint changes
  useEffect(() => {
    if (viewerRef.current && viewerRef.current.clock) {
      viewerRef.current.clock.currentTime = JulianDate.fromDate(timePoint);
    }
  }, [timePoint]);
  
  // Initialize Cesium viewer
  useEffect(() => {
    if (cesiumContainerRef.current && !viewerRef.current) {
      try {
        setLoading(true);
        
        // Create the Cesium Viewer
        const viewer = new Viewer(cesiumContainerRef.current, {
          // Initialize without terrain, we'll add it after creation
          timeline: true,
          animation: true,
          sceneModePicker: true,
          baseLayerPicker: true,
          navigationHelpButton: false,
          homeButton: true,
          geocoder: true,
          fullscreenButton: true,
          // Improve performance
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity
        });

        // Configure the clock to use a specific start and end time
        const start = JulianDate.fromDate(new Date(Date.UTC(2023, 0, 1)));
        const end = JulianDate.fromDate(new Date());
        
        viewer.clock.startTime = start;
        viewer.clock.stopTime = end;
        viewer.clock.currentTime = JulianDate.fromDate(timePoint);
        viewer.clock.clockRange = ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 3600 * 24; // 1 day per second
        viewer.timeline.zoomTo(start, end);
        
        // Disable depth testing for entities so they show through the terrain
        viewer.scene.globe.depthTestAgainstTerrain = false;
        
        // Add 3D buildings
        createOsmBuildingsAsync().then(buildingTileset => {
          if (viewerRef.current) {
            viewerRef.current.scene.primitives.add(buildingTileset);
          }
        }).catch(error => {
          console.error("Error loading 3D buildings:", error);
        });
        
        // Set default view (whole Earth)
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(0, 0, 20000000),
          complete: () => {
            setLoading(false);
          }
        });

        // Store the viewer reference
        viewerRef.current = viewer;
        
        // Add terrain
        createWorldTerrainAsync().then(terrain => {
          if (viewerRef.current) {
            viewerRef.current.terrainProvider = terrain;
          }
        }).catch(error => {
          console.error('Error loading terrain:', error);
        });
      } catch (error) {
        console.error("Error initializing Cesium viewer:", error);
        setLoading(false);
      }
    }

    // Cleanup
    return () => {
      if (viewerRef.current) {
        // Clean up event handlers
        if (viewerRef.current.screenSpaceEventHandler) {
          viewerRef.current.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.WHEEL);
        }
        
        // Clean up dataSources
        viewerRef.current.dataSources.removeAll();
        
        // Destroy the viewer
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [timePoint]);

  // Fetch data based on the current view bounds
  const fetchDataForCurrentView = useCallback(async () => {
    if (!viewerRef.current) return;
    
    // Get the current camera view rectangle
    const rectangle = viewerRef.current.camera.computeViewRectangle();
    if (!rectangle) return;
    
    // Convert to degrees
    const west = CesiumMath.toDegrees(rectangle.west);
    const south = CesiumMath.toDegrees(rectangle.south);
    const east = CesiumMath.toDegrees(rectangle.east);
    const north = CesiumMath.toDegrees(rectangle.north);
    
    try {
      setLoading(true);
      
      // Convert timePoint to ISO string for API requests
      const timeString = timePoint.toISOString();
      const startDate = new Date(timePoint);
      startDate.setDate(startDate.getDate() - 30); // 30 days before
      const startDateString = startDate.toISOString();
      
      // Fetch data based on the active layer
      if (dataLayer === 'satellite') {
        const params = {
          bbox_min_lon: west,
          bbox_min_lat: south,
          bbox_max_lon: east,
          bbox_max_lat: north,
          start_date: startDateString,
          end_date: timeString,
          max_cloud_cover: 30
        };
        
        const images = await apiClient.getSatelliteImages(params);
        setSatelliteImages(images);
        
        // Add satellite imagery to the viewer
        if (viewerRef.current) {
          // Remove existing satellite layers
          removeDataLayers('satellite');
          
          // Add satellite footprints as GeoJSON
          if (images.length > 0) {
            const dataSource = new GeoJsonDataSource('satellite-footprints');
            const features = images.map(image => ({
              type: 'Feature',
              geometry: image.footprint,
              properties: {
                id: image.id,
                source: image.source,
                date: image.acquisition_date,
                cloud_cover: image.cloud_cover_percentage
              }
            }));
            
            const geoJson = {
              type: 'FeatureCollection',
              features
            };
            
            await dataSource.load(geoJson as any, {
              stroke: Color.BLUE,
              fill: Color.BLUE.withAlpha(0.3),
              strokeWidth: 2
            });
            
            viewerRef.current.dataSources.add(dataSource);
          }
        }
      } else if (dataLayer === 'weather' && selectedWeatherType) {
        const params = {
          data_type: selectedWeatherType,
          bbox_min_lon: west,
          bbox_min_lat: south,
          bbox_max_lon: east,
          bbox_max_lat: north,
          timestamp: timeString
        };
        
        const heatmapData = await apiClient.getWeatherHeatmap(params);
        
        if (viewerRef.current) {
          // Remove existing weather layers
          removeDataLayers('weather');
          
          // Add weather data as a WMS layer or heatmap
          // This is a simplified example - in a real implementation,
          // you would create a proper visualization for the heatmap data
          const layer = new ImageryLayer(
            new WebMapServiceImageryProvider({
              url: 'https://neo.gsfc.nasa.gov/wms/wms',
              layers: 'MOD_LSTD_CLIM_M',
              parameters: {
                transparent: 'true',
                format: 'image/png'
              }
            }),
            {
              alpha: opacity / 100
            }
          );
          
          viewerRef.current.scene.imageryLayers.add(layer);
          // Assign custom metadata safely
          (layer as any)._layerName = 'weather-layer';
          
        }
      } else if (dataLayer === 'anomalies') {
        const params = {
          anomaly_type: selectedAnomalyType || undefined,
          bbox_min_lon: west,
          bbox_min_lat: south,
          bbox_max_lon: east,
          bbox_max_lat: north,
          start_date: startDateString,
          end_date: timeString
        };
        
        const anomaliesData = await apiClient.getAnomalies(params);
        setAnomalies(anomaliesData);
        
        if (viewerRef.current) {
          // Remove existing anomaly layers
          removeDataLayers('anomalies');
          
          // Add anomalies as GeoJSON
          if (anomaliesData.length > 0) {
            const dataSource = new GeoJsonDataSource('anomalies');
            const features = anomaliesData.map(anomaly => ({
              type: 'Feature',
              geometry: anomaly.location,
              properties: {
                id: anomaly.id,
                type: anomaly.anomaly_type,
                date: anomaly.detection_date,
                confidence: anomaly.confidence_score,
                severity: anomaly.severity,
                description: anomaly.description
              }
            }));
            
            const geoJson = {
              type: 'FeatureCollection',
              features
            };
            
            await dataSource.load(geoJson as any, {
              stroke: Color.RED,
              fill: Color.RED.withAlpha(0.5),
              strokeWidth: 3
            });
            
            viewerRef.current.dataSources.add(dataSource);
            
            // Style the entities based on anomaly type and severity
            dataSource.entities.values.forEach((entity) => {
              const severity = entity.properties?.severity?.getValue();
              if (severity === 'high' && entity.polygon) {
                // Apply styling directly without instanceof check
                entity.polygon.material = new ColorMaterialProperty(Color.RED.withAlpha(0.7));
                entity.polygon.outlineColor = new ConstantProperty(Color.RED);
                entity.polygon.outlineWidth = new ConstantProperty(2);
              }
            });
            
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching ${dataLayer} data:`, error);
    } finally {
      setLoading(false);
    }
  }, [dataLayer, selectedWeatherType, selectedAnomalyType, timePoint, opacity]);
  
  // Remove data layers of a specific type
  const removeDataLayers = (layerType: string) => {
    if (!viewerRef.current) return;
    
    if (layerType === 'satellite' || layerType === 'all') {
      // Remove satellite footprints
      viewerRef.current.dataSources.removeAll();
    }
    
    if (layerType === 'weather' || layerType === 'all') {
      // Remove weather layers
      const imageryLayers = viewerRef.current.scene.imageryLayers;
      for (let i = 0; i < imageryLayers.length; i++) {
        const layer = imageryLayers.get(i);
        // Use custom property to identify weather layers
        if ((layer as any)._layerName === 'weather-layer') {
          imageryLayers.remove(layer);
          i--; // Adjust index after removal
        }
      }
    }
    
    if (layerType === 'anomalies' || layerType === 'all') {
      // Remove anomaly data sources
      for (let i = 0; i < viewerRef.current.dataSources.length; i++) {
        const dataSource = viewerRef.current.dataSources.get(i);
        // Use type assertion for dataSource.name
        if ((dataSource as any).name === 'anomalies') {
          viewerRef.current.dataSources.remove(dataSource);
          i--; // Adjust index after removal
        }
      }
    }
  };
  
  // Handle camera move end event to fetch new data
  useEffect(() => {
    if (viewerRef.current) {
      try {
        // Set up event handler for camera movement
        const handler = new ScreenSpaceEventHandler(viewerRef.current.scene.canvas);
        
        // Fetch data when user stops moving the camera (wheel input)
        handler.setInputAction(() => {
          fetchDataForCurrentView();
        }, ScreenSpaceEventType.WHEEL);
        
        // Add handler for camera move end
        viewerRef.current.camera.moveEnd.addEventListener(() => {
          fetchDataForCurrentView();
        });
        
        // Also fetch data when the component mounts
        fetchDataForCurrentView();
        
        return () => {
          // Clean up event handlers
          handler.destroy();
          
          if (viewerRef.current) {
            // TypeScript doesn't know about moveEnd.removeEventListener
            // @ts-ignore
            if (viewerRef.current.camera.moveEnd.removeEventListener) {
              // @ts-ignore
              viewerRef.current.camera.moveEnd.removeEventListener();
            }
          }
        };
      } catch (error) {
        console.error("Error setting up camera event handlers:", error);
      }
    }
  }, [fetchDataForCurrentView]);
  
  // Handle data layer change
  const handleDataLayerChange = (event: SelectChangeEvent) => {
    const newLayer = event.target.value as string;
    setDataLayer(newLayer);
    
    // Remove existing layers and fetch new data
    if (viewerRef.current) {
      removeDataLayers('all');
      fetchDataForCurrentView();
    }
  };

  // Handle opacity change
  const handleOpacityChange = (_event: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    setOpacity(value);
    
    if (viewerRef.current && dataLayer === 'weather') {
      // Update opacity of weather layers
      const imageryLayers = viewerRef.current.scene.imageryLayers;
      for (let i = 0; i < imageryLayers.length; i++) {
        const layer = imageryLayers.get(i);
        // Use custom property to identify weather layers
        if ((layer as any)._layerName === 'weather-layer') {
          layer.alpha = value / 100;
        }
      }
    } else if (viewerRef.current && dataLayer === 'satellite') {
      // Update opacity of satellite imagery
      const dataSources = viewerRef.current.dataSources;
      for (let i = 0; i < dataSources.length; i++) {
        const dataSource = dataSources.get(i);
        // Use type assertion for dataSource.name
        if ((dataSource as any).name === 'satellite-footprints') {
          dataSource.entities.values.forEach(entity => {
            if (entity.polygon) {
              const color = Color.BLUE.withAlpha(value / 100 * 0.3);
              entity.polygon.material = new ColorMaterialProperty(color);
            }
          });
        }
      }
    } else if (viewerRef.current && dataLayer === 'anomalies') {
      // Update opacity of anomalies
      const dataSources = viewerRef.current.dataSources;
      for (let i = 0; i < dataSources.length; i++) {
        const dataSource = dataSources.get(i);
        // Use type assertion for dataSource.name
        if ((dataSource as any).name === 'anomalies') {
          dataSource.entities.values.forEach(entity => {
            if (entity.polygon) {
              const alphaValue = value / 100 * 0.5;
              const severity = entity.properties?.severity?.getValue();
              
              if (severity === 'high') {
                entity.polygon.material = new ColorMaterialProperty(Color.RED.withAlpha(alphaValue * 1.4));
              } else if (severity === 'medium') {
                entity.polygon.material = new ColorMaterialProperty(Color.ORANGE.withAlpha(alphaValue * 1.2));
              } else {
                entity.polygon.material = new ColorMaterialProperty(Color.YELLOW.withAlpha(alphaValue));
              }
            }
          });
        }
      }
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (viewerRef.current) {
      if (playing) {
        viewerRef.current.clock.shouldAnimate = false;
      } else {
        viewerRef.current.clock.shouldAnimate = true;
      }
      setPlaying(!playing);
    }
  };

  // Handle region selection
  const handleRegionChange = (_event: React.SyntheticEvent, newValue: string[]) => {
    setRegions(newValue);
    
    // Fly to the selected region (or first one if multiple are selected)
    if (viewerRef.current && newValue.length > 0) {
      const regionName = newValue[0];
      const bounds = regionBounds[regionName];
      
      if (bounds) {
        const [west, south, east, north] = bounds;
        viewerRef.current.camera.flyTo({
          destination: Rectangle.fromDegrees(west, south, east, north),
          duration: 2
        });
      }
    }
  };

  // Handle weather type change
  const handleWeatherTypeChange = (event: SelectChangeEvent) => {
    setSelectedWeatherType(event.target.value);
    if (dataLayer === 'weather') {
      fetchDataForCurrentView();
    }
  };

  // Handle anomaly type change
  const handleAnomalyTypeChange = (event: SelectChangeEvent) => {
    setSelectedAnomalyType(event.target.value);
    if (dataLayer === 'anomalies') {
      fetchDataForCurrentView();
    }
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setTimePoint(date);
    fetchDataForCurrentView();
  };

  // Handle search
  const handleSearch = () => {
    if (!searchQuery || !viewerRef.current) return;
    
    try {
      // Check if the search query matches a known region
      const matchedRegion = availableRegions.find(
        region => region.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchedRegion) {
        // Add to selected regions if not already added
        if (!regions.includes(matchedRegion)) {
          setRegions([...regions, matchedRegion]);
        }
        
        const bounds = regionBounds[matchedRegion];
        
        if (bounds) {
          const [west, south, east, north] = bounds;
          viewerRef.current.camera.flyTo({
            destination: Rectangle.fromDegrees(west, south, east, north),
            duration: 2,
            complete: () => {
              // Fetch data for the new view after camera movement completes
              fetchDataForCurrentView();
            }
          });
        }
        return;
      }
      
      // For simplicity, we'll just fly to a predefined location
      // In a real implementation, this would use a geocoding service
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(-122.4, 37.8, 15000),
        duration: 2
      });
      
      // Clear search query after search
      setSearchQuery('');
    } catch (error) {
      console.error("Error in search:", error);
    }
  };
  
  // Add key press handler for search
  const handleSearchKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };



  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Control Panel */}
      <Paper 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 2, 
          borderRadius: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          backgroundColor: 'background.paper',
          zIndex: 10
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
          {/* Data Layer Selector */}
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel id="data-layer-label">Data Layer</InputLabel>
            <Select
              labelId="data-layer-label"
              value={dataLayer}
              label="Data Layer"
              onChange={handleDataLayerChange}
            >
              <MenuItem value="satellite">Satellite Imagery</MenuItem>
              <MenuItem value="weather">Weather Data</MenuItem>
              <MenuItem value="anomalies">Environmental Anomalies</MenuItem>
            </Select>
          </FormControl>
          
          {/* Opacity Control */}
          <Box sx={{ display: 'flex', alignItems: 'center', width: 150 }}>
            <Opacity sx={{ mr: 1, color: 'text.secondary' }} />
            <Slider
              value={opacity}
              onChange={handleOpacityChange}
              aria-label="Layer Opacity"
              valueLabelDisplay="auto"
            />
          </Box>
          
          {/* Timeline Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={handlePlayPause} color="primary">
              {playing ? <Pause /> : <PlayArrow />}
            </IconButton>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {timePoint.toLocaleDateString()}
            </Typography>
          </Box>
          
          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Region Selection */}
          <Autocomplete
            multiple
            size="small"
            sx={{ width: 300 }}
            options={availableRegions}
            value={regions}
            onChange={handleRegionChange}
            renderInput={(params) => (
              <TextField {...params} label="Regions" placeholder="Add region" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
          
          {/* Search */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search location"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              sx={{ width: 200 }}
            />
            <IconButton onClick={handleSearch} color="primary">
              <Search />
            </IconButton>
          </Box>
        </Box>
      </Paper>


      
      {/* Data Layer Stats */}
      <Paper 
        sx={{ 
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          p: 1,
          maxWidth: 300
        }}
      >
        {dataLayer === 'satellite' && (
          <>
            <Typography variant="subtitle2">Satellite Images</Typography>
            <Typography variant="body2">{satelliteImages.length} images available</Typography>
          </>
        )}
        {dataLayer === 'weather' && (
          <>
            <Typography variant="subtitle2">Weather Data: {selectedWeatherType}</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="weather-type-label">Weather Type</InputLabel>
              <Select
                labelId="weather-type-label"
                value={selectedWeatherType}
                label="Weather Type"
                onChange={handleWeatherTypeChange}
              >
                {weatherTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
        {dataLayer === 'anomalies' && (
          <>
            <Typography variant="subtitle2">Environmental Anomalies</Typography>
            <Typography variant="body2">{anomalies.length} anomalies detected</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="anomaly-type-label">Anomaly Type</InputLabel>
              <Select
                labelId="anomaly-type-label"
                value={selectedAnomalyType}
                label="Anomaly Type"
                onChange={handleAnomalyTypeChange}
              >
                <MenuItem value="">All Types</MenuItem>
                {anomalyTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
      </Paper>
      
      {/* Cesium Viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
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
              zIndex: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            }}
          >
            <CircularProgress />
            <Typography variant="h6" sx={{ ml: 2 }}>
              Loading Earth data...
            </Typography>
          </Box>
        )}
        <div 
          ref={cesiumContainerRef} 
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
        
        {/* Zoom Controls */}
        <Paper 
          sx={{ 
            position: 'absolute', 
            right: 16, 
            top: '50%', 
            transform: 'translateY(-50%)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            p: 0.5
          }}
        >
          <IconButton onClick={() => {
            if (viewerRef.current) {
              // Move the camera closer to the Earth
              const currentPosition = viewerRef.current.camera.position;
              const direction = viewerRef.current.camera.direction;
              const scaledDirection = Cartesian3.multiplyByScalar(direction, 100000, new Cartesian3());
              const newPosition = Cartesian3.add(currentPosition, scaledDirection, new Cartesian3());
              viewerRef.current.camera.flyTo({ destination: newPosition, duration: 0.5 });
            }
          }} color="primary">
            <ZoomIn />
          </IconButton>
          <IconButton onClick={() => {
            if (viewerRef.current) {
              // Move the camera farther from the Earth
              const currentPosition = viewerRef.current.camera.position;
              const direction = viewerRef.current.camera.direction;
              const scaledDirection = Cartesian3.multiplyByScalar(direction, -100000, new Cartesian3());
              const newPosition = Cartesian3.add(currentPosition, scaledDirection, new Cartesian3());
              viewerRef.current.camera.flyTo({ destination: newPosition, duration: 0.5 });
            }
          }} color="primary">
            <ZoomOut />
          </IconButton>
        </Paper>
        
        {/* Layer Controls */}
        <Paper 
          sx={{ 
            position: 'absolute', 
            left: 16, 
            top: 16,
            zIndex: 10,
            p: 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Layers sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="subtitle2">Layers</Typography>
          </Box>
          
          <Stack spacing={1}>
            <Chip 
              label="Base Map" 
              variant="outlined" 
              size="small" 
              color="primary" 
              onDelete={() => {
                // In a real application, this would toggle the base map layer visibility
                if (viewerRef.current) {
                  // Toggle base layer visibility logic would go here
                  console.log('Toggle base map visibility');
                }
              }}
            />
            <Chip 
              label="Terrain" 
              variant="outlined" 
              size="small" 
              color="primary" 
              onDelete={() => {
                // In a real application, this would toggle the terrain layer visibility
                if (viewerRef.current) {
                  // Toggle terrain visibility logic would go here
                  console.log('Toggle terrain visibility');
                }
              }}
            />
            <Chip 
              label="Satellite Imagery" 
              variant="outlined" 
              size="small" 
              color="primary" 
              onDelete={() => {
                // In a real application, this would toggle the satellite imagery layer visibility
                if (viewerRef.current) {
                  // Toggle satellite imagery visibility logic would go here
                  console.log('Toggle satellite imagery visibility');
                }
              }}
            />
            <Chip 
              icon={<AddCircleOutline />} 
              label="Add Layer" 
              variant="outlined" 
              size="small" 
              onClick={() => {
                // In a real application, this would open a dialog to add custom layers
                console.log('Add custom layer');
                // Implementation would depend on application requirements
              }}
            />
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default EarthViewerPage;

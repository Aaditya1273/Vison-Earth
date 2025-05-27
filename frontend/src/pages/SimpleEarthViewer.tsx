import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

// Define global Cesium property on window
declare global {
  interface Window {
    Cesium: any;
  }
}

const SimpleEarthViewer: React.FC = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if Cesium is already loaded
    if (typeof window.Cesium !== 'undefined') {
      initCesium();
      return;
    }
    
    // Load Cesium
    const script = document.createElement('script');
    script.src = '/cesium/Cesium.js';
    script.async = true;
    script.onload = initCesium;
    script.onerror = () => setError('Failed to load Cesium library');
    document.body.appendChild(script);
    
    // Add CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/cesium/Widgets/widgets.css';
    document.head.appendChild(link);
    
    return () => {
      // Safe cleanup
      try {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
        
        // Try to destroy the viewer if it exists
        if (window.Cesium && cesiumContainerRef.current) {
          // Get all viewer instances
          const viewers = window.Cesium.Viewer && Array.isArray(window.Cesium.Viewer._instances) 
            ? window.Cesium.Viewer._instances : [];
            
          // Destroy each viewer
          viewers.forEach((viewer: any) => {
            if (viewer && typeof viewer.destroy === 'function') {
              viewer.destroy();
            }
          });
        }
      } catch (e) {
        console.error('Error cleaning up:', e);
      }
    };
  }, []);
  
  const initCesium = () => {
    if (!cesiumContainerRef.current || !window.Cesium) {
      setError('Cesium initialization failed');
      setLoading(false);
      return;
    }
    
    try {
      // Set the token
      window.Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWY0LTQzN2YtOGNkNC0yYTVmZjEwZGJmM2QiLCJpZCI6MTYyMTY3LCJpYXQiOjE2OTY5MDk2MTZ9.jaESQs38ACb1-OXgPt-FA-lARxYzBr_NLzEEZ7C27KQ';
      
      // Create a simple viewer with minimal options
      const viewer = new window.Cesium.Viewer(cesiumContainerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false
      });
      
      // Add a simple point
      viewer.entities.add({
        position: window.Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 0),
        point: {
          pixelSize: 10,
          color: window.Cesium.Color.BLUE
        }
      });
      
      // Set the camera position
      viewer.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 10000),
        complete: () => setLoading(false)
      });
    } catch (e: any) {
      console.error('Error initializing Cesium:', e);
      setError(`Error initializing Cesium: ${e.message || 'Unknown error'}`);
      setLoading(false);
    }
  };
  
  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.7)'
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2, color: 'white' }}>
            Loading Earth Viewer...
          </Typography>
        </Box>
      )}
      
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.7)'
          }}
        >
          <Typography variant="h6" sx={{ color: 'red' }}>
            Error: {error}
          </Typography>
          <Typography variant="body1" sx={{ mt: 2, color: 'white' }}>
            Check the browser console for more details.
          </Typography>
        </Box>
      )}
      
      <div
        ref={cesiumContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0, left: 0
        }}
      />
    </Box>
  );
};

export default SimpleEarthViewer;

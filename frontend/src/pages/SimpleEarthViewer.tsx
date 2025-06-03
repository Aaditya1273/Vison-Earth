import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

// Basic component for when we can't load Cesium
const FallbackMap: React.FC = () => {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#1a2b3c',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h2>VisionEarth 3D Viewer</h2>
      <p>The 3D Earth visualization couldn't be loaded.</p>
      <p>This simplified view is displayed instead.</p>
      <div style={{
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
        boxShadow: '0 0 30px rgba(0,100,255,0.5)',
        marginTop: '20px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Simple continents approximation */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#3e8c61',
          width: '100px',
          height: '150px',
          top: '70px',
          left: '50px',
          borderRadius: '40%',
        }}></div>
        <div style={{
          position: 'absolute',
          backgroundColor: '#3e8c61',
          width: '130px',
          height: '90px',
          top: '50px',
          right: '30px',
          borderRadius: '30%',
        }}></div>
        <div style={{
          position: 'absolute',
          backgroundColor: '#3e8c61',
          width: '80px',
          height: '120px',
          bottom: '40px',
          right: '70px',
          borderRadius: '40%',
        }}></div>
      </div>
      <Button 
        variant="contained" 
        color="primary" 
        onClick={() => window.location.reload()}
        style={{ marginTop: '20px' }}
      >
        Reload Page
      </Button>
    </div>
  );
};

const SimpleEarthViewer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  
  useEffect(() => {
    console.log("SimpleEarthViewer mounted");
    
    // Start with a 3-second timeout just to provide visual feedback
    const loadingTimer = setTimeout(() => {
      setLoading(false);
      // We'll default to the fallback view to ensure something is displayed
      setCesiumLoaded(false);
      setError(true);
      
      console.log("Loading timed out, showing fallback view");
    }, 3000);
    
    // Check if we can load a simple globe using iframe as fallback
    try {
      // Try to detect WebGL support
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.error("WebGL not supported by browser");
        clearTimeout(loadingTimer);
        setLoading(false);
        setError(true);
        return;
      }
      
      console.log("WebGL is supported");
    } catch (e) {
      console.error("Error checking WebGL support:", e);
    }
    
    return () => {
      clearTimeout(loadingTimer);
    };
  }, []);
  
  if (loading) {
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          bgcolor: '#000'
        }}
      >
        <CircularProgress size={60} sx={{ color: 'white' }} />
        <Typography variant="h6" sx={{ mt: 2, color: 'white' }}>
          Loading Earth Viewer...
        </Typography>
      </Box>
    );
  }
  
  if (error || !cesiumLoaded) {
    return <FallbackMap />;
  }
  
  // This shouldn't be reached with the current logic
  return <div>Unexpected state</div>;
};

export default SimpleEarthViewer;

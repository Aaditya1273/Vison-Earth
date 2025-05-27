import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

// Declare global Cesium on window
declare global {
  interface Window {
    Cesium?: any;
  }
}

// Component for an interactive stylized Earth when Cesium fails
const StylizedEarthViewer: React.FC = () => {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const earthRef = useRef<HTMLDivElement>(null);
  
  // Rotate the Earth continuously
  useEffect(() => {
    if (!isDragging) {
      const interval = setInterval(() => {
        setRotation(prev => (prev + 0.2) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isDragging]);
  
  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastX(e.clientX);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - lastX;
      setRotation(prev => (prev + deltaX * 0.5) % 360);
      setLastX(e.clientX);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#0a1522',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      <Typography variant="h4" sx={{ color: 'white', mb: 2 }}>
        VisionEarth Viewer
      </Typography>
      
      <Typography variant="body1" sx={{ color: '#aacbff', mb: 4, textAlign: 'center' }}>
        Interactive Earth Visualization
      </Typography>
      
      <div 
        ref={earthRef}
        style={{
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #4287f5 0%, #254e91 40%, #0a1f3b 90%)',
          boxShadow: '0 0 50px rgba(33,150,243,0.4), inset 0 0 50px rgba(0,0,0,0.8)',
          position: 'relative',
          transform: `rotateY(${rotation}deg)`,
          transformStyle: 'preserve-3d',
          cursor: isDragging ? 'grabbing' : 'grab',
          margin: '20px 0'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* North America */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#2e7d32',
          width: '100px',
          height: '120px',
          top: '70px',
          left: '70px',
          borderRadius: '40%',
          transform: 'rotateY(0deg) translateZ(1px)',
        }}></div>
        
        {/* South America */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#2e7d32',
          width: '70px',
          height: '120px',
          top: '180px',
          left: '100px',
          borderRadius: '60% 40% 40% 20%',
          transform: 'rotateY(0deg) translateZ(1px)',
        }}></div>
        
        {/* Europe/Africa */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#2e7d32',
          width: '90px',
          height: '200px',
          top: '80px',
          left: '170px',
          borderRadius: '40% 60% 60% 40%',
          transform: 'rotateY(0deg) translateZ(1px)',
        }}></div>
        
        {/* Asia/Australia */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#2e7d32',
          width: '140px',
          height: '150px',
          top: '60px',
          left: '230px',
          borderRadius: '40% 30% 50% 40%',
          transform: 'rotateY(0deg) translateZ(1px)',
        }}></div>
        
        {/* Australia */}
        <div style={{
          position: 'absolute',
          backgroundColor: '#2e7d32',
          width: '60px',
          height: '50px',
          top: '210px',
          left: '250px',
          borderRadius: '40%',
          transform: 'rotateY(0deg) translateZ(1px)',
        }}></div>
        
        {/* Cloud effects */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 80%, rgba(255,255,255,0.2) 100%)',
          transform: 'rotateY(0deg) translateZ(2px)',
        }}></div>
      </div>
      
      <Typography variant="body2" sx={{ color: '#8ac0ff', mt: 2, mb: 2, textAlign: 'center' }}>
        Drag the globe to rotate it or wait for the animation
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => window.location.reload()}
        >
          Reload Earth Viewer
        </Button>
        
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={() => {
            // Reset rotation speed if it was dragged
            setIsDragging(false);
            // Set a random rotation to create a jump effect
            setRotation(Math.random() * 360);
          }}
        >
          Random View
        </Button>
      </Box>
    </div>
  );
};

// Main Earth Viewer component
const SimpleEarthViewer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  
  // Check for WebGL support
  const checkWebGLSupport = (): boolean => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || 
                canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      console.error("Error checking WebGL support:", e);
      return false;
    }
  };
  
  // Initialize Cesium if available
  const initCesium = () => {
    if (!cesiumContainerRef.current) return;
    if (!window.Cesium) {
      console.error("Cesium is not loaded");
      setError("Cesium library not found");
      setLoading(false);
      return;
    }
    
    try {
      // Set Cesium Ion access token
      window.Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWY0LTQzN2YtOGNkNC0yYTVmZjEwZGJmM2QiLCJpZCI6MTYyMTY3LCJpYXQiOjE2OTY5MDk2MTZ9.jaESQs38ACb1-OXgPt-FA-lARxYzBr_NLzEEZ7C27KQ';
      
      // Create Cesium viewer with minimal options
      const viewer = new window.Cesium.Viewer(cesiumContainerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false
      });
      
      // Add a simple entity
      viewer.entities.add({
        position: window.Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 0),
        point: {
          pixelSize: 10,
          color: window.Cesium.Color.BLUE
        }
      });
      
      // Set camera position
      viewer.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 10000000),
        complete: () => setLoading(false)
      });
      
      // Return cleanup function
      return () => {
        if (viewer && typeof viewer.destroy === 'function') {
          viewer.destroy();
        }
      };
    } catch (e: any) {
      console.error("Error initializing Cesium:", e);
      setError(`Cesium initialization failed: ${e.message || 'Unknown error'}`);
      setLoading(false);
    }
  };
  
  useEffect(() => {
    console.log("SimpleEarthViewer component mounted");
    
    // First check WebGL support
    const webglSupport = checkWebGLSupport();
    setWebglSupported(webglSupport);
    
    if (!webglSupport) {
      console.error("WebGL is not supported by your browser");
      setError("WebGL is not supported by your browser");
      setLoading(false);
      return;
    }
    
    // Try loading Cesium - set a timeout for fallback
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn("Cesium loading timed out, showing fallback");
        setError("Cesium loading timed out");
        setLoading(false);
      }
    }, 5000); // 5 second timeout
    
    // Try to load Cesium if it's not already loaded
    if (typeof window.Cesium !== 'undefined') {
      console.log("Cesium already loaded, initializing...");
      const cleanup = initCesium();
      return () => {
        clearTimeout(timeoutId);
        if (cleanup) cleanup();
      };
    }
    
    // Cesium not loaded, try loading it
    console.log("Loading Cesium script...");
    const script = document.createElement('script');
    script.src = '/cesium/Cesium.js'; // Adjust path if needed
    script.async = true;
    
    script.onload = () => {
      console.log("Cesium script loaded successfully");
      const cleanup = initCesium();
      if (cleanup && typeof cleanup === 'function') {
        // Store cleanup function
        window._cesiumCleanup = cleanup;
      }
    };
    
    script.onerror = (e) => {
      console.error("Failed to load Cesium script:", e);
      setError("Failed to load Cesium library");
      setLoading(false);
    };
    
    document.body.appendChild(script);
    
    // Also add Cesium CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/cesium/Widgets/widgets.css'; // Adjust path if needed
    document.head.appendChild(link);
    
    return () => {
      clearTimeout(timeoutId);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
      // Call cleanup function if it exists
      if (window._cesiumCleanup && typeof window._cesiumCleanup === 'function') {
        window._cesiumCleanup();
        delete window._cesiumCleanup;
      }
    };
  }, [loading]);
  
  // Show loading state
  if (loading) {
    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#0a1522'
      }}>
        <CircularProgress size={60} sx={{ color: '#4dabf5' }} />
        <Typography variant="h6" sx={{ mt: 3, color: 'white' }}>
          Loading Earth Viewer...
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: '#aacbff' }}>
          Initializing 3D globe visualization
        </Typography>
      </Box>
    );
  }
  
  // Show error state with fallback
  if (error || webglSupported === false) {
    console.log("Showing fallback Earth view due to error:", error);
    return <StylizedEarthViewer />;
  }
  
  // Show Cesium container - this will be populated by Cesium
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div 
        ref={cesiumContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
      />
    </div>
  );
};

// Add _cesiumCleanup to the window interface
declare global {
  interface Window {
    _cesiumCleanup?: () => void;
  }
}

export default SimpleEarthViewer;

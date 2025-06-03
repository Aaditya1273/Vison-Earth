import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * A simple fallback Earth viewer that displays a static Earth image
 * This is used when the Cesium viewer fails to load
 */
const SimpleEarthViewerFallback: React.FC = () => {
  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      position: 'relative', 
      overflow: 'hidden',
      backgroundColor: '#000'
    }}>
      {/* Vision Earth logo in top left corner */}
      <Box 
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '5px 10px',
          borderRadius: '4px'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          Vision Earth
        </Typography>
      </Box>
      
      {/* Fallback Earth image */}
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%',
        maxWidth: '800px',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Earth globe representation */}
        <Box sx={{
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #4286f4, #373B44)',
          boxShadow: '0 0 30px rgba(0,100,255,0.5)',
          position: 'relative',
          overflow: 'hidden',
          margin: '0 auto 30px auto'
        }}>
          {/* Simple continents approximation */}
          <Box sx={{
            position: 'absolute',
            backgroundColor: '#3e8c61',
            width: '100px',
            height: '150px',
            top: '70px',
            left: '50px',
            borderRadius: '40%',
          }}/>
          <Box sx={{
            position: 'absolute',
            backgroundColor: '#3e8c61',
            width: '130px',
            height: '90px',
            top: '50px',
            right: '30px',
            borderRadius: '30%',
          }}/>
          <Box sx={{
            position: 'absolute',
            backgroundColor: '#3e8c61',
            width: '80px',
            height: '120px',
            bottom: '40px',
            right: '70px',
            borderRadius: '40%',
          }}/>
        </Box>
        
        <Typography variant="h5" sx={{ color: 'white', mb: 2, textAlign: 'center' }}>
          Earth Viewer
        </Typography>
        
        <Typography variant="body1" sx={{ color: 'white', textAlign: 'center', maxWidth: '600px' }}>
          The 3D Earth visualization couldn't be loaded. Please check your browser compatibility and WebGL support.
        </Typography>
      </Box>
    </Box>
  );
};

export default SimpleEarthViewerFallback;

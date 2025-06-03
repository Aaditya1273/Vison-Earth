import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';

const TestPage: React.FC = () => {
  return (
    <Box sx={{ padding: 4 }}>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h4" gutterBottom>
          VisionEarth Test Page
        </Typography>
        <Typography variant="body1" paragraph>
          This is a simple test page to verify that the VisionEarth application is working correctly.
        </Typography>
        <Button variant="contained" color="primary">
          Test Button
        </Button>
      </Paper>
    </Box>
  );
};

export default TestPage;

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  Slider,
  TextField,
  Button,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Alert
} from '@mui/material';

const SettingsPage: React.FC = () => {
  // These would be fetched from and saved to a backend in a real implementation
  const [settings, setSettings] = useState({
    theme: 'dark',
    dataSourceRefreshInterval: 15,
    enableNotifications: true,
    notificationsForAnomalyDetection: true,
    notificationsForDataUpdates: false,
    maxQualityMode: false,
    defaultLocation: {
      lat: 37.7749,
      lng: -122.4194,
      zoom: 4
    },
    cesiumToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWY0LTQzN2YtOGNkNC0yYTVmZjEwZGJmM2QiLCJpZCI6MTYyMTY3LCJpYXQiOjE2OTY5MDk2MTZ9.jaESQs38ACb1-OXgPt-FA-lARxYzBr_NLzEEZ7C27KQ',
    apiEndpoints: {
      weather: '/api/v1/weather',
      satellite: '/api/v1/satellite',
      anomalies: '/api/v1/anomalies'
    }
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (key: string, value: any) => {
    setSettings({
      ...settings,
      [key]: value
    });
    setSaved(false);
  };

  const handleNestedChange = (parent: string, key: string, value: any) => {
    setSettings({
      ...settings,
      [parent]: {
        ...settings[parent as keyof typeof settings],
        [key]: value
      }
    });
    setSaved(false);
  };

  const handleSaveSettings = () => {
    // In a real application, this would save to a backend API
    console.log('Saving settings:', settings);
    setSaved(true);
    
    // Reset the saved notification after 3 seconds
    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Appearance
        </Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel id="theme-label">Theme</InputLabel>
          <Select
            labelId="theme-label"
            value={settings.theme}
            label="Theme"
            onChange={(e) => handleChange('theme', e.target.value)}
          >
            <MenuItem value="dark">Dark</MenuItem>
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="system">System Default</MenuItem>
          </Select>
        </FormControl>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.maxQualityMode}
              onChange={(e) => handleChange('maxQualityMode', e.target.checked)}
            />
          }
          label="High Quality Mode (may affect performance)"
          sx={{ mt: 2 }}
        />
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Data & Updates
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography id="data-refresh-slider" gutterBottom>
            Data Source Refresh Interval (minutes)
          </Typography>
          <Slider
            value={settings.dataSourceRefreshInterval}
            onChange={(_, value) => handleChange('dataSourceRefreshInterval', value)}
            aria-labelledby="data-refresh-slider"
            valueLabelDisplay="auto"
            step={5}
            marks
            min={5}
            max={60}
          />
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          Notifications
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableNotifications}
              onChange={(e) => handleChange('enableNotifications', e.target.checked)}
            />
          }
          label="Enable Notifications"
        />
        
        <Box sx={{ pl: 3, mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                disabled={!settings.enableNotifications}
                checked={settings.notificationsForAnomalyDetection}
                onChange={(e) => handleChange('notificationsForAnomalyDetection', e.target.checked)}
              />
            }
            label="Anomaly Detection Alerts"
          />
          
          <FormControlLabel
            control={
              <Switch
                disabled={!settings.enableNotifications}
                checked={settings.notificationsForDataUpdates}
                onChange={(e) => handleChange('notificationsForDataUpdates', e.target.checked)}
              />
            }
            label="Data Source Update Notifications"
          />
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Default Map Location
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Latitude"
              type="number"
              value={settings.defaultLocation.lat}
              onChange={(e) => handleNestedChange('defaultLocation', 'lat', parseFloat(e.target.value))}
              margin="normal"
              InputProps={{ inputProps: { min: -90, max: 90, step: 0.000001 } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Longitude"
              type="number"
              value={settings.defaultLocation.lng}
              onChange={(e) => handleNestedChange('defaultLocation', 'lng', parseFloat(e.target.value))}
              margin="normal"
              InputProps={{ inputProps: { min: -180, max: 180, step: 0.000001 } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Default Zoom"
              type="number"
              value={settings.defaultLocation.zoom}
              onChange={(e) => handleNestedChange('defaultLocation', 'zoom', parseInt(e.target.value))}
              margin="normal"
              InputProps={{ inputProps: { min: 0, max: 20, step: 1 } }}
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          API Configuration
        </Typography>
        
        <TextField
          fullWidth
          label="Cesium Ion Access Token"
          value={settings.cesiumToken}
          onChange={(e) => handleChange('cesiumToken', e.target.value)}
          margin="normal"
          type="password"
        />
        
        <Typography variant="subtitle1" sx={{ mt: 2 }}>
          API Endpoints
        </Typography>
        
        <TextField
          fullWidth
          label="Weather API Endpoint"
          value={settings.apiEndpoints.weather}
          onChange={(e) => handleNestedChange('apiEndpoints', 'weather', e.target.value)}
          margin="normal"
        />
        
        <TextField
          fullWidth
          label="Satellite API Endpoint"
          value={settings.apiEndpoints.satellite}
          onChange={(e) => handleNestedChange('apiEndpoints', 'satellite', e.target.value)}
          margin="normal"
        />
        
        <TextField
          fullWidth
          label="Anomalies API Endpoint"
          value={settings.apiEndpoints.anomalies}
          onChange={(e) => handleNestedChange('apiEndpoints', 'anomalies', e.target.value)}
          margin="normal"
        />
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </Box>
    </Container>
  );
};

export default SettingsPage;

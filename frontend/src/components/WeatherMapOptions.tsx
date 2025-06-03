import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  alpha
} from '@mui/material';
import {
  Satellite,
  Check as CheckIcon,
  Hd as HdIcon,
  Radar as RadarIcon,
  WaterDrop as PrecipitationIcon,
  Air as WindIcon,
  Thermostat as TemperatureIcon,
  Opacity as HumidityIcon,
  Speed as PressureIcon
} from '@mui/icons-material';

interface WeatherMapOptionsProps {
  activeLayer: string;
  onLayerChange: (layer: string) => void;
}

const WeatherMapOptions: React.FC<WeatherMapOptionsProps> = ({ activeLayer, onLayerChange }) => {
  const layers = [
    { id: 'Satellite', label: 'Satellite', icon: <Satellite /> },
    { id: 'Live', label: 'Live', icon: <CheckIcon /> },
    { id: 'HD', label: 'HD', icon: <HdIcon /> },
    { id: 'Radar', label: 'Radar', icon: <RadarIcon /> },
    { id: 'Precipitation', label: 'Precipitation', icon: <PrecipitationIcon /> },
    { id: 'Wind', label: 'Wind', icon: <WindIcon /> },
    { id: 'Temperature', label: 'Temperature', icon: <TemperatureIcon /> },
    { id: 'Humidity', label: 'Humidity', icon: <HumidityIcon /> },
    { id: 'Pressure', label: 'Pressure', icon: <PressureIcon /> },
  ];

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        left: 16,
        top: 16,
        zIndex: 1000,
        width: 200,
        backgroundColor: alpha('#000000', 0.7),
        backdropFilter: 'blur(8px)',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Box sx={{ p: 2, backgroundColor: alpha('#000000', 0.5) }}>
        <Typography variant="subtitle1" fontWeight="bold" color="white">
          WEATHER MAPS
        </Typography>
      </Box>
      <Divider />
      <List sx={{ p: 0 }}>
        {layers.map((layer) => (
          <ListItem
            key={layer.id}
            button
            selected={activeLayer === layer.id}
            onClick={() => onLayerChange(layer.id)}
            sx={{
              py: 1,
              '&.Mui-selected': {
                backgroundColor: alpha('#ffffff', 0.15),
                '&:hover': {
                  backgroundColor: alpha('#ffffff', 0.2),
                },
              },
              '&:hover': {
                backgroundColor: alpha('#ffffff', 0.1),
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'white' }}>
              {layer.icon}
            </ListItemIcon>
            <ListItemText 
              primary={layer.label} 
              primaryTypographyProps={{ 
                color: 'white',
                fontSize: '0.9rem'
              }} 
            />
            {activeLayer === layer.id && (
              <CheckIcon fontSize="small" sx={{ color: 'white' }} />
            )}
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default WeatherMapOptions;

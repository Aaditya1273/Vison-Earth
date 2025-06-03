import React from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { CurrentWeather, getWeatherDescription } from '../services/weatherService';

interface WeatherInfoProps {
  weather: CurrentWeather | null;
  loading: boolean;
  error: string | null;
  location?: { name: string; country: string } | null;
}

const WeatherInfo: React.FC<WeatherInfoProps> = ({ weather, loading, error, location }) => {
  if (loading) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 200,
          minHeight: 100,
        }}
      >
        <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
        <Typography variant="body2">Loading weather data...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          borderRadius: 1,
          minWidth: 200,
        }}
      >
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Paper>
    );
  }

  if (!weather) {
    return null;
  }

  const weatherDesc = getWeatherDescription(weather.weathercode);
  
  // Convert wind direction degrees to cardinal direction
  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: 1,
        minWidth: 200,
      }}
    >
      {location && (
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {location.name}, {location.country}
        </Typography>
      )}
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mr: 1 }}>
          {Math.round(weather.temperature)}°C
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {weatherDesc}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2">
          Wind: {Math.round(weather.windspeed)} km/h {getWindDirection(weather.winddirection)}
        </Typography>
      </Box>
      
      <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
        Updated: {new Date(weather.time).toLocaleTimeString()}
      </Typography>
    </Paper>
  );
};

export default WeatherInfo;

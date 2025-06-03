/**
 * Weather Service for VisionEarth
 * Uses Open-Meteo API to fetch weather data
 */

/**
 * Weather data interface for current weather
 */
export interface CurrentWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
}

/**
 * Weather data interface for the full response
 */
export interface WeatherData {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_weather: CurrentWeather;
}

/**
 * Fetch current weather data for a specific location
 * @param lat Latitude
 * @param lon Longitude
 * @returns Promise with current weather data
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data: WeatherData = await response.json();
    return data.current_weather;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}

/**
 * Get weather data for multiple parameters
 * @param lat Latitude
 * @param lon Longitude
 * @param params Additional parameters (hourly, daily)
 * @returns Promise with weather data
 */
export async function getDetailedWeather(
  lat: number, 
  lon: number, 
  params: {
    hourly?: string[],
    daily?: string[]
  } = {}
): Promise<any> {
  let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto`;
  
  // Add hourly parameters if provided
  if (params.hourly && params.hourly.length > 0) {
    url += `&hourly=${params.hourly.join(',')}`;
  }
  
  // Add daily parameters if provided
  if (params.daily && params.daily.length > 0) {
    url += `&daily=${params.daily.join(',')}`;
  }
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching detailed weather data:', error);
    throw error;
  }
}

/**
 * Get weather code description
 * @param code WMO weather code
 * @returns Description of the weather code
 */
export function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  
  return weatherCodes[code] || 'Unknown';
}

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Response type for paginated data
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Interface for satellite image data
 */
export interface SatelliteImage {
  id: number;
  source: string;
  acquisition_date: string;
  cloud_cover_percentage: number;
  path: string;
  resolution: number;
  bands: string[];
  footprint: GeoJSON.Polygon;
  center_point: GeoJSON.Point;
  metadata: Record<string, any>;
}

/**
 * Interface for weather data point
 */
export interface WeatherData {
  id: number;
  source: string;
  timestamp: string;
  data_type: string;
  value: number;
  unit: string;
  location: GeoJSON.Point;
  station_id?: string;
  station_name?: string;
  metadata: Record<string, any>;
}

/**
 * Interface for environmental anomaly
 */
export interface EnvironmentalAnomaly {
  id: number;
  anomaly_type: string;
  detection_date: string;
  confidence_score: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'detected' | 'verified' | 'resolved';
  location: GeoJSON.Geometry;
  metadata: Record<string, any>;
}

/**
 * Interface for weather statistics response
 */
export interface WeatherStatsResponse {
  data_type: string;
  start_date: string;
  end_date: string;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  unit: string;
  bbox: [number, number, number, number]; // [min_lon, min_lat, max_lon, max_lat]
  time_series: {
    timestamp: string;
    avg_value: number | null;
    min_value: number | null;
    max_value: number | null;
    count: number;
  }[];
  overall: {
    avg_value: number | null;
    min_value: number | null;
    max_value: number | null;
    count: number;
  };
}

/**
 * Parameters for querying satellite images
 */
export interface SatelliteImageParams {
  source?: string;
  start_date?: string;
  end_date?: string;
  min_resolution?: number;
  max_cloud_cover?: number;
  bbox?: [number, number, number, number]; // [min_lon, min_lat, max_lon, max_lat]
  limit?: number;
  offset?: number;
}

/**
 * Parameters for querying weather data
 */
export interface WeatherDataParams {
  data_type?: string;
  source?: string;
  start_date?: string;
  end_date?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  bbox_min_lon?: number;
  bbox_min_lat?: number;
  bbox_max_lon?: number;
  bbox_max_lat?: number;
  min_value?: number;
  max_value?: number;
  station_id?: string;
  order_by?: 'newest' | 'oldest';
  offset?: number;
  limit?: number;
}

/**
 * Parameters for querying environmental anomalies
 */
export interface AnomalyParams {
  anomaly_type?: string;
  start_date?: string;
  end_date?: string;
  min_confidence?: number;
  severity?: string;
  status?: string;
  bbox_min_lon?: number;
  bbox_min_lat?: number;
  bbox_max_lon?: number;
  bbox_max_lat?: number;
  offset?: number;
  limit?: number;
}

/**
 * Client for accessing VisionEarth spatial data APIs
 */
export class SpatialDataClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly baseURL: string;

  /**
   * Create a new SpatialDataClient
   * @param baseURL Base URL for the API
   * @param token Authentication token (optional)
   */
  constructor(baseURL: string = '/api/v1', token?: string) {
    this.baseURL = baseURL;
    
    const config: AxiosRequestConfig = {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    this.axiosInstance = axios.create(config);
    
    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API request failed:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get satellite images with optional filtering
   */
  async getSatelliteImages(params: SatelliteImageParams = {}): Promise<SatelliteImage[]> {
    const response = await this.axiosInstance.get<SatelliteImage[]>('/satellite/images', { params });
    return response.data;
  }

  /**
   * Get a specific satellite image by ID
   */
  async getSatelliteImage(id: number): Promise<SatelliteImage> {
    const response = await this.axiosInstance.get<SatelliteImage>(`/satellite/images/${id}`);
    return response.data;
  }

  /**
   * Get satellite coverage as GeoJSON
   */
  async getSatelliteCoverage(params: {
    source?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<GeoJSON.FeatureCollection> {
    const response = await this.axiosInstance.get<GeoJSON.FeatureCollection>('/satellite/coverage', { params });
    return response.data;
  }

  /**
   * Trigger a refresh of satellite data
   */
  async refreshSatelliteData(params: {
    source?: string;
    days?: number;
  } = {}): Promise<{ status: string; new_images_count: number }> {
    const response = await this.axiosInstance.post<{ status: string; new_images_count: number }>('/satellite/refresh', null, { params });
    return response.data;
  }

  /**
   * Get weather data with optional filtering
   */
  async getWeatherData(params: WeatherDataParams = {}): Promise<WeatherData[]> {
    const response = await this.axiosInstance.get<WeatherData[]>('/weather/data', { params });
    return response.data;
  }

  /**
   * Get a specific weather data point by ID
   */
  async getWeatherDataPoint(id: number): Promise<WeatherData> {
    const response = await this.axiosInstance.get<WeatherData>(`/weather/data/${id}`);
    return response.data;
  }

  /**
   * Get weather statistics
   */
  async getWeatherStatistics(params: {
    data_type: string;
    bbox_min_lon: number;
    bbox_min_lat: number;
    bbox_max_lon: number;
    bbox_max_lat: number;
    start_date?: string;
    end_date?: string;
    interval?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  }): Promise<WeatherStatsResponse> {
    const response = await this.axiosInstance.get<WeatherStatsResponse>('/weather/statistics', { params });
    return response.data;
  }

  /**
   * Get weather heatmap data
   */
  async getWeatherHeatmap(params: {
    data_type: string;
    timestamp: string;
    bbox_min_lon: number;
    bbox_min_lat: number;
    bbox_max_lon: number;
    bbox_max_lat: number;
    resolution?: number;
  }): Promise<any> {
    const response = await this.axiosInstance.get('/weather/heatmap', { params });
    return response.data;
  }

  /**
   * Get available weather data types
   */
  async getWeatherDataTypes(): Promise<string[]> {
    const response = await this.axiosInstance.get<string[]>('/weather/data-types');
    return response.data;
  }

  /**
   * Get environmental anomalies with optional filtering
   */
  async getAnomalies(params: AnomalyParams = {}): Promise<EnvironmentalAnomaly[]> {
    const response = await this.axiosInstance.get<EnvironmentalAnomaly[]>('/anomalies', { params });
    return response.data;
  }

  /**
   * Get a specific environmental anomaly by ID
   */
  async getAnomaly(id: number): Promise<EnvironmentalAnomaly> {
    const response = await this.axiosInstance.get<EnvironmentalAnomaly>(`/anomalies/${id}`);
    return response.data;
  }

  /**
   * Get available anomaly types
   */
  async getAnomalyTypes(): Promise<string[]> {
    const response = await this.axiosInstance.get<string[]>('/anomalies/types');
    return response.data;
  }

  /**
   * Get the current user's information
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.axiosInstance.get('/users/me');
    return response.data;
  }

  /**
   * Set the authorization token for subsequent requests
   */
  setToken(token: string): void {
    this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  /**
   * Clear the authorization token
   */
  clearToken(): void {
    delete this.axiosInstance.defaults.headers.common.Authorization;
  }
}

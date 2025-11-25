import * as Location from 'expo-location';

export interface WeatherData {
  temperature: number;
  condition: string;
  emoji: string;
  location: string;
  humidity?: number;
  windSpeed?: number;
}

export interface WeatherError {
  message: string;
  type: 'permission' | 'network' | 'location' | 'api';
}

class WeatherService {
  private static instance: WeatherService;
  private cachedWeather: WeatherData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  private getWeatherEmoji(condition: string, isDay: boolean = true): string {
    const conditionLower = condition.toLowerCase();
    
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
      return isDay ? '☀️' : '🌙';
    }
    if (conditionLower.includes('cloud')) {
      return conditionLower.includes('partly') ? '⛅' : '☁️';
    }
    if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
      return conditionLower.includes('heavy') ? '🌧️' : '🌦️';
    }
    if (conditionLower.includes('snow')) {
      return '❄️';
    }
    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
      return '⛈️';
    }
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
      return '🌫️';
    }
    if (conditionLower.includes('wind')) {
      return '💨';
    }
    
    return '🌤️'; // Default
  }

  private async fetchWeatherFromAPI(latitude: number, longitude: number): Promise<WeatherData> {
    // Using Open-Meteo API (free, no API key required)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
    
    try {
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      const current = data.current;
      
      // Map weather codes to conditions
      const weatherCode = current.weather_code;
      let condition = 'Unknown';
      
      if (weatherCode === 0) condition = 'Clear sky';
      else if (weatherCode <= 3) condition = 'Partly cloudy';
      else if (weatherCode <= 48) condition = 'Foggy';
      else if (weatherCode <= 67) condition = 'Rainy';
      else if (weatherCode <= 77) condition = 'Snowy';
      else if (weatherCode <= 82) condition = 'Rain showers';
      else if (weatherCode <= 86) condition = 'Snow showers';
      else if (weatherCode <= 99) condition = 'Thunderstorm';

      // Get reverse geocoding for location name
      let locationName = 'Current Location';
      try {
        const geoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto`;
        locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      } catch (e) {
        // Fallback to coordinates if geocoding fails
      }

      const temperature = Math.round(current.temperature_2m);
      const isDay = new Date().getHours() >= 6 && new Date().getHours() < 20;

      return {
        temperature,
        condition,
        emoji: this.getWeatherEmoji(condition, isDay),
        location: locationName,
        humidity: Math.round(current.relative_humidity_2m),
        windSpeed: Math.round(current.wind_speed_10m * 10) / 10, // Round to 1 decimal
      };
    } catch (error) {
      console.error('Weather API error:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  async getCurrentWeather(forceRefresh: boolean = false): Promise<WeatherData | WeatherError> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.cachedWeather && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return this.cachedWeather;
    }

    try {
      // Check location permissions
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        return {
          message: 'Location permission required for weather updates',
          type: 'permission'
        };
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Fetch weather data
      const weatherData = await this.fetchWeatherFromAPI(latitude, longitude);
      
      // Cache the result
      this.cachedWeather = weatherData;
      this.lastFetchTime = now;
      
      return weatherData;
    } catch (error) {
      console.error('Weather service error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Location')) {
          return {
            message: 'Unable to get location',
            type: 'location'
          };
        }
        if (error.message.includes('network') || error.message.includes('fetch')) {
          return {
            message: 'Network error - check internet connection',
            type: 'network'
          };
        }
      }
      
      return {
        message: 'Weather service unavailable',
        type: 'api'
      };
    }
  }

  clearCache(): void {
    this.cachedWeather = null;
    this.lastFetchTime = 0;
  }
}

export const weatherService = WeatherService.getInstance();
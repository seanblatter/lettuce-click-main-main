export type TemperatureUnit = 'celsius' | 'fahrenheit';

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5) + 32);
}

/**
 * Convert Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round((fahrenheit - 32) * 5/9);
}

/**
 * Format temperature with appropriate unit symbol
 */
export function formatTemperature(temperature: number, unit: TemperatureUnit): string {
  const convertedTemp = unit === 'fahrenheit' 
    ? celsiusToFahrenheit(temperature) 
    : temperature;
  const unitSymbol = unit === 'fahrenheit' ? 'F' : 'C';
  return `${convertedTemp}°${unitSymbol}`;
}

/**
 * Get display temperature based on unit preference
 */
export function getDisplayTemperature(celsiusTemp: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? celsiusToFahrenheit(celsiusTemp) : celsiusTemp;
}

/**
 * Detect user's location-based temperature unit preference
 */
export function detectTemperatureUnitFromLocation(locationString: string): TemperatureUnit {
  const location = locationString.toLowerCase();
  
  // Countries that primarily use Fahrenheit
  const fahrenheitCountries = [
    'united states', 'usa', 'us', 'america', 'american',
    'bahamas', 'belize', 'cayman islands', 'liberia', 
    'palau', 'federated states of micronesia', 'marshall islands'
  ];
  
  // Check if location contains any Fahrenheit-using country names
  const usesFahrenheit = fahrenheitCountries.some(country => 
    location.includes(country)
  );
  
  return usesFahrenheit ? 'fahrenheit' : 'celsius';
}
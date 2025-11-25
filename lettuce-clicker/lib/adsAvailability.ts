import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

export function isAdsAvailable(): boolean {
  // Don't use ads in web
  if (Platform.OS === 'web') {
    return false;
  }

  // Don't use ads in Expo Go
  if (Constants.appOwnership === 'expo') {
    console.log('Running in Expo Go - ads disabled');
    return false;
  }

  // Check if native module exists
  if (!NativeModules.RNGoogleMobileAdsModule) {
    console.log('Native ads module not available');
    return false;
  }

  return true;
}
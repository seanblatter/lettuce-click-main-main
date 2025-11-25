import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

const PRODUCTION_AD_UNIT_IDS = {
  android: 'ca-app-pub-7849823724462832/8779801897',
  ios: 'ca-app-pub-7849823724462832/1639678472',
} as const;

let isLoading = false;
let isLoaded = true; // Always ready in development

// Simple delay function for mock ads
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isInExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function resolveAdUnitId() {
  const key = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : null;
  if (!key) {
    return null;
  }

  return PRODUCTION_AD_UNIT_IDS[key];
}

export async function preloadRewardedAd(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    console.log('Ads not supported on this platform');
    return false;
  }

  if (isLoading) {
    return isLoaded;
  }

  isLoading = true;
  
  try {
    if (isInExpoGo()) {
      // Mock ad loading in Expo Go
      console.log('🎯 Mock ad loading in Expo Go...');
      await delay(1000); // Simulate loading time
      isLoaded = true;
      console.log('✅ Mock ad loaded successfully');
      return true;
    } else {
      // In production build, load real ads
      const adUnitId = resolveAdUnitId();
      console.log('Loading real ads with unit ID:', adUnitId);
      // Here you would use the real ads SDK
      isLoaded = true;
      return true;
    }
  } catch (error) {
    console.warn('Failed to preload rewarded ad:', error);
    return false;
  } finally {
    isLoading = false;
  }
}

export async function showRewardedAd(): Promise<'earned' | 'closed' | 'failed'> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return 'failed';
  }

  try {
    if (!isLoaded) {
      const loadedSuccessfully = await preloadRewardedAd();
      if (!loadedSuccessfully) {
        return 'failed';
      }
    }

    if (isInExpoGo()) {
      // Mock ad experience in Expo Go
      return new Promise<'earned' | 'closed' | 'failed'>((resolve) => {
        Alert.alert(
          '🎯 Mock Rewarded Ad',
          'This is a mock ad for development. In production, users will watch a real video ad.',
          [
            {
              text: 'Skip (No Reward)',
              style: 'cancel',
              onPress: () => {
                console.log('User skipped mock ad');
                isLoaded = false;
                // Preload next mock ad
                preloadRewardedAd();
                resolve('closed');
              }
            },
            {
              text: 'Watch Ad (Get Reward)',
              onPress: async () => {
                console.log('User chose to watch mock ad');
                // Simulate ad watching time
                Alert.alert('📺 Watching Ad...', 'Please wait 3 seconds', [], { cancelable: false });
                await delay(3000);
                console.log('✅ User earned reward from mock ad');
                isLoaded = false;
                // Preload next mock ad
                preloadRewardedAd();
                resolve('earned');
              }
            }
          ]
        );
      });
    } else {
      // In production build, show real ads
      return new Promise<'earned' | 'closed' | 'failed'>((resolve) => {
        console.log('Showing real rewarded ad');
        // Here you would use the real ads SDK
        // For now, simulate success
        setTimeout(() => {
          isLoaded = false;
          preloadRewardedAd();
          resolve('earned');
        }, 1000);
      });
    }
  } catch (error) {
    console.warn('Error showing rewarded ad:', error);
    return 'failed';
  }
}

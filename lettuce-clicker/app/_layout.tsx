import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { GameProvider } from '@/context/GameContext';
import { AmbientAudioProvider } from '@/context/AmbientAudioContext';

function RootNavigation() {
  const { colorScheme } = useAppTheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} initialParams={{ screen: 'garden' }} />
        <Stack.Screen
          name="chess"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="music"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="profile"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AmbientAudioProvider>
          <GameProvider>
            <RootNavigation />
          </GameProvider>
        </AmbientAudioProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { HomeIcon, PineTreeIcon, EnergyIcon, LettuceIcon } from '@/components/TabIcons';
import { Colors } from '@/constants/theme';
import { useGame } from '@/context/GameContext';
import type { HomeEmojiTheme } from '@/context/GameContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const THEME_ACCENTS: Partial<Record<HomeEmojiTheme, string>> = {
  circle: '#22c55e',
  spiral: '#a855f7',
  matrix: '#16a34a',
  clear: '#64748b',
  bubble: '#38bdf8',
  'bubble-pop': '#f97316',
  wave: '#0ea5e9',
  lake: '#0ea5e9',
  echo: '#6366f1',
  confetti: '#fb7185',
  laser: '#ec4899',
  aurora: '#7c3aed',
  firefly: '#eab308',
  starlight: '#f472b6',
  nebula: '#38bdf8',
  supernova: '#f97316',
};

const lightenColor = (hex: string, factor: number) => {
  const normalized = hex.replace('#', '');

  if (!normalized || (normalized.length !== 6 && normalized.length !== 3)) {
    return hex;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return hex;
  }

  const clampChannel = (channelValue: number) => {
    const boundedFactor = Math.min(Math.max(factor, 0), 1);
    const next = Math.round(channelValue + (255 - channelValue) * boundedFactor);
    return Math.max(0, Math.min(255, next));
  };

  const r = clampChannel((value >> 16) & 0xff);
  const g = clampChannel((value >> 8) & 0xff);
  const b = clampChannel(value & 0xff);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { homeEmojiTheme, premiumAccentColor, gardenBackgroundColor, isExpandedView } = useGame();

  const baseAccent = useMemo(() => {
    if (premiumAccentColor) {
      return premiumAccentColor;
    }

    const mapped = homeEmojiTheme ? THEME_ACCENTS[homeEmojiTheme] : null;
    if (mapped) {
      return mapped;
    }

    return Colors[colorScheme].tint;
  }, [colorScheme, homeEmojiTheme, premiumAccentColor]);

  const inactiveAccent = useMemo(() => {
    if (!baseAccent) {
      return Colors[colorScheme].tabIconDefault;
    }

    return baseAccent;
  }, [baseAccent, colorScheme]);

  const tabBackground = useMemo(() => {
    const baseBackground = gardenBackgroundColor || Colors[colorScheme].background;

    if (typeof baseBackground === 'string' && baseBackground.startsWith('#')) {
      return lightenColor(baseBackground, colorScheme === 'dark' ? 0.12 : 0.5);
    }

    return baseBackground;
  }, [colorScheme, gardenBackgroundColor]);

  const tabBorder = useMemo(() => {
    if (!baseAccent.startsWith('#')) {
      return Colors[colorScheme].background;
    }

    return lightenColor(baseAccent, colorScheme === 'dark' ? 0.55 : 0.92);
  }, [baseAccent, colorScheme]);

  return (
    <Tabs
      initialRouteName="garden"
      screenOptions={{
        tabBarActiveTintColor: baseAccent,
        tabBarInactiveTintColor: colorScheme === 'dark' 
          ? 'rgba(235, 235, 245, 0.6)' 
          : 'rgba(60, 60, 67, 0.6)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.05,
          marginTop: 3,
        },
        tabBarAllowFontScaling: false,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: isExpandedView ? { display: 'none' } : {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 20 : 16,
          marginHorizontal: '8%',
          backgroundColor: colorScheme === 'dark' 
            ? 'rgba(20, 20, 20, 0.65)' 
            : 'rgba(255, 255, 255, 0.55)',
          borderRadius: 36,
          borderWidth: 0.5,
          borderColor: colorScheme === 'dark'
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(0, 0, 0, 0.08)',
          height: 76,
          paddingTop: 12,
          paddingBottom: 12,
          paddingHorizontal: 20,
          shadowColor: colorScheme === 'dark' 
            ? 'rgba(0, 0, 0, 0.9)' 
            : 'rgba(0, 0, 0, 0.2)',
          shadowOpacity: 1,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 12 },
          elevation: 20,
          overflow: 'hidden',
          backdropFilter: 'blur(64px) saturate(200%)',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="lettuce"
        options={{
          title: 'Lettuce',
          tabBarIcon: ({ color }) => <LettuceIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{
          title: 'Garden',
          tabBarIcon: ({ color }) => <PineTreeIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="upgrades"
        options={{
          title: 'Upgrades',
          tabBarIcon: ({ color }) => <EnergyIcon color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

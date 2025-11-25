import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Text } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
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
      screenOptions={{
        tabBarActiveTintColor: baseAccent,
        tabBarInactiveTintColor: inactiveAccent,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.35,
          textTransform: 'uppercase',
          textShadowColor: 'rgba(15, 23, 42, 0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        tabBarAllowFontScaling: false,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: isExpandedView ? { display: 'none' } : {
          backgroundColor: tabBackground,
          borderTopColor: tabBorder,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 12,
          paddingBottom: 16,
          marginBottom: 8,
          shadowColor: 'rgba(15, 23, 42, 0.18)',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{
          title: 'Garden',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🌲</Text>,
        }}
      />
      <Tabs.Screen
        name="upgrades"
        options={{
          title: 'Upgrades',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚡️</Text>,
        }}
      />
    </Tabs>
  );
}

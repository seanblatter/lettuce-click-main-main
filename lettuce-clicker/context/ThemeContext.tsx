import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
  isHydrated: boolean;
};

const STORAGE_KEY = 'lettuce-click:color-scheme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('light');
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && (stored === 'light' || stored === 'dark')) {
          setColorSchemeState(stored);
        }
      } catch (error) {
        console.warn('Failed to load stored color scheme', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistColorScheme = useCallback((scheme: ColorScheme) => {
    AsyncStorage.setItem(STORAGE_KEY, scheme).catch((error) => {
      console.warn('Failed to persist color scheme', error);
    });
  }, []);

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      setColorSchemeState(scheme);
      persistColorScheme(scheme);
    },
    [persistColorScheme]
  );

  const toggleColorScheme = useCallback(() => {
    setColorSchemeState((prev) => {
      const next: ColorScheme = prev === 'light' ? 'dark' : 'light';
      persistColorScheme(next);
      return next;
    });
  }, [persistColorScheme]);

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      toggleColorScheme,
      isHydrated,
    }),
    [colorScheme, isHydrated, setColorScheme, toggleColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}

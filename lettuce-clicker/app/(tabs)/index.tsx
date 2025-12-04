import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  GestureResponderEvent,
  Image,
  useWindowDimensions,
  useColorScheme,
  AppState,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, useAnimatedProps, runOnJS, FadeInDown, FadeOutUp, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { OrbitingUpgradeEmojis } from '@/components/OrbitingUpgradeEmojis';
import { MusicContent } from '@/app/music';
import { ProfileContent } from '@/app/profile';
import { useGame } from '@/context/GameContext';
import { gardenEmojiCatalog } from '@/constants/emojiCatalog';
import type { EmojiDefinition, HomeEmojiTheme } from '@/context/GameContext';
import { useAmbientAudio } from '@/context/AmbientAudioContext';
import { MUSIC_OPTIONS } from '@/constants/music';
import { preloadRewardedAd, showRewardedAd } from '@/lib/rewardedAd';
import { TemperatureUnitModal } from '@/components/TemperatureUnitModal';
import { RSSWidget } from '@/components/RSSWidget';
import { GamesHub } from '@/components/GamesHub';
import { Platform, NativeModules } from 'react-native';

const MODAL_STORAGE_KEY = 'lettuce-click:grow-your-park-dismissed';
const WIDGET_PROMENADE_SELECTED_ID_KEY = 'lettuce-click:selected-widget-promenade-id';
const DAILY_BONUS_LAST_CLAIM_KEY = 'lettuce-click:daily-bonus-last-claim';
const BONUS_REWARD_OPTIONS = [75, 125, 200, 325, 500, 650];
const BONUS_ADDITIONAL_SPINS = 2;
const DAILY_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LEDGER_THEMES = [
  {
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: 'rgba(15, 23, 42, 0.22)',
    tint: '#0f172a',
    muted: 'rgba(51, 65, 85, 0.78)',
    highlight: 'rgba(255, 255, 255, 0.7)',
    refraction: 'rgba(148, 163, 184, 0.28)',
    innerBorder: 'rgba(255, 255, 255, 0.4)',
    grainColor: 'rgba(148, 163, 184, 0.18)',
    grainOpacity: 0.18,
    stitchColor: 'rgba(15, 23, 42, 0.2)',
  },
  {
    backgroundColor: 'rgba(110, 64, 25, 0.92)',
    borderColor: 'rgba(248, 189, 120, 0.66)',
    shadowColor: 'rgba(87, 44, 14, 0.46)',
    tint: '#fff7ed',
    muted: 'rgba(255, 237, 213, 0.82)',
    highlight: 'rgba(249, 250, 196, 0.45)',
    refraction: 'rgba(68, 38, 11, 0.28)',
    innerBorder: 'rgba(250, 204, 21, 0.55)',
    grainColor: 'rgba(249, 224, 175, 0.12)',
    grainOpacity: 0.35,
    stitchColor: 'rgba(254, 243, 199, 0.7)',
  },
  {
    backgroundColor: 'rgba(226, 232, 240, 0.38)',
    borderColor: 'rgba(148, 163, 184, 0.55)',
    shadowColor: 'rgba(30, 41, 59, 0.24)',
    tint: '#1e293b',
    muted: 'rgba(51, 65, 85, 0.72)',
    highlight: 'rgba(241, 245, 249, 0.6)',
    refraction: 'rgba(203, 213, 225, 0.3)',
    innerBorder: 'rgba(241, 245, 249, 0.42)',
    grainColor: 'rgba(148, 163, 184, 0.18)',
    grainOpacity: 0.2,
    stitchColor: 'rgba(148, 163, 184, 0.32)',
  },
  {
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderColor: 'rgba(148, 163, 184, 0.45)',
    shadowColor: 'rgba(15, 23, 42, 0.4)',
    tint: '#f8fafc',
    muted: 'rgba(226, 232, 240, 0.78)',
    highlight: 'rgba(148, 163, 184, 0.45)',
    refraction: 'rgba(100, 116, 139, 0.28)',
    innerBorder: 'rgba(148, 163, 184, 0.38)',
    grainColor: 'rgba(148, 163, 184, 0.12)',
    grainOpacity: 0.22,
    stitchColor: 'rgba(226, 232, 240, 0.45)',
  },
] as const;

const lightenColor = (hex: string, factor: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6 && normalized.length !== 3) {
    return hex;
  }

  const expanded = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized;
  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return hex;
  }

  const channel = (shift: number) => (value >> shift) & 0xff;
  const clampChannel = (channelValue: number) => {
    const boundedFactor = Math.min(Math.max(factor, 0), 1);
    const next = Math.round(channelValue + (255 - channelValue) * boundedFactor);
    return Math.max(0, Math.min(255, next));
  };

  const r = clampChannel(channel(16));
  const g = clampChannel(channel(8));
  const b = clampChannel(channel(0));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const segments = [hours, minutes, seconds].map((segment) => segment.toString().padStart(2, '0'));
  return segments.join(':');
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatWidgetTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const month = MONTH_NAMES[date.getMonth()] ?? '';
  const day = date.getDate();
  const rawHours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const meridiem = rawHours >= 12 ? 'PM' : 'AM';
  const hours = rawHours % 12 === 0 ? 12 : rawHours % 12;
  return `${month} ${day} • ${hours}:${minutes} ${meridiem}`;
};

export default function HomeScreen() {
  // Dynamic font size based on number length for harvest display
  const getDynamicFontSize = (value: number, baseFontSize: number = 20) => {
    const stringLength = value.toLocaleString().length;
    if (stringLength > 15) return baseFontSize * 0.7;
    if (stringLength > 12) return baseFontSize * 0.8;
    if (stringLength > 9) return baseFontSize * 0.9;
    return baseFontSize;
  };

  const {
    isLoading,
    harvest,
    lifetimeHarvest,
    formatLifetimeHarvest,
    autoPerSecond,
    addHarvest,
    orbitingUpgradeEmojis,
    homeEmojiTheme,
    setHomeEmojiTheme,
    emojiThemes,
    emojiCatalog,
    emojiInventory,
    ownedThemes,
    profileName,
    customEmojiNames,
    resumeNotice,
    clearResumeNotice,
    customClickEmoji,
    premiumAccentColor,
    gardenBackgroundColor,
    addHarvestAmount,
    spendHarvestAmount,
    grantEmojiUnlock,
    bedsideWidgetsEnabled,
    hasPremiumUpgrade,
    purchasePremiumUpgrade,
    temperatureUnit,
    hasManuallySetTemperatureUnit,
    rssFeeds,
    rssItems,
    rssError,
    rssLastUpdated,
    setTemperatureUnit,
    setHasManuallySetTemperatureUnit,
    updateRSSFeeds,
    clearRSSData,
    widgetPromenade,
    removeWidgetPromenadePhoto,
  } = useGame();

  // Get current theme for background emoji
  const currentTheme = useMemo(() => 
    emojiThemes.find(theme => theme.id === homeEmojiTheme), 
    [emojiThemes, homeEmojiTheme]
  );

  const lockedShopEmojis = useMemo(
    () => gardenEmojiCatalog.filter((emoji) => !emojiInventory[emoji.id]),
    [emojiInventory]
  );
  const [showGrowModal, setShowGrowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<'overview' | 'themes'>('overview');
  const [activeNotice, setActiveNotice] = useState<typeof resumeNotice>(null);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showProfileQuickAction, setShowProfileQuickAction] = useState(false);
  const [showMusicQuickAction, setShowMusicQuickAction] = useState(false);
  const [showWidgetPromenade, setShowWidgetPromenade] = useState(false);
  const [showGamesHub, setShowGamesHub] = useState(false);
  // Add state for selected widget promenade entry
  const [selectedWidgetPromenadeId, setSelectedWidgetPromenadeId] = useState<string | null>(null);

  // Load selected ID from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(WIDGET_PROMENADE_SELECTED_ID_KEY).then(id => {
      if (id) setSelectedWidgetPromenadeId(id);
    });
  }, []);

  // Save widget selection to App Group for iOS widget
  const saveWidgetArtworkToAppGroup = async (artwork: string) => {
    if (Platform.OS === 'ios' && NativeModules.WidgetArtworkBridge?.saveArtwork) {
      try {
        await NativeModules.WidgetArtworkBridge.saveArtwork(artwork);
      } catch (e) {
        // Handle error if needed
      }
    }
  };

  // Persist selection to storage
  const handleSelectWidgetPromenadeId = useCallback((id: string) => {
    setSelectedWidgetPromenadeId(id);
    AsyncStorage.setItem(WIDGET_PROMENADE_SELECTED_ID_KEY, id);
    // Save to App Group for iOS widget
    saveWidgetArtworkToAppGroup(id);
  }, []);
  const [availableBonusSpins, setAvailableBonusSpins] = useState(0);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [lastBonusReward, setLastBonusReward] = useState<number | null>(null);
  const [lastUnlockedEmoji, setLastUnlockedEmoji] = useState<EmojiDefinition | null>(null);
  const [hasWatchedBonusAd, setHasWatchedBonusAd] = useState(false);
  const [hasPurchasedBonusSpins, setHasPurchasedBonusSpins] = useState(false);
  const [isSpinningBonus, setIsSpinningBonus] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [isDailySpinAvailable, setIsDailySpinAvailable] = useState(false);
  const [dailyBonusAvailableAt, setDailyBonusAvailableAt] = useState<number | null>(null);
  const [dailyCountdown, setDailyCountdown] = useState<string | null>(null);
  const [hasDoubledPassiveHarvest, setHasDoubledPassiveHarvest] = useState(false);
  const [isWatchingResumeOffer, setIsWatchingResumeOffer] = useState(false);
  const [sleepNow, setSleepNow] = useState(Date.now());
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const { isPlaying: isAmbientPlaying, volume, setVolume, togglePlayback, play, pause, sleepCircle, selectedTrackId, selectTrack, isAlarmRinging, triggerAlarm, dismissAlarm } = useAmbientAudio();
  const audioPulsePrimary = useRef(new Animated.Value(0)).current;
  const audioPulseSecondary = useRef(new Animated.Value(0)).current;
  const quickActionWiggles = useRef({
    music: new Animated.Value(0),
    bonus: new Animated.Value(0),
    widgets: new Animated.Value(0),
    games: new Animated.Value(0),
  }).current;
  
  // Hardware volume button synchronization
  const [displayVolume, setDisplayVolume] = useState(volume);

  // DJ wheel rotation state for audio interaction
  const djRotation = useSharedValue(0);
  const djStartRotation = useSharedValue(0);
  const djVelocity = useSharedValue(0);
  const volumeSharedValue = useSharedValue(displayVolume);

  // Update volume shared value when display volume changes
  useEffect(() => {
    volumeSharedValue.value = displayVolume;
  }, [displayVolume, volumeSharedValue]);



  // Harvest card swipe state
  const [showMusicContainer, setShowMusicContainer] = useState(false);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [showTemperatureUnitModal, setShowTemperatureUnitModal] = useState(false);
  const [showTemperatureSettings, setShowTemperatureSettings] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  

  const containerTranslateX = useSharedValue(0);

  
  // DJ wheel gesture for controlling volume when audio is playing
  const djGesture = Gesture.Pan()
    .enabled(isAmbientPlaying)
    .onStart(() => {
      djStartRotation.value = djRotation.value;
    })
    .onUpdate((event) => {
      // Horizontal pan controls volume (right = increase, left = decrease)
      const volumeSensitivity = 0.005; // Volume change per pixel (increased for easier control)
      const deltaVolume = event.translationX * volumeSensitivity;
      const newVolume = Math.max(0, Math.min(1, volume + deltaVolume));
      
      // Only update if volume actually changed significantly
      if (Math.abs(newVolume - volume) > 0.01) {
        runOnJS(setVolume)(newVolume);
        runOnJS(setDisplayVolume)(newVolume); // Also update display volume
        volumeSharedValue.value = newVolume;
      }
      
      // Visual rotation for feedback (matches volume change direction)
      const rotationSensitivity = 2; // Degrees per pixel 
      const deltaRotation = event.translationX * rotationSensitivity;
      djRotation.value = djStartRotation.value + deltaRotation;
    })
    .onEnd((event) => {
      // Add subtle momentum to rotation for visual feedback
      const momentumFactor = 0.05;
      const finalVelocity = event.velocityX * momentumFactor;
      
      if (Math.abs(finalVelocity) > 0.1) {
        djVelocity.value = finalVelocity;
      }
    });

  // Swipe gesture for switching between harvest card and music container
  const ledgerSwipeGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsGestureActive)(true);
    })
    .onUpdate((event) => {
      // Constrain translation to prevent going beyond container bounds
      const maxTranslation = 120;
      const clampedTranslation = Math.max(-maxTranslation, Math.min(maxTranslation, event.translationX));
      containerTranslateX.value = clampedTranslation;
    })
    .onEnd((event) => {
      const threshold = 60; // Reduced threshold for easier swipe detection
      if (Math.abs(event.translationX) > threshold) {
        if (event.translationX < 0) {
          // Swipe left - show music container 
          runOnJS(setShowMusicContainer)(true);
        } else {
          // Swipe right - show harvest card
          runOnJS(setShowMusicContainer)(false);
        }
      }
      // Always reset translation after gesture ends
      containerTranslateX.value = 0;
      runOnJS(setIsGestureActive)(false);
    })
    .onFinalize(() => {
      runOnJS(setIsGestureActive)(false);
    });

  // Animated style for container transitions
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: containerTranslateX.value }],
  }));

  // Animated style for DJ wheel with volume-based scaling and rotation
  const djWheelStyle = useAnimatedStyle(() => {
    const isRotating = Math.abs(djVelocity.value) > 0.1;
    const volumeScale = 0.9 + (volumeSharedValue.value * 0.2); // Scale from 0.9 to 1.1 based on volume
    return {
      transform: [
        { rotate: `${djRotation.value}deg` },
        { scale: isRotating ? volumeScale * 1.05 : volumeScale }
      ],
    };
  });

  // Gentle floating animation - independent of user gestures
  const floatingOffset = useSharedValue(0);
  
  useEffect(() => {
    floatingOffset.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 3000, easing: Easing.bezier(0.4, 0.0, 0.6, 1.0) }),
        withTiming(-12, { duration: 3000, easing: Easing.bezier(0.4, 0.0, 0.6, 1.0) }),
        withTiming(0, { duration: 3000, easing: Easing.bezier(0.4, 0.0, 0.6, 1.0) })
      ),
      -1,
      false
    );
  }, []);

  const floatingStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: floatingOffset.value }
      ],
    };
  });

  // Animated style for volume fill bar
  const volumeFillStyle = useAnimatedStyle(() => {
    return {
      width: `${volumeSharedValue.value * 100}%`,
    };
  });

  // Sync displayVolume with actual volume changes (including hardware volume changes from AmbientAudioContext)
  useEffect(() => {
    // Update display volume when the actual volume changes (from hardware buttons or DJ wheel)
    if (Math.abs(volume - displayVolume) > 0.01) {
      setDisplayVolume(volume);
    }
  }, [volume, displayVolume]);

  // Volume text that updates with device volume buttons
  const VolumeText = ({ style, color }: { style: any; color: string }) => {
    const volumePercentage = Math.round(displayVolume * 100);
    
    return (
      <Text style={[style, { color }]}>
        {volumePercentage}%
      </Text>
    );
  };

  // Update sleep timer clock every second
  useEffect(() => {
    if (!sleepCircle) {
      return;
    }

    const interval = setInterval(() => {
      setSleepNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepCircle]);

  // Alarm polling check - ensures alarm triggers even without user interaction
  useEffect(() => {
    if (!sleepCircle) {
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const target = sleepCircle.mode === 'timer' ? sleepCircle.targetTimestamp : sleepCircle.fireTimestamp;
      
      // If we've passed the target time and alarm isn't already ringing, trigger it
      if (now >= target && !isAlarmRinging) {
        triggerAlarm();
      }
    }, 1000); // Check every second

    return () => {
      clearInterval(checkInterval);
    };
  }, [sleepCircle, triggerAlarm, isAlarmRinging]);

  // Check for missed alarms when app becomes active (comes from background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && sleepCircle) {
        const now = Date.now();
        const target = sleepCircle.mode === 'timer' ? sleepCircle.targetTimestamp : sleepCircle.fireTimestamp;
        
        // If we missed the alarm while backgrounded and it's not already ringing, trigger it now
        if (now >= target && !isAlarmRinging) {
          triggerAlarm();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sleepCircle, triggerAlarm, isAlarmRinging]);

  // Calculate sleep timer progress
  const sleepProgress = useMemo(() => {
    if (!sleepCircle) {
      return null;
    }

    if (sleepCircle.mode === 'timer') {
      const totalDurationMs = sleepCircle.duration * 60000;

      if (totalDurationMs <= 0) {
        return 1;
      }

      const remainingMs = sleepCircle.targetTimestamp - sleepNow;
      const clampedRemaining = Math.min(Math.max(remainingMs, 0), totalDurationMs);
      const elapsed = totalDurationMs - clampedRemaining;
      return Math.min(Math.max(elapsed / totalDurationMs, 0), 1);
    }

    // For alarm mode
    const totalAlarmMs = sleepCircle.fireTimestamp - sleepCircle.scheduledAt;

    if (totalAlarmMs <= 0) {
      return 1;
    }

    const elapsed = Math.min(
      Math.max(sleepNow - sleepCircle.scheduledAt, 0),
      totalAlarmMs
    );
    return Math.min(Math.max(elapsed / totalAlarmMs, 0), 1);
  }, [sleepCircle, sleepNow]);

  // Just toggle playback without setting timer (timer is set in Music Lounge)
  const handleTogglePlaybackWithTimer = useCallback(() => {
    togglePlayback();
  }, [togglePlayback]);

  const handleSelectPrevious = useCallback(() => {
    const currentIndex = MUSIC_OPTIONS.findIndex((option) => option.id === selectedTrackId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const previousIndex = (safeIndex - 1 + MUSIC_OPTIONS.length) % MUSIC_OPTIONS.length;
    const previousTrack = MUSIC_OPTIONS[previousIndex];

    if (previousTrack && previousTrack.id !== selectedTrackId) {
      selectTrack(previousTrack.id, { autoPlay: isAmbientPlaying });
    }
  }, [isAmbientPlaying, selectTrack, selectedTrackId]);

  const handleSelectNext = useCallback(() => {
    const currentIndex = MUSIC_OPTIONS.findIndex((option) => option.id === selectedTrackId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + 1) % MUSIC_OPTIONS.length;
    const nextTrack = MUSIC_OPTIONS[nextIndex];

    if (nextTrack && nextTrack.id !== selectedTrackId) {
      selectTrack(nextTrack.id, { autoPlay: isAmbientPlaying });
    }
  }, [isAmbientPlaying, selectTrack, selectedTrackId]);
  
  const isLandscape = useMemo(() => dimensions.width > dimensions.height, [dimensions]);
  const headerPaddingTop = useMemo(() => Math.max(insets.top - 6, 0) + (isLandscape ? 4 : 8), [insets.top, isLandscape]);
  const contentPaddingBottom = useMemo(() => insets.bottom + 32, [insets.bottom]);
  const friendlyName = useMemo(() => {
    const trimmed = profileName.trim();
    return trimmed.length > 0 ? trimmed : 'Gardener';
  }, [profileName]);
  const gardenSurfaceColor = useMemo(
    () => (gardenBackgroundColor && gardenBackgroundColor.trim().length > 0 ? gardenBackgroundColor : '#f2f9f2'),
    [gardenBackgroundColor]
  );
  const accentColor = useMemo(() => premiumAccentColor || '#1f6f4a', [premiumAccentColor]);
  const accentSurface = useMemo(() => lightenColor(accentColor, 0.65), [accentColor]);
  const accentHighlight = useMemo(() => lightenColor(accentColor, 0.85), [accentColor]);
  const audioPrimaryScale = useMemo(
    () => audioPulsePrimary.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }),
    [audioPulsePrimary]
  );
  const audioPrimaryOpacity = useMemo(
    () => audioPulsePrimary.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
    [audioPulsePrimary]
  );
  const audioSecondaryScale = useMemo(
    () => audioPulseSecondary.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }),
    [audioPulseSecondary]
  );
  const audioSecondaryOpacity = useMemo(
    () => audioPulseSecondary.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
    [audioPulseSecondary]
  );
  const audioCoreScale = useMemo(
    () => audioPulsePrimary.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
    [audioPulsePrimary]
  );
  const ledgerTheme = useMemo(
    () => LEDGER_THEMES[0], // Always use first (glass) theme
    []
  );
  const selectedTrack = useMemo(
    () => MUSIC_OPTIONS.find((option) => option.id === selectedTrackId) ?? MUSIC_OPTIONS[0],
    [selectedTrackId]
  );
  const emojiCollectionCount = useMemo(
    () => Object.values(emojiInventory).filter(Boolean).length,
    [emojiInventory]
  );
  const quickActionRotations = useMemo(
    () => ({
      music: quickActionWiggles.music.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }),
      bonus: quickActionWiggles.bonus.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }),
      widgets: quickActionWiggles.widgets.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }),
      games: quickActionWiggles.games.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }),
    }),
    [quickActionWiggles]
  );
  const widgetPromenadeSorted = useMemo(
    () => [...widgetPromenade].sort((a, b) => b.savedAt - a.savedAt),
    [widgetPromenade]
  );
  const widgetPromenadeStatus = useMemo(
    () => (widgetPromenade.length ? `${widgetPromenade.length} saved` : 'Start a gallery'),
    [widgetPromenade.length]
  );
  const bonusFlipRotation = useMemo(
    () =>
      flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '1440deg'],
      }),
    [flipAnimation]
  );
  
  useEffect(() => {
    let primaryLoop: Animated.CompositeAnimation | null = null;
    let secondaryLoop: Animated.CompositeAnimation | null = null;

    if (isAmbientPlaying) {
      audioPulsePrimary.setValue(0);
      audioPulseSecondary.setValue(0);
      primaryLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(audioPulsePrimary, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(audioPulsePrimary, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      secondaryLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(audioPulseSecondary, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(audioPulseSecondary, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      primaryLoop.start();
      secondaryLoop.start();
    } else {
      audioPulsePrimary.stopAnimation();
      audioPulseSecondary.stopAnimation();
      audioPulsePrimary.setValue(0);
      audioPulseSecondary.setValue(0);
    }

    return () => {
      primaryLoop?.stop();
      secondaryLoop?.stop();
      audioPulsePrimary.stopAnimation();
      audioPulseSecondary.stopAnimation();
    };
  }, [audioPulsePrimary, audioPulseSecondary, isAmbientPlaying]);

  const dailyMenuStatus = useMemo(() => {
    if (isDailySpinAvailable) {
      return 'Ready! ❗';
    }

    if (!dailyCountdown) {
      return '—';
    }

    if (dailyCountdown.toLowerCase().includes('ready')) {
      return 'Ready! ❗';
    }

    return dailyCountdown;
  }, [dailyCountdown, isDailySpinAvailable]);
  const ownedThemeList = useMemo(
    () =>
      emojiThemes
        .filter((theme) => ownedThemes[theme.id] || theme.cost === 0)
        .sort((a, b) => {
          if (a.cost === b.cost) {
            return a.name.localeCompare(b.name);
          }
          return a.cost - b.cost;
        }),
    [emojiThemes, ownedThemes]
  );
  const lockedThemeCount = useMemo(
    () => emojiThemes.filter((theme) => !ownedThemes[theme.id]).length,
    [emojiThemes, ownedThemes]
  );
  const activeThemeDefinition = useMemo(
    () => emojiThemes.find((theme) => theme.id === homeEmojiTheme) ?? null,
    [emojiThemes, homeEmojiTheme]
  );
  const themeOverviewSubtitle = useMemo(() => {
    if (!ownedThemeList.length) {
      return 'Unlock orbit styles in the Upgrades tab.';
    }

    const activeLabel = activeThemeDefinition
      ? `${activeThemeDefinition.emoji} ${activeThemeDefinition.name}`
      : 'Circle Orbit';

    return lockedThemeCount
      ? `Active: ${activeLabel} • ${lockedThemeCount} locked`
      : `Active: ${activeLabel}`;
  }, [activeThemeDefinition, lockedThemeCount, ownedThemeList.length]);
  const noticeTitle = useMemo(() => {
    if (!activeNotice) {
      return '';
    }

    if (activeNotice.type === 'returning') {
      return `Welcome Back ${friendlyName}!`;
    }

    return `${activeNotice.greeting}, ${friendlyName}!`;
  }, [activeNotice, friendlyName]);

  const noticeCopy = useMemo(() => {
    if (!activeNotice) {
      return '';
    }

    if (activeNotice.type === 'returning') {
      return `When you signed back in you had ${activeNotice.harvestSnapshot.toLocaleString()} harvest with lifetime totals at ${activeNotice.lifetimeHarvestSnapshot.toLocaleString()}. Auto clicks continue at ${activeNotice.autoPerSecondSnapshot.toLocaleString()} per second.`;
    }

    const baseMessage = `You gathered ${activeNotice.passiveHarvest.toLocaleString()} harvest while away. Your stores now hold ${activeNotice.harvestSnapshot.toLocaleString()} harvest with lifetime totals at ${activeNotice.lifetimeHarvestSnapshot.toLocaleString()}. Auto clicks continue humming at ${activeNotice.autoPerSecondSnapshot.toLocaleString()} per second.`;

    if (hasDoubledPassiveHarvest && activeNotice.passiveHarvest > 0) {
      const doubledTotal = (activeNotice.passiveHarvest * 2).toLocaleString();
      return `${baseMessage} Thanks for watching! Your reward doubled to ${doubledTotal} clicks.`;
    }

    return baseMessage;
  }, [activeNotice, hasDoubledPassiveHarvest]);

  useEffect(() => {
    AsyncStorage.getItem(MODAL_STORAGE_KEY)
      .then((value) => {
        if (value === 'true') {
          return;
        }
        setShowGrowModal(true);
      })
      .catch(() => {
        setShowGrowModal(true);
      });
  }, []);

  useEffect(() => {
    preloadRewardedAd();
  }, []);

  useEffect(() => {
    if (resumeNotice) {
      setActiveNotice(resumeNotice);
      setHasDoubledPassiveHarvest(false);
      setIsWatchingResumeOffer(false);
    }
  }, [resumeNotice]);

  useEffect(() => {
    if (!activeNotice) {
      setHasDoubledPassiveHarvest(false);
      setIsWatchingResumeOffer(false);
    }
  }, [activeNotice]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPage('overview');
    }
  }, [menuOpen]);

  const handleDismissGrow = useCallback(async () => {
    setShowGrowModal(false);
    try {
      await AsyncStorage.setItem(MODAL_STORAGE_KEY, 'true');
    } catch {
      // Best effort persistence only.
    }
  }, []);



  const handleCloseProfileQuickAction = useCallback(() => {
    setShowProfileQuickAction(false);
  }, []);

  const handleOpenMusic = useCallback(() => {
    setMenuOpen(false);
    const isLandscape = dimensions.width > dimensions.height;
    
    if (isLandscape) {
      // Navigate to full-screen music page in landscape mode for better layout
      router.push('/music');
    } else {
      // Use modal in portrait mode
      setShowMusicQuickAction(true);
    }
  }, [dimensions]);

  const handleCloseMusicQuickAction = useCallback(() => {
    setShowMusicQuickAction(false);
  }, []);

  const handleOpenWidgetPromenade = useCallback(() => {
    setMenuOpen(false);
    setShowWidgetPromenade(true);
  }, []);

  const handleCloseWidgetPromenade = useCallback(() => {
    setShowWidgetPromenade(false);
  }, []);

  const handleOpenGamesHub = useCallback(() => {
    setMenuOpen(false);
    setShowGamesHub(true);
  }, []);

  const handleCloseGamesHub = useCallback(() => {
    setShowGamesHub(false);
  }, []);

  const handleRemovePromenadePhoto = useCallback(
    (entryId: string) => {
      removeWidgetPromenadePhoto(entryId);
    },
    [removeWidgetPromenadePhoto]
  );

  const handleOpenDreamCapsule = useCallback(() => {
    setMenuOpen(false);
    router.push('/music?openDreamCapsule=true');
  }, []);



  const handleSelectTheme = useCallback(
    (theme: HomeEmojiTheme) => {
      setHomeEmojiTheme(theme);
      setMenuOpen(false);
    },
    [setHomeEmojiTheme]
  );

  const refreshDailyBonusState = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DAILY_BONUS_LAST_CLAIM_KEY);
      const now = Date.now();
      const lastClaim = stored ? Number.parseInt(stored, 10) : Number.NaN;

      if (!Number.isFinite(lastClaim)) {
        setIsDailySpinAvailable(true);
        setDailyBonusAvailableAt(null);
        setAvailableBonusSpins((prev) => (prev > 0 ? prev : 1));
        return;
      }

      const nextAvailable = lastClaim + DAILY_BONUS_INTERVAL_MS;

      if (now >= nextAvailable) {
        setIsDailySpinAvailable(true);
        setDailyBonusAvailableAt(null);
        setAvailableBonusSpins((prev) => (prev > 0 ? prev : 1));
        return;
      }

      setIsDailySpinAvailable(false);
      setDailyBonusAvailableAt(nextAvailable);
    } catch {
      setIsDailySpinAvailable(true);
      setDailyBonusAvailableAt(null);
      setAvailableBonusSpins((prev) => (prev > 0 ? prev : 1));
    }
  }, []);

  const handleOpenDailyBonus = useCallback(() => {
    setMenuOpen(false);
    setShowDailyBonus(true);
    setBonusMessage(null);
    setLastBonusReward(null);
    setLastUnlockedEmoji(null);
    setHasWatchedBonusAd(false);
    setIsSpinningBonus(false);
    setIsWatchingAd(false);
    setHasPurchasedBonusSpins(false);
    refreshDailyBonusState();
  }, [refreshDailyBonusState]);

  const handleCloseDailyBonus = useCallback(() => {
    setShowDailyBonus(false);
    setLastUnlockedEmoji(null);
  }, []);

  const handleQuickActionEmojiPress = useCallback(
    (id: keyof typeof quickActionWiggles) => (event: GestureResponderEvent) => {
      event.stopPropagation();
      const value = quickActionWiggles[id];
      value.stopAnimation();
      value.setValue(0);
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: -1,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [quickActionWiggles]
  );

  useEffect(() => {
    refreshDailyBonusState();
  }, [refreshDailyBonusState]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    refreshDailyBonusState();
  }, [menuOpen, refreshDailyBonusState]);

  useEffect(() => {
    if (showDailyBonus) {
      refreshDailyBonusState();
    }
  }, [showDailyBonus, refreshDailyBonusState]);

  useEffect(() => {
    const updateCountdown = () => {
      if (isDailySpinAvailable) {
        setDailyCountdown('Ready to spin! ❗');
        return;
      }

      if (!dailyBonusAvailableAt) {
        setDailyCountdown(null);
        return;
      }

      const remaining = dailyBonusAvailableAt - Date.now();

      if (remaining <= 0) {
        setDailyCountdown('Ready to spin! ❗');
        setIsDailySpinAvailable((prev) => {
          if (!prev) {
            setAvailableBonusSpins((spins) => (spins > 0 ? spins : 1));
          }
          return true;
        });
        setDailyBonusAvailableAt(null);
        return;
      }

      setDailyCountdown(formatDuration(remaining));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [dailyBonusAvailableAt, isDailySpinAvailable]);

  const handleSpinBonus = useCallback(() => {
    if (availableBonusSpins <= 0 || isSpinningBonus) {
      return;
    }

    setIsSpinningBonus(true);
    setBonusMessage('Spinning…');
    flipAnimation.stopAnimation();
    flipAnimation.setValue(0);
    Animated.timing(flipAnimation, {
      toValue: 1,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      flipAnimation.setValue(0);
    });
    const reward = BONUS_REWARD_OPTIONS[Math.floor(Math.random() * BONUS_REWARD_OPTIONS.length)];
    setTimeout(() => {
      addHarvestAmount(reward);
      setAvailableBonusSpins((prev) => Math.max(prev - 1, 0));
      if (isDailySpinAvailable) {
        const now = Date.now();
        const nextAvailable = now + DAILY_BONUS_INTERVAL_MS;
        setIsDailySpinAvailable(false);
        setDailyBonusAvailableAt(nextAvailable);
        setDailyCountdown(formatDuration(Math.max(nextAvailable - now, 0)));
        AsyncStorage.setItem(DAILY_BONUS_LAST_CLAIM_KEY, now.toString()).catch(() => {
          // persistence best effort only
        });
      }
      // Check if user can win an emoji they haven't purchased yet
      const lockedEmojis = lockedShopEmojis;
      let unlockedEmoji: EmojiDefinition | null = null;

      // 50% chance to win an emoji if there are locked emojis available
      if (lockedEmojis.length > 0 && Math.random() < 0.5) {
        // Select a random emoji from the locked emojis
        const randomIndex = Math.floor(Math.random() * lockedEmojis.length);
        const wonEmoji = lockedEmojis[randomIndex];
        
        if (wonEmoji) {
          // Grant the emoji directly to the user's inventory
          grantEmojiUnlock(wonEmoji.id);
          unlockedEmoji = wonEmoji;
        }
      }

      setLastBonusReward(reward);
      if (unlockedEmoji) {
        setLastUnlockedEmoji(unlockedEmoji);
        setBonusMessage(
          `You earned ${reward.toLocaleString()} clicks and won ${unlockedEmoji.name}!`
        );
      } else {
        setLastUnlockedEmoji(null);
        setBonusMessage(
          `You earned ${reward.toLocaleString()} clicks! ${lockedEmojis.length > 0 ? 'Spin again for a chance to win emojis!' : 'All emojis unlocked!'}`
        );
      }
      setIsSpinningBonus(false);
    }, 900);
  }, [
    addHarvestAmount,
    availableBonusSpins,
    flipAnimation,
    isDailySpinAvailable,
    isSpinningBonus,
    lockedShopEmojis,
    grantEmojiUnlock,
  ]);

  const handleWatchBonusAd = useCallback(async () => {
    if (hasWatchedBonusAd || isWatchingAd) {
      Alert.alert('Advertisement already viewed', 'Check back tomorrow for more free spins.');
      return;
    }

    setIsWatchingAd(true);
    setBonusMessage('Loading advertisement…');

    try {
      const outcome = await showRewardedAd();
      if (outcome === 'earned') {
        setAvailableBonusSpins((prev) => prev + BONUS_ADDITIONAL_SPINS);
        setHasWatchedBonusAd(true);
        setBonusMessage('You unlocked two more spins!');
      } else if (outcome === 'closed') {
        setBonusMessage('Ad closed before completion. Try again when you can watch the full clip.');
      } else {
        setBonusMessage('Ad is unavailable right now. Please try again later.');
      }
    } catch (error) {
      console.warn('Failed to show rewarded advertisement', error);
      setBonusMessage('Ad is unavailable right now. Please try again later.');
    } finally {
      setIsWatchingAd(false);
    }
  }, [hasWatchedBonusAd, isWatchingAd]);

  const handlePurchaseSpinWithHarvest = useCallback(() => {
    if (isWatchingAd || hasPurchasedBonusSpins) {
      return;
    }

    const cost = 500;
    const success = spendHarvestAmount(cost);
    if (!success) {
      Alert.alert('Not enough harvest', `You need ${cost.toLocaleString()} clicks to purchase extra spins.`);
      return;
    }

    setAvailableBonusSpins((prev) => prev + BONUS_ADDITIONAL_SPINS);
    setHasPurchasedBonusSpins(true);
    setBonusMessage('Purchased two additional spins!');
  }, [hasPurchasedBonusSpins, isWatchingAd, spendHarvestAmount]);

  const handleDismissNotice = useCallback(() => {
    setActiveNotice(null);
    setHasDoubledPassiveHarvest(false);
    setIsWatchingResumeOffer(false);
    clearResumeNotice();
  }, [clearResumeNotice]);

  const handleWatchResumeBonus = useCallback(() => {
    if (
      !activeNotice ||
      activeNotice.type !== 'background' ||
      activeNotice.passiveHarvest <= 0 ||
      hasDoubledPassiveHarvest ||
      isWatchingResumeOffer
    ) {
      return;
    }

    setIsWatchingResumeOffer(true);
    setTimeout(() => {
      setIsWatchingResumeOffer(false);
      setHasDoubledPassiveHarvest(true);
      addHarvestAmount(activeNotice.passiveHarvest);
    }, 1200);
  }, [
    activeNotice,
    addHarvestAmount,
    hasDoubledPassiveHarvest,
    isWatchingResumeOffer,
  ]);



  return (
    <>
      <SafeAreaView style={[
        styles.safeArea, 
        { backgroundColor: gardenSurfaceColor },

      ]}>
        <View style={[
          styles.container, 
          { backgroundColor: gardenSurfaceColor },

        ]}>
          {/* Header always visible */}
          <View style={[
            styles.headerWrapper, 
            { 
              paddingTop: headerPaddingTop,
              paddingLeft: isLandscape ? Math.max(insets.left + 16, 24) : 24,
              paddingRight: isLandscape ? Math.max(insets.right + 16, 24) : 24,
            },
            isLandscape && styles.headerWrapperLandscape
          ]}>
            <View style={[styles.headerShelf, isLandscape && styles.headerShelfLandscape]}>
              <Text style={[styles.headerText, isLandscape && styles.headerTextLandscape]}>Lettuce Idle Garden</Text>
            </View>
          </View>

        <Pressable
          style={[
            styles.content, 
            styles.contentStatic, 
            { 
              paddingTop: isLandscape ? 16 : 32, 
              paddingBottom: contentPaddingBottom,
              paddingLeft: isLandscape ? Math.max(insets.left + 16, 24) : 24, // Add safe area padding in landscape
              paddingRight: isLandscape ? Math.max(insets.right + 16, 24) : 24, // Add safe area padding in landscape
              flexDirection: isLandscape ? 'row' : 'column',
              alignItems: isLandscape ? 'flex-start' : 'stretch',
              justifyContent: isLandscape ? 'space-between' : 'space-between',
            }
          ]}
        >
          <View style={[styles.lettuceWrapper, isLandscape && styles.lettuceWrapperLandscape]}>
            <OrbitingUpgradeEmojis emojis={orbitingUpgradeEmojis} theme={homeEmojiTheme} />
            <GestureDetector gesture={djGesture}>
              <Pressable
                accessibilityLabel="Harvest lettuce"
                onPress={isLoading ? undefined : addHarvest}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.lettuceButton,
                  pressed && styles.lettucePressed,
                  isLoading && { opacity: 0.5 },
                ]}
              >
                <Reanimated.Image
                  source={require('@/assets/images/clicker-icon.png')}
                  style={[
                    styles.lettuceImage,
                    floatingStyle
                  ]}
                  resizeMode="contain"
                />
              </Pressable>
            </GestureDetector>
          </View>

        <View style={[styles.statsSection, isLandscape && styles.statsSectionLandscape]}>
          <GestureDetector gesture={ledgerSwipeGesture}>
            <Reanimated.View style={containerAnimatedStyle}>
              {!showMusicContainer ? (
                <View
                  style={[
                    styles.statsCard,
                    { shadowColor: ledgerTheme.shadowColor },
                    isLandscape && styles.statsCardLandscape,
                  ]}
                  accessibilityRole="text"
                  accessibilityLabel="Harvest Card"
                >
                  <View
                    pointerEvents="none"
                    style={[styles.statsCardBackdrop, { backgroundColor: ledgerTheme.backgroundColor }]}
                  />
                  <View
                    pointerEvents="none"
                    style={[styles.statsCardBorder, { borderColor: ledgerTheme.borderColor }]}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.statsTitle, { color: ledgerTheme.tint }]}>Harvest Card</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: ledgerTheme.muted }]}>Auto Clicks</Text>
                    <Text style={[styles.statValue, { color: ledgerTheme.tint }]}>
                      {autoPerSecond.toLocaleString()}/s
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: ledgerTheme.muted }]}>Available Harvest</Text>
                    <Text style={[
                      styles.statValue, 
                      { 
                        color: ledgerTheme.tint,
                        fontSize: getDynamicFontSize(harvest)
                      }
                    ]}>
                      {formatLifetimeHarvest(harvest)}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: ledgerTheme.muted }]}>Lifetime Harvest</Text>
                    <Text style={[
                      styles.statValue, 
                      { 
                        color: ledgerTheme.tint,
                        fontSize: getDynamicFontSize(lifetimeHarvest)
                      }
                    ]}>
                      {formatLifetimeHarvest()}
                    </Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.statsCard,
                    { shadowColor: ledgerTheme.shadowColor },
                    pressed && styles.statsCardPressed,
                    isLandscape && styles.statsCardLandscape,
                  ]}
                  onPress={isAlarmRinging ? undefined : handleOpenMusic}
                  disabled={isAlarmRinging}
                  accessibilityRole="button"
                  accessibilityLabel="Dream Capsule - Now Playing"
                  accessibilityHint="Tap to open Music Lounge"
                >
                  <View
                    pointerEvents="none"
                    style={[styles.statsCardBackdrop, { backgroundColor: ledgerTheme.backgroundColor }]}
                  />
                  <View
                    pointerEvents="none"
                    style={[styles.statsCardBorder, { borderColor: ledgerTheme.borderColor }]}
                  />
                  
                  {/* Header with Now playing label or Alarm label */}
                  <View style={styles.dreamCapsuleHeader}>
                    {isAlarmRinging ? (
                      <View style={[styles.alarmPill, { backgroundColor: 'rgba(255, 68, 68, 0.15)' }]}>
                        <Text style={[styles.dreamCapsuleLabel, { color: '#ff4444', fontWeight: '700' }]}>
                          ALARM RINGING
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.dreamCapsuleLabel, { color: ledgerTheme.muted }]}>
                        Now playing
                      </Text>
                    )}
                  </View>
                  
                  {isAlarmRinging ? (
                    /* Alarm UI */
                    <>
                      <View style={styles.dreamCapsuleRow}>
                        <View style={[styles.alarmIconBox, { backgroundColor: '#ffffff' }]}>
                          <Text style={styles.alarmEmojiIcon}>⏰</Text>
                        </View>
                        <View style={styles.dreamCapsuleBody}>
                          <Text style={[styles.dreamCapsuleTitle, { color: '#ff4444', fontSize: 22, fontWeight: '900' }]}>
                            Wake Up!
                          </Text>
                          <Text style={[styles.dreamCapsuleSubtitle, { color: ledgerTheme.muted }]}>
                            Tap button below to dismiss
                          </Text>
                        </View>
                      </View>
                      
                      {/* Dismiss Alarm Button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          dismissAlarm();
                        }}
                        style={({ pressed }) => [
                          styles.dreamCapsuleDismissButton,
                          { 
                            backgroundColor: pressed ? '#ff3333' : '#ff4444',
                          }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss alarm"
                      >
                        <Text style={styles.dreamCapsuleDismissButtonText}>
                          STOP ALARM
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    /* Normal Now Playing UI */
                    <>
                  {/* Now Playing Row with Emoji and Title */}
                  <View style={styles.dreamCapsuleRow}>
                    <View style={styles.dreamCapsuleEmojiWrap}>
                      <View style={[styles.dreamCapsuleEmojiStatic, { backgroundColor: ledgerTheme.borderColor }]}>
                        <Text style={styles.dreamCapsuleEmoji}>{selectedTrack.emoji}</Text>
                      </View>
                    </View>
                    <View style={styles.dreamCapsuleBody}>
                      <Text style={[styles.dreamCapsuleTitle, { color: ledgerTheme.tint }]}>
                        {selectedTrack.name}
                      </Text>
                      <Text style={[styles.dreamCapsuleSubtitle, { color: ledgerTheme.muted }]}>
                        Dream Capsule
                      </Text>
                    </View>
                  </View>
                  
                  {/* Controls with three buttons */}
                  <View style={styles.dreamCapsuleControls}>
                    <Pressable
                      onPress={handleSelectPrevious}
                      style={({ pressed }) => [
                        styles.dreamCapsuleControlButton,
                        pressed && styles.dreamCapsuleControlButtonActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Previous sound"
                    >
                      {({ pressed }) => (
                        <Feather
                          name="skip-back"
                          size={24}
                          color={pressed ? ledgerTheme.tint : ledgerTheme.muted}
                        />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleTogglePlaybackWithTimer}
                      style={({ pressed }) => [
                        styles.dreamCapsuleControlButton,
                        styles.dreamCapsuleControlButtonPrimary,
                        (isAmbientPlaying || pressed) && styles.dreamCapsuleControlButtonActive,
                        (isAmbientPlaying || pressed) && styles.dreamCapsuleControlButtonPrimaryActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={isAmbientPlaying ? "Pause ambience" : "Play ambience"}
                    >
                      {({ pressed }) => (
                        <Feather
                          name={isAmbientPlaying ? 'pause' : 'play'}
                          size={isAmbientPlaying ? 30 : 32}
                          style={!isAmbientPlaying ? { marginLeft: 3 } : undefined}
                          color={
                            isAmbientPlaying || pressed
                              ? ledgerTheme.tint
                              : ledgerTheme.muted
                          }
                        />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleSelectNext}
                      style={({ pressed }) => [
                        styles.dreamCapsuleControlButton,
                        pressed && styles.dreamCapsuleControlButtonActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Next sound"
                    >
                      {({ pressed }) => (
                        <Feather
                          name="skip-forward"
                          size={24}
                          color={pressed ? ledgerTheme.tint : ledgerTheme.muted}
                        />
                      )}
                    </Pressable>
                  </View>
                  
                  {/* Progress Bar */}
                  {sleepProgress !== null ? (
                    <View
                      style={styles.sleepProgressWrapper}
                      accessible
                      accessibilityRole="progressbar"
                      accessibilityLabel="Dream Capsule timer progress"
                      accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: Math.round(sleepProgress * 100),
                      }}
                    >
                      <View style={[styles.sleepProgressTrack, { backgroundColor: ledgerTheme.borderColor }]}>
                        <View
                          style={[
                            styles.sleepProgressFill,
                            { 
                              width: `${Math.min(Math.max(sleepProgress, 0), 1) * 100}%`,
                              backgroundColor: '#2dd78f',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                  </>
                  )}
                </Pressable>
              )}


            </Reanimated.View>
          </GestureDetector>
        </View>
        </Pressable>
      </View>
      
      {/* Bottom menu button */}
      <Pressable
        accessibilityLabel={menuOpen ? 'Close garden menu' : 'Open garden menu'}
        accessibilityHint={menuOpen ? undefined : 'Opens actions and emoji theme options'}
        style={({ pressed }) => [
          styles.bottomMenuButton,
          pressed && styles.menuButtonPressed,
        ]}
        onPress={() => setMenuOpen((prev) => !prev)}>
        <Text style={[
          styles.menuIcon,
          menuOpen && styles.menuIconActive
        ]}>
          {menuOpen ? '✕' : customClickEmoji}
        </Text>
      </Pressable>
    </SafeAreaView>

        <Modal
          visible={menuOpen}
          animationType="slide"
          transparent
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.menuSheetOverlay}>
            <Pressable style={styles.menuSheetBackdrop} onPress={() => setMenuOpen(false)} />
            <View style={[styles.menuSheetCard, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.menuSheetHandle} />
              <ScrollView
                style={styles.menuScrollView}
                contentContainerStyle={styles.menuScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                {/* Profile quick-open removed: integrated into Garden Profile card */}
                <Pressable 
                  style={[styles.menuHero, { backgroundColor: accentSurface, shadowColor: accentColor }]}
                  onPress={() => {
                    setMenuOpen(false);
                    setShowProfileQuickAction(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                >
                  <View style={[
                    styles.menuHeroBadge,
                    { backgroundColor: accentColor },
                    !isLandscape && styles.menuHeroBadgePortrait
                  ]}>
                    <Text style={styles.menuHeroEmoji}>{customClickEmoji}</Text>
                  </View>
                  <View style={styles.menuHeroTextBlock}>
                    <Text style={styles.menuHeroTitle}>Garden Profile</Text>
                    <Text style={styles.menuHeroCopy}>
                      Welcome back, {friendlyName}! Tend your profile, grab bonuses, and refresh your theme.
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.menuSheetContent}>
                {menuPage === 'overview' ? (
                  <>
                    <Text style={styles.menuSectionTitle}>Quick actions</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuItemCard,
                        styles.quickActionCard,
                        pressed && styles.menuItemCardPressed,
                      ]}
                      onPress={handleOpenMusic}
                      accessibilityRole="button"
                    >
                      <Pressable
                        style={styles.quickActionIconPressable}
                        onPress={handleQuickActionEmojiPress('music')}
                        accessibilityRole="button"
                        accessibilityLabel="Animate music emoji"
                        hitSlop={8}
                      >
                        <Animated.View
                          style={[
                            styles.menuItemIconWrap,
                            styles.quickActionIconWrap,
                            { transform: [{ rotate: quickActionRotations.music }] },
                          ]}
                        >
                          <Text style={[styles.menuItemIcon, styles.quickActionIcon]}>🎧</Text>
                        </Animated.View>
                      </Pressable>
                      <View style={styles.menuItemBody}>
                        <Text style={[styles.menuItemTitle, styles.quickActionTitle]}>Music Lounge</Text>
                        <Text style={[styles.menuItemSubtitle, styles.quickActionSubtitle]}>
                          Curated ambience for focus &amp; rest
                        </Text>
                      </View>
                      <View style={[styles.menuItemMeta, styles.quickActionMeta]} pointerEvents="none">
                        <Text style={[styles.menuItemChevron, styles.quickActionChevron]}>›</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuItemCard,
                        styles.quickActionCard,
                        pressed && styles.menuItemCardPressed,
                      ]}
                      onPress={handleOpenWidgetPromenade}
                      accessibilityRole="button"
                      accessibilityLabel="Open Widget Promenade"
                    >
                      <Pressable
                        style={styles.quickActionIconPressable}
                        onPress={handleQuickActionEmojiPress('widgets')}
                        accessibilityRole="button"
                        accessibilityLabel="Animate widget promenade emoji"
                        hitSlop={8}
                      >
                        <Animated.View
                          style={[
                            styles.menuItemIconWrap,
                            styles.quickActionIconWrap,
                            { transform: [{ rotate: quickActionRotations.widgets }] },
                          ]}
                        >
                          <Text style={[styles.menuItemIcon, styles.quickActionIcon]}>🖼️</Text>
                        </Animated.View>
                      </Pressable>
                      <View style={styles.menuItemBody}>
                        <Text style={[styles.menuItemTitle, styles.quickActionTitle]}>Widget Promenade</Text>
                        <Text style={[styles.menuItemSubtitle, styles.quickActionSubtitle]}>
                          Showcase saved garden photos
                        </Text>
                      </View>
                      <View style={[styles.menuItemMeta, styles.quickActionMeta]} pointerEvents="none">
                        <View style={[styles.menuPill, styles.widgetQuickActionPill]}>
                          <Text style={[styles.menuPillText, styles.widgetQuickActionPillText]}>
                            {widgetPromenadeStatus}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuItemCard,
                        styles.quickActionCard,
                        pressed && styles.menuItemCardPressed,
                      ]}
                      onPress={handleOpenDailyBonus}
                    >
                      <Pressable
                        style={styles.quickActionIconPressable}
                        onPress={handleQuickActionEmojiPress('bonus')}
                        accessibilityRole="button"
                        accessibilityLabel="Animate daily bonus emoji"
                        hitSlop={8}
                      >
                        <Animated.View
                          style={[
                            styles.menuItemIconWrap,
                            styles.quickActionIconWrap,
                            { transform: [{ rotate: quickActionRotations.bonus }] },
                          ]}
                        >
                          <Text style={[styles.menuItemIcon, styles.quickActionIcon]}>🎁</Text>
                        </Animated.View>
                      </Pressable>
                      <View style={styles.menuItemBody}>
                        <Text style={[styles.menuItemTitle, styles.quickActionTitle]}>Daily Bonus</Text>
                        <Text style={[styles.menuItemSubtitle, styles.quickActionSubtitle]}>
                          Spin for surprise clicks
                        </Text>
                      </View>
                      <View style={[styles.menuItemMeta, styles.quickActionMeta]} pointerEvents="none">
                        <View style={[styles.menuPill, styles.quickActionPill]}>
                          <Text style={[styles.menuPillText, styles.quickActionPillText]}>{dailyMenuStatus}</Text>
                        </View>
                      </View>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuItemCard,
                        styles.quickActionCard,
                        pressed && styles.menuItemCardPressed,
                      ]}
                      onPress={handleOpenGamesHub}
                      accessibilityRole="button"
                      accessibilityLabel="Open Games Hub"
                    >
                      <Pressable
                        style={styles.quickActionIconPressable}
                        onPress={handleQuickActionEmojiPress('games')}
                        accessibilityRole="button"
                        accessibilityLabel="Animate games emoji"
                        hitSlop={8}
                      >
                        <Animated.View
                          style={[
                            styles.menuItemIconWrap,
                            styles.quickActionIconWrap,
                            { transform: [{ rotate: quickActionRotations.games }] },
                          ]}
                        >
                          <Text style={[styles.menuItemIcon, styles.quickActionIcon]}>🎮</Text>
                        </Animated.View>
                      </Pressable>
                      <View style={styles.menuItemBody}>
                        <Text style={[styles.menuItemTitle, styles.quickActionTitle]}>Games Arcade</Text>
                        <Text style={[styles.menuItemSubtitle, styles.quickActionSubtitle]}>
                          Play with your emoji collection
                        </Text>
                      </View>
                      <View style={[styles.menuItemMeta, styles.quickActionMeta]} pointerEvents="none">
                        <Text style={[styles.menuItemChevron, styles.quickActionChevron]}>›</Text>
                      </View>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.menuThemeHeader}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setMenuPage('overview')}
                        style={styles.menuThemeBackButton}
                      >
                        <Text style={styles.menuThemeBackText}>Back</Text>
                      </Pressable>
                      <Text style={styles.menuSectionTitle}>Themes Workshop</Text>
                    </View>
                    <Text style={styles.menuThemeSubtitle}>Choose an orbit style for your garden centerpiece.</Text>
                    <ScrollView
                      style={styles.menuThemeScroll}
                      contentContainerStyle={styles.menuThemeScrollContent}
                      showsVerticalScrollIndicator
                    >
                      {ownedThemeList.map((theme) => {
                        const isActive = homeEmojiTheme === theme.id;
                        return (
                          <Pressable
                            key={theme.id}
                            onPress={() => handleSelectTheme(theme.id)}
                            style={[styles.menuThemeOptionCard, isActive && styles.menuThemeOptionCardActive]}
                          >
                            <View style={styles.menuThemeOptionEmojiWrap}>
                              <Text style={styles.menuThemeOptionEmoji}>{theme.emoji}</Text>
                            </View>
                            <View style={styles.menuThemeOptionBody}>
                              <Text
                                style={[styles.menuThemeOptionName, isActive && styles.menuThemeOptionNameActive]}
                              >
                                {theme.name}
                              </Text>
                              <Text style={styles.menuThemeOptionDescription}>{theme.description}</Text>
                            </View>
                            {isActive ? <Text style={styles.menuThemeOptionBadge}>Active</Text> : null}
                          </Pressable>
                        );
                      })}
                      {ownedThemeList.length === 0 ? (
                        <Text style={styles.menuThemeEmpty}>
                          Unlock themes in the Upgrades tab to customize your orbit.
                        </Text>
                      ) : null}
                    </ScrollView>
                    {lockedThemeCount ? (
                      <Text style={styles.menuThemeFooterNote}>
                        {lockedThemeCount} theme{lockedThemeCount === 1 ? '' : 's'} still locked. Visit the Upgrades tab to
                        unlock more.
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
              </ScrollView>
              <Pressable
                style={styles.menuSheetCloseButton}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Close menu">
                <Text style={styles.menuSheetCloseText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

      <Modal
        visible={showGrowModal}
        animationType="fade"
        transparent
        onRequestClose={handleDismissGrow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Grow your park</Text>
            <Text style={styles.modalCopy}>
              Spend harvest on upgrades to unlock faster auto clicks and stronger tap values. Visit the
              Upgrades tab to power up, then bring your harvest to the Garden tab to decorate your
              dream park.
            </Text>
            <Pressable accessibilityLabel="Close grow your park message" style={styles.modalButton} onPress={handleDismissGrow}>
              <Text style={styles.modalButtonText}>Start growing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(activeNotice)}
        animationType="fade"
        transparent
        onRequestClose={handleDismissNotice}
      >
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>{noticeTitle}</Text>
            <Text style={styles.noticeCopy}>{noticeCopy}</Text>
            {activeNotice?.type === 'background' && activeNotice?.passiveHarvest && activeNotice.passiveHarvest > 0 ? (
              <Text style={styles.noticeInfoText}>
                {hasDoubledPassiveHarvest
                  ? 'Bonus applied! Your doubled clicks are already in your harvest.'
                  : `Watch a quick clip to double your ${activeNotice.passiveHarvest.toLocaleString()} passive clicks.`}
              </Text>
            ) : null}
            {activeNotice?.type === 'background' && activeNotice?.passiveHarvest && activeNotice.passiveHarvest > 0 ? (
              <Pressable
                style={[
                  styles.noticeSecondaryButton,
                  (hasDoubledPassiveHarvest || isWatchingResumeOffer) && styles.noticeSecondaryButtonDisabled,
                ]}
                onPress={handleWatchResumeBonus}
                disabled={hasDoubledPassiveHarvest || isWatchingResumeOffer}
              >
                <Text style={styles.noticeSecondaryText}>
                  {hasDoubledPassiveHarvest
                    ? 'Thanks for watching!'
                    : isWatchingResumeOffer
                      ? 'Loading bonus…'
                      : `Double to ${(activeNotice.passiveHarvest * 2).toLocaleString()} clicks`}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.noticeButton} onPress={handleDismissNotice}>
              <Text style={styles.noticeButtonText}>Back to the garden</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Last reward shown in the bonus modal. Removed from the main page per design. */}

      {lastUnlockedEmoji && (
        <View style={styles.bonusUnlockCard}>
          <Text style={styles.bonusUnlockLabel}>Newest emoji reward</Text>
          <View style={styles.bonusUnlockRow}>
            <View style={styles.bonusUnlockGlyphWrap}>
              <Text style={styles.bonusUnlockGlyph}>{lastUnlockedEmoji.emoji}</Text>
            </View>
            <Text style={styles.bonusUnlockName}>{lastUnlockedEmoji.name}</Text>
          </View>
        </View>
      )}

      <Modal visible={showDailyBonus} animationType="slide" onRequestClose={handleCloseDailyBonus}>
        <SafeAreaView style={[styles.bonusSafeArea, { backgroundColor: gardenSurfaceColor }]}>
          <View style={styles.bonusContainer}>
            <Text style={styles.bonusTitle}>Daily Bonus</Text>
            <Text style={styles.bonusSubtitle}>
              Spin the garden wheel for surprise clicks and fresh emoji unlocks. Claim one free spin every 24 hours!
            </Text>
            <Animated.View
              style={[
                styles.bonusWheel,
                { borderColor: accentColor },
                {
                  transform: [
                    { perspective: 1200 },
                    { rotateY: bonusFlipRotation },
                  ],
                },
              ]}
            >
              <Text style={styles.bonusWheelEmoji}>{customClickEmoji}</Text>
            </Animated.View>
            <Text style={styles.bonusSpinsLabel}>
              {availableBonusSpins} {availableBonusSpins === 1 ? 'spin left' : 'spins left'}
            </Text>
            <View style={styles.bonusCountdownBlock}>
              <Text style={styles.bonusCountdownLabel}>Next free spin</Text>
              <Text
                style={[styles.bonusCountdownValue, isDailySpinAvailable && styles.bonusCountdownReady]}
              >
                {dailyCountdown ?? '—'}
              </Text>
            </View>
            {lastBonusReward ? (
              <Text style={styles.bonusReward}>Last reward: {lastBonusReward.toLocaleString()} clicks</Text>
            ) : null}
            {bonusMessage ? <Text style={styles.bonusMessage}>{bonusMessage}</Text> : null}
            {lastUnlockedEmoji ? (
              <View style={styles.bonusUnlockCard}>
                <Text style={styles.bonusUnlockLabel}>Newest emoji reward</Text>
                <View style={styles.bonusUnlockRow}>
                  <View style={styles.bonusUnlockGlyphWrap}>
                    <Text style={styles.bonusUnlockGlyph}>{lastUnlockedEmoji.emoji}</Text>
                  </View>
                  <Text style={styles.bonusUnlockName}>{lastUnlockedEmoji.name}</Text>
                </View>
              </View>
            ) : null}
            <Pressable
              style={[styles.bonusPrimaryButton, (isSpinningBonus || availableBonusSpins <= 0) && styles.bonusButtonDisabled]}
              onPress={handleSpinBonus}
              disabled={isSpinningBonus || availableBonusSpins <= 0}
              accessibilityLabel="Spin the bonus wheel"
            >
              <Text style={styles.bonusPrimaryText}>
                {availableBonusSpins > 0
                  ? isSpinningBonus
                    ? 'Spinning…'
                    : 'Spin for emoji rewards'
                  : 'No spins left'}
              </Text>
            </Pressable>
            <View style={styles.bonusActionsRow}>
              <Pressable
                style={[styles.bonusSecondaryButton, isWatchingAd && styles.bonusButtonDisabled]}
                onPress={handleWatchBonusAd}
                disabled={isWatchingAd}
                accessibilityLabel="Watch an advertisement for spins"
              >
                <Text style={styles.bonusSecondaryText}>
                  {isWatchingAd ? 'Loading…' : hasWatchedBonusAd ? 'Ad watched' : 'Watch ad for 2 spins'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.bonusSecondaryButton, hasPurchasedBonusSpins && styles.bonusButtonDisabled]}
                onPress={handlePurchaseSpinWithHarvest}
                disabled={hasPurchasedBonusSpins}
                accessibilityLabel="Buy extra spins"
              >
                <Text style={styles.bonusSecondaryText}>
                  {hasPurchasedBonusSpins ? 'Spins purchased' : 'Buy 2 spins (500 clicks)'}
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.bonusCloseButton} onPress={handleCloseDailyBonus} accessibilityLabel="Close daily bonus">
              <Text style={styles.bonusCloseText}>Back to the garden</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showProfileQuickAction}
        animationType="slide"
        transparent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={handleCloseProfileQuickAction}
      >
        <ProfileContent mode="modal" onRequestClose={handleCloseProfileQuickAction} />
      </Modal>

      <Modal
        visible={showMusicQuickAction}
        animationType="slide"
        onRequestClose={handleCloseMusicQuickAction}
      >
        <MusicContent mode="modal" onRequestClose={handleCloseMusicQuickAction} />
      </Modal>

      <Modal
        visible={showWidgetPromenade}
        animationType="slide"
        onRequestClose={handleCloseWidgetPromenade}
      >
        <SafeAreaView style={styles.promenadeSafeArea}>
          <View style={[styles.promenadeContainer, { paddingTop: insets.top + 24 }]}> 
            <View style={styles.promenadeHeader}>
              <Text style={styles.promenadeTitle}>Widget Promenade</Text>
              <Pressable
                style={styles.promenadeCloseButton}
                onPress={handleCloseWidgetPromenade}
                accessibilityLabel="Close Widget Promenade"
              >
                <Text style={styles.promenadeCloseText}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.promenadeSubtitle}>
              Saved snapshots appear in your widget museum when you add Lettuce World to your home screen.
            </Text>
            {widgetPromenadeSorted.length === 0 ? (
              <View style={styles.promenadeEmptyState}>
                <Text style={styles.promenadeEmptyTitle}>No snapshots yet</Text>
                <Text style={styles.promenadeEmptyCopy}>
                  Save a garden photo and choose “Add to Promenade” to build your widget gallery.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.promenadeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {widgetPromenadeSorted.map((entry) => (
                  <View key={entry.id} style={[styles.promenadeItem, selectedWidgetPromenadeId === entry.id && styles.promenadeItemSelected]}> 
                    <Image source={{ uri: entry.uri }} style={styles.promenadeImage} />
                    <View style={styles.promenadeMetaRow}>
                      <Text style={styles.promenadeMetaText}>{formatWidgetTimestamp(entry.savedAt)}</Text>
                      <Pressable
                        style={styles.promenadeRemoveButton}
                        onPress={() => handleRemovePromenadePhoto(entry.id)}
                        accessibilityLabel="Remove snapshot from Widget Promenade"
                      >
                        <Text style={styles.promenadeRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      style={[styles.promenadeSelectButton, selectedWidgetPromenadeId === entry.id && styles.promenadeSelectButtonSelected]}
                      onPress={() => handleSelectWidgetPromenadeId(entry.id)}
                      accessibilityLabel={selectedWidgetPromenadeId === entry.id ? "Selected for Android widget" : "Select for Android widget"}
                    >
                      <Text style={styles.promenadeSelectText}>
                        {selectedWidgetPromenadeId === entry.id ? "Selected for Widget" : "Select for Widget"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <GamesHub
        visible={showGamesHub}
        onRequestClose={handleCloseGamesHub}
        emojiInventory={emojiInventory}
        emojiCatalog={emojiCatalog}
        customEmojiNames={customEmojiNames}
        hasPremiumUpgrade={hasPremiumUpgrade}
        onPurchasePremium={purchasePremiumUpgrade}
      />

      <TemperatureUnitModal
        visible={showTemperatureUnitModal}
        onClose={() => setShowTemperatureUnitModal(false)}
        currentUnit={temperatureUnit}
        onSelectUnit={setTemperatureUnit}
        sampleTemperature={22}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },

  container: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },

  expandedFullView: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },

  headerWrapper: {
    paddingBottom: 20,
    zIndex: 10,
    elevation: 10,
  },
  headerWrapperLandscape: {
    paddingBottom: 12,
  },
  headerShelf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(20, 83, 45, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  headerTextLandscape: {
  fontSize: 24,
  fontWeight: '900',
  color: '#14532d',
  letterSpacing: 0.4,
  textShadowColor: 'rgba(20, 83, 45, 0.1)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
  textAlign: 'center',
  flexShrink: 1,
  flexGrow: 1,
  maxWidth: '60%',
  marginRight: 16,
  marginLeft: 16,
  alignSelf: 'center',
  overflow: 'hidden',
  },
  menuButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    position: 'relative', // Enable absolute positioning for child
    width: 42, // Fixed width for consistent positioning
    height: 42, // Fixed height for consistent positioning
  },
  bottomMenuButton: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  menuButtonActive: {
    backgroundColor: 'rgba(21, 101, 52, 0.08)',
    borderColor: 'rgba(21, 101, 52, 0.16)',
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(21, 101, 52, 0.14)',
    borderColor: 'rgba(21, 101, 52, 0.22)',
  },
  menuIcon: {
    fontSize: 36,
    color: '#166534',
    fontWeight: '700',
  },
  menuIconPortrait: {
    top: 0, // Move further to top corner in portrait
    right: 2, // Move further to right corner in portrait
  },
  menuIconActive: {
    color: '#0f5132',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alarmButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  alarmButtonPressed: {
    backgroundColor: 'rgba(21, 101, 52, 0.14)',
    borderColor: 'rgba(21, 101, 52, 0.22)',
  },
  alarmIcon: {
    fontSize: 28,
    color: '#166534',
    fontWeight: '700',
  },
  bedsideButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  bedsideButtonPressed: {
    backgroundColor: 'rgba(21, 101, 52, 0.14)',
    borderColor: 'rgba(21, 101, 52, 0.22)',
  },
  bedsideIcon: {
    fontSize: 26,
    color: '#166534',
    fontWeight: '700',
  },
  bedsideWidgetTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  bedsideWidgetTopRight: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  bedsideWidgetBottomLeft: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  bedsideWidgetBottomRight: {
    position: 'absolute',
    bottom: 60,
    right: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  bedsideWidgetIcon: {
    fontSize: 24,
    textAlign: 'center',
  },
  bedsideWidgetDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  bedsideWidgetBatteryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  headerShelfLandscape: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  position: 'relative',
  },
  headerSpacer: {
    flex: 1,
  },
  expandButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  expandButtonPressed: {
    backgroundColor: 'rgba(21, 101, 52, 0.14)',
    borderColor: 'rgba(21, 101, 52, 0.22)',
  },
  expandButtonActive: {
    backgroundColor: 'rgba(21, 101, 52, 0.08)',
    borderColor: 'rgba(21, 101, 52, 0.16)',
  },
  expandIcon: {
    fontSize: 24,
    color: '#166534',
    fontWeight: '700',
  },
  expandIconActive: {
    color: '#0f5132',
  },

  content: {
    gap: 28,
  },
  contentStatic: {
    flex: 1,
    justifyContent: 'space-between',
  },
  lettuceWrapper: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettuceWrapperLandscape: {
    width: 200,
    height: 200,
    marginRight: 30, // Further reduced to give more space to harvest card
    marginLeft: 40,  // Slightly increased to center better
    alignSelf: 'flex-start',
  },
  lettuceWrapperExpandedAligned: {
    marginTop: 10, // Further reduced to move clicker higher up
    alignSelf: 'center',
  },
  lettuceBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPulseContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
  },
  audioPulseRingSecondary: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
  },
  audioPulseCore: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ecfdf3',
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  backdropBubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.85,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    backgroundColor: '#bbf7d0',
  },
  backdropBubbleOne: {
    width: 220,
    height: 220,
    shadowColor: '#34d399',
    shadowOpacity: 0.32,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 18 },
  },
  backdropBubbleTwo: {
    width: 170,
    height: 170,
    backgroundColor: '#c4f1f9',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.28,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 16 },
  },
  backdropBubbleThree: {
    width: 120,
    height: 120,
    backgroundColor: '#fef3c7',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
  },
  lettuceButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettuceButtonBase: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.92,
    bottom: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  lettuceButtonFace: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  lettuceButtonHighlight: {
    position: 'absolute',
    top: 22,
    width: '60%',
    height: '32%',
    borderRadius: 999,
    opacity: 0.25,
  },
  backdropHalo: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
    borderWidth: 2,
  },
  backdropHaloOuter: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(165, 243, 252, 0.25)',
    borderColor: 'rgba(14, 116, 144, 0.25)',
  },
  backdropHaloMiddle: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(190, 242, 100, 0.25)',
    borderColor: 'rgba(101, 163, 13, 0.28)',
  },
  backdropHaloInner: {
    width: 150,
    height: 150,
    backgroundColor: 'rgba(192, 132, 252, 0.22)',
    borderColor: 'rgba(109, 40, 217, 0.28)',
  },
  lettucePressed: {
    transform: [{ scale: 0.95 }],
  },
  lettuceEmoji: {
    fontSize: 68,
  },
  lettuceImage: {
    width: 400,
    height: 400,
  },
  statsCard: {
    position: 'relative',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
    backgroundColor: 'transparent',
    minWidth: 240,
    maxWidth: 300,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  statsCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  statsSection: {
    flex: 1,
    marginTop: 15, // Slightly reduced to raise it up
    alignItems: 'center', // Center the harvest card/dream capsule container
  },
  statsSectionLandscape: {
    flex: 0.7, // Increase flex to give it more space and pull it inward
    marginLeft: -5, // Move further left for better alignment
    marginTop: -5, // Negative margin to move it up further in landscape
    marginRight: 20, // Increase right margin to maintain spacing
  },
  statsCardLandscape: {
    paddingVertical: 16, // Slightly more compact for landscape
    paddingHorizontal: 20, // Good balance for landscape
    gap: 10, // Tighter gap for landscape
    minWidth: 240, // Match portrait exactly
    maxWidth: 260, // More constrained for better fit
  },
  statsCardBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  statsCardGrain: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24, // Match updated stats card border radius
    transform: [{ rotate: '2deg' }],
  },
  statsCardFrost: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28, // Slightly larger than stats card
    opacity: 0.22, // Subtler effect for cleaner look
    transform: [{ scaleX: 1.25 }, { scaleY: 1.3 }, { rotate: '12deg' }],
  },
  statsCardSheen: {
    position: 'absolute',
    top: -64,
    left: -42,
    width: '160%',
    height: '64%',
    borderRadius: 220,
    opacity: 0.6,
    transform: [{ rotate: '-12deg' }],
  },
  statsCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
  },
  statsCardInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    margin: 8,
    opacity: 0.55,
  },
  statsCardStitch: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    margin: 10,
    opacity: 0.75,
  },
  statsCardEmojiBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    zIndex: 10, // Higher z-index to appear above other background layers
  },
  statsCardBackgroundEmoji: {
    position: 'absolute',
    fontSize: 20, // Slightly larger for better visibility
    zIndex: 10, // Match container z-index
    color: 'rgba(0, 0, 0, 0.15)', // Explicit color with transparency
  },
  statsTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    minHeight: 32,
    gap: 8, // Add gap between label and value to prevent overlap
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1, // Allow label to take available space
    flexShrink: 1, // Allow shrinking if needed
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right', // Right-align the value
    flexShrink: 1, // Allow value to shrink if needed
    maxWidth: '60%', // Prevent value from taking more than 60% of width
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f6f4a',
  },
  modalCopy: {
    fontSize: 15,
    color: '#2d3748',
    lineHeight: 22,
  },
  modalButton: {
    marginTop: 8,
    backgroundColor: '#1f6f4a',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  menuSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 31, 23, 0.58)',
  },
  menuSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuSheetCard: {
    backgroundColor: '#f0fff4',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    shadowColor: '#0f2e20',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    height: '85%',
    alignSelf: 'center',
    width: '100%',
  },
  menuScrollView: {
    flex: 1,
  },
  menuScrollContent: {
    gap: 20,
    paddingBottom: 16,
  },
  menuSheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#bbf7d0',
  },
  menuProfileButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  menuProfileEmoji: {
    fontSize: 28,
    textAlign: 'center',
  },
  menuSheetContent: {
    gap: 18,
  },
  menuHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    position: 'relative', // Allow absolute children
  },
  menuHeroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  // Portrait variant: keep the badge inline to the left of the title (not absolute)
  menuHeroBadgePortrait: {
    position: 'relative',
    top: 0,
    right: 0,
    marginRight: 12,
    zIndex: 2,
  },
  menuHeroEmoji: {
    fontSize: 32,
  },
  menuHeroTextBlock: {
    flex: 1,
    gap: 6,
  },
  menuHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#134e32',
  },
  menuHeroCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: '#166534',
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134e32',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.18)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  menuItemCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  menuItemIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIcon: {
    fontSize: 26,
    color: '#134e32',
  },
  menuItemBody: {
    flex: 1,
    gap: 4,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134e32',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#2d3748',
  },
  menuItemMeta: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    gap: 4,
  },
  menuItemChevron: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  menuPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#14532d',
  },
  menuPillText: {
    color: '#f0fff4',
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionCard: {
    backgroundColor: '#166534',
    borderColor: '#0f3f26',
    shadowColor: 'rgba(6, 78, 59, 0.6)',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  quickActionIconPressable: {
    borderRadius: 18,
  },
  quickActionIconWrap: {
    backgroundColor: '#1b7a45',
    borderColor: '#0f3f26',
    overflow: 'hidden',
  },
  quickActionIcon: {
    color: '#ecfdf5',
  },
  quickActionWidgetImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  quickActionTitle: {
    color: '#f0fff4',
  },
  quickActionSubtitle: {
    color: '#d1fae5',
  },
  quickActionMeta: {
    alignItems: 'flex-end',
  },
  quickActionChevron: {
    color: '#bbf7d0',
  },
  quickActionPill: {
    backgroundColor: '#bbf7d0',
  },
  quickActionPillText: {
    color: '#065f46',
  },
  widgetQuickActionPill: {
    backgroundColor: '#dcfce7',
  },
  widgetQuickActionPillText: {
    color: '#14532d',
    fontWeight: '700',
  },
  dreamCapsuleHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.85,
  },
  dreamCapsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dreamCapsuleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  dreamCapsuleMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  dreamCapsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  dreamCapsuleEmojiWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dreamCapsuleEmojiStatic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dreamCapsuleEmoji: {
    fontSize: 32,
  },
  dreamCapsuleBody: {
    flex: 1,
    gap: 4,
  },
  dreamCapsuleTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  dreamCapsuleSubtitle: {
    fontSize: 13,
    lineHeight: 16,
    opacity: 0.8,
  },
  dreamCapsuleStatusBlock: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  dreamCapsuleStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dreamCapsuleStatusHeadline: {
    fontSize: 13,
    fontWeight: '600',
  },
  dreamCapsuleStatusValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  dreamCapsuleControls: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  dreamCapsuleControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dreamCapsuleControlButtonPrimary: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
  },
  dreamCapsuleControlButtonActive: {
    transform: [{ scale: 1.05 }],
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  dreamCapsuleControlButtonPrimaryActive: {
    transform: [{ scale: 1.08 }],
  },
  dreamCapsuleControlIcon: {
    fontSize: 24,
  },
  dreamCapsuleControlIconPrimary: {
    fontSize: 28,
  },
  sleepProgressWrapper: {
    marginTop: 12,
    paddingHorizontal: 2,
  },
  sleepProgressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  sleepProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  dreamCapsuleDismissButton: {
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: '#ff4444',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dreamCapsuleDismissButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  alarmPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  alarmIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alarmEmojiIcon: {
    fontSize: 32,
  },
  promenadeSafeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
  promenadeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  promenadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promenadeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#14532d',
  },
  promenadeSubtitle: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 12,
  },
  promenadeCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#14532d',
  },
  promenadeCloseText: {
    color: '#f0fff4',
    fontSize: 14,
    fontWeight: '700',
  },
  promenadeEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  promenadeEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#14532d',
    marginBottom: 6,
  },
  promenadeEmptyCopy: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    textAlign: 'center',
  },
  promenadeScrollContent: {
    paddingBottom: 48,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  promenadeItem: {
    width: '48%',
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    padding: 12,
    marginBottom: 18,
    shadowColor: 'rgba(20, 83, 45, 0.25)',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  promenadeImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
  },
  promenadeMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promenadeMetaText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  promenadeRemoveButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 101, 52, 0.12)',
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promenadeRemoveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14532d',
  },
  menuThemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuThemeBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 83, 45, 0.12)',
  },
  menuThemeBackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532d',
  },
  menuThemeSubtitle: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  menuThemeScroll: {
    maxHeight: 320,
    borderRadius: 18,
  },
  menuThemeScrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  menuThemeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  menuThemeOptionCardActive: {
    borderWidth: 1,
    borderColor: '#34d399',
    shadowColor: '#34d399',
    shadowOpacity: 0.25,
  },
  menuThemeOptionEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuThemeOptionEmoji: {
    fontSize: 26,
  },
  menuThemeOptionBody: {
    flex: 1,
    gap: 2,
  },
  menuThemeOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14532d',
  },
  menuThemeOptionNameActive: {
    color: '#047857',
  },
  menuThemeOptionDescription: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  menuThemeOptionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  menuThemeEmpty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 13,
    color: '#1f2937',
  },
  menuThemeFooterNote: {
    fontSize: 12,
    color: '#14532d',
  },
  menuSheetCloseButton: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: '#1f6f4a',
  },
  menuSheetCloseText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  bonusSafeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
  bonusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 32,
    gap: 18,
  },
  bonusTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14532d',
    textAlign: 'center',
  },
  bonusSubtitle: {
    fontSize: 15,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 22,
  },
  bonusWheel: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#1f2937',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  bonusWheelEmoji: {
    fontSize: 84,
  },
  bonusSpinsLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#14532d',
  },
  bonusCountdownBlock: {
    alignItems: 'center',
    gap: 4,
  },
  bonusCountdownLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bonusCountdownValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  bonusCountdownReady: {
    color: '#0f766e',
  },
  bonusReward: {
    fontSize: 16,
    color: '#1f2937',
  },
  bonusMessage: {
    fontSize: 14,
    color: '#0f766e',
    textAlign: 'center',
  },
  bonusUnlockCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'flex-start',
  },
  bonusUnlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bonusUnlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bonusUnlockGlyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusUnlockGlyph: {
    fontSize: 26,
  },
  bonusUnlockName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f3d2b',
  },
  bonusPrimaryButton: {
    width: '100%',
    backgroundColor: '#14532d',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bonusPrimaryText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  bonusActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  bonusSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusSecondaryText: {
    color: '#0f766e',
    fontWeight: '600',
    textAlign: 'center',
  },
  bonusButtonDisabled: {
    opacity: 0.6,
  },
  bonusCloseButton: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: '#1f6f4a',
  },
  bonusCloseText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
    gap: 16,
    shadowColor: '#0f2e20',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  noticeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f6f4a',
    textAlign: 'center',
  },
  noticeCopy: {
    fontSize: 15,
    color: '#2d3748',
    lineHeight: 22,
    textAlign: 'center',
  },
  noticeInfoText: {
    fontSize: 13,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
  },
  noticeSecondaryButton: {
    alignSelf: 'center',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#bbf7d0',
    borderWidth: 1,
    borderColor: 'rgba(21, 101, 52, 0.24)',
  },
  noticeSecondaryButtonDisabled: {
    backgroundColor: '#e2e8f0',
    borderColor: 'rgba(148, 163, 184, 0.6)',
  },
  noticeSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#134e32',
    textAlign: 'center',
  },
  noticeButton: {
    marginTop: 4,
    alignSelf: 'center',
    backgroundColor: '#1f6f4a',
    borderRadius: 18,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  noticeButtonText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  volumeIndicator: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  volumeIndicatorLandscape: {
    position: 'relative',
    bottom: 0,
    marginTop: 8,
    marginBottom: 4,
  },
  volumeTrack: {
    width: 80,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  volumeTrackLandscape: {
    width: 100,
    height: 8,
  },
  volumeFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  volumeLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  volumeLabelLandscape: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 1,
  },

  menuButtonLandscape: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  menuButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#166534',
  },
  djWheel: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  djWheelText: {
    fontSize: 24,
    textAlign: 'center',
  },
  djWheelDots: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  djWheelDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },

  // Transparent bedside widgets (no white containers)
  bedsideWidgetTopLeftTransparent: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1001,
  },
  bedsideWidgetTopRightTransparent: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1001,
  },
  bedsideWidgetBottomLeftTransparent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 1001,
  },
  bedsideWidgetBottomRightTransparent: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1001,
  },
  bedsideWidgetText: {
    fontSize: 16,  // Increased from 12 to make bigger
    fontWeight: '700',
    textShadowColor: 'rgba(128, 128, 128, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },

  // Temperature settings container
  temperatureSettingsContainer: {
    position: 'absolute',
    top: '25%', // Moved higher to avoid collision with harvest card
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -40 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly more opaque
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  temperatureSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  temperatureSettingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  temperatureSettingsClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  temperatureSettingsCloseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  temperatureUnitButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  temperatureUnitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  temperatureUnitButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  temperatureUnitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  temperatureUnitButtonTextActive: {
    color: '#FFFFFF',
  },
  rssWidgetContainer: {
    position: 'absolute',
    bottom: -50, // Moved lower to avoid covering date/battery widgets
    left: -50, // Extend past left edge (charger port)
    right: -50, // Extend past right edge (dynamic island)
    height: 100, // Reduced height to avoid covering date/battery
    backgroundColor: '#ffffff', // Full opacity white background
    paddingHorizontal: 50, // Increased padding to account for extended edges
    paddingVertical: 0,
    paddingTop: 8, // Reduced top padding
    paddingBottom: 45, // Reduced bottom padding
    borderRadius: 0, // No border radius - true edge-to-edge bleeding
    zIndex: 1003, // High z-index to sit on top
    // Add subtle top border for separation
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  promenadeItemSelected: {
    borderWidth: 2,
    borderColor: '#34d399',
    shadowColor: '#34d399',
    shadowOpacity: 0.25,
  },
  promenadeSelectButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
  },
  promenadeSelectButtonSelected: {
    backgroundColor: '#34d399',
  },
  promenadeSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
});

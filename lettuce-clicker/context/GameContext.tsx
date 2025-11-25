import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { weatherService } from '../lib/weatherService';
import { rssService, type RSSFeed, type RSSFeedItem } from '../lib/rssService';

import { computeBellCurveCost, gardenEmojiCatalog } from '@/constants/emojiCatalog';
// Use small emoji name mapping to provide a real name for custom/freeform emojis when possible
// We keep this import minimal and optional; fallback behavior preserves current name/tags.
// @ts-ignore - package does not provide types
import emojiNameMap from 'emoji-name-map';
import { AppState, AppStateStatus } from 'react-native';

export type HomeEmojiTheme =
  | 'circle'
  | 'spiral'
  | 'matrix'
  | 'clear'
  | 'bubble'
  | 'bubble-pop'
  | 'wave'
  | 'lake'
  | 'echo'
  | 'confetti'
  | 'laser'
  | 'aurora'
  | 'firefly'
  | 'starlight'
  | 'nebula'
  | 'supernova';

export type UpgradeDefinition = {
  id: string;
  name: string;
  description: string;
  cost: number;
  increment: number;
  emoji: string;
};

export type EmojiThemeDefinition = {
  id: HomeEmojiTheme;
  name: string;
  description: string;
  cost: number;
  emoji: string;
};

export type EmojiCategory = 'plants' | 'scenery' | 'creatures' | 'features' | 'accents';

export type EmojiDefinition = {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  category: EmojiCategory;
  tags: string[];
  popularity: number;
  imageUrl?: string;
};

type PlacementBase = {
  id: string;
  kind: 'emoji' | 'photo' | 'text';
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type EmojiPlacement = PlacementBase & {
  kind: 'emoji';
  emojiId: string;
};

export type PhotoPlacement = PlacementBase & {
  kind: 'photo';
  imageUri: string;
};

export type TextStyleId = 'sprout' | 'bloom' | 'canopy' | 'whisper' | 'serif' | 'rounded' | 'script' | 'mono';

export type TextPlacement = PlacementBase & {
  kind: 'text';
  text: string;
  color: string;
  style: TextStyleId;
};

export type Placement = EmojiPlacement | PhotoPlacement | TextPlacement;

export type WidgetPromenadeEntry = {
  id: string;
  uri: string;
  savedAt: number;
};

type ResumeNoticeBase = {
  timestamp: number;
  harvestSnapshot: number;
  lifetimeHarvestSnapshot: number;
  autoPerSecondSnapshot: number;
};

type PassiveResumeNotice =
  | (ResumeNoticeBase & {
      type: 'returning';
      lifetimeHarvest: number;
    })
  | (ResumeNoticeBase & {
      type: 'background';
      passiveHarvest: number;
      greeting: string;
    });

type GameContextValue = {
  harvest: number;
  lifetimeHarvest: number;
  formatLifetimeHarvest: (value?: number) => string;
  profileLifetimeTotal: number;
  tapValue: number;
  autoPerSecond: number;
  upgrades: UpgradeDefinition[];
  purchasedUpgrades: Record<string, number>;
  orbitingUpgradeEmojis: OrbitingEmoji[];
  emojiCatalog: EmojiDefinition[];
  emojiInventory: Record<string, boolean>;
  placements: Placement[];
  profileName: string;
  profileUsername: string;
  profileImageUri: string | null;
  profilePhotoWidgetEnabled: boolean;
  homeEmojiTheme: HomeEmojiTheme;
  emojiThemes: EmojiThemeDefinition[];
  ownedThemes: Record<HomeEmojiTheme, boolean>;
  resumeNotice: PassiveResumeNotice | null;
  hasPremiumUpgrade: boolean;
  premiumAccentColor: string;
  customClickEmoji: string;
  gardenBackgroundColor: string;
  isExpandedView: boolean;
  bedsideWidgetsEnabled: boolean;
  weatherData: { temperature: number; condition: string; emoji: string; location: string } | null;
  weatherError: string | null;
  weatherLastUpdated: number;
  temperatureUnit: 'celsius' | 'fahrenheit';
  hasManuallySetTemperatureUnit: boolean;
  rssFeeds: RSSFeed[];
  rssItems: RSSFeedItem[];
  rssError: string | null;
  rssLastUpdated: number;
  widgetPromenade: WidgetPromenadeEntry[];
  registerCustomEmoji: (
    emoji: string,
    options?: { name?: string; costOverride?: number; imageUrl?: string; tags?: string[] }
  ) => EmojiDefinition | null;
  setProfileLifetimeTotal: (value: number) => void;
  addHarvest: () => void;
  addHarvestAmount: (amount: number) => void;
  spendHarvestAmount: (amount: number) => boolean;
  purchaseUpgrade: (upgradeId: string) => boolean;
  purchaseEmojiTheme: (themeId: HomeEmojiTheme) => boolean;
  purchaseEmoji: (emojiId: string, definition?: EmojiDefinition) => boolean;
  grantEmojiUnlock: (emojiId: string) => boolean;
  placeEmoji: (emojiId: string, position: { x: number; y: number }) => boolean;
  addPhotoPlacement: (imageUri: string, position: { x: number; y: number }) => boolean;
  addTextPlacement: (
    text: string,
    position: { x: number; y: number },
    color?: string,
    style?: TextStyleId,
    scale?: number
  ) => boolean;
  updatePlacement: (placementId: string, updates: Partial<Placement>) => void;
  removePlacement: (placementId: string) => void;
  clearGarden: () => void;
  setProfileName: (value: string) => void;
  setProfileUsername: (value: string) => void;
  setProfileImageUri: (uri: string | null) => void;
  setProfilePhotoWidgetEnabled: (value: boolean) => void;
  setHomeEmojiTheme: (theme: HomeEmojiTheme) => void;
  purchasePremiumUpgrade: () => void;
  setPremiumAccentColor: (color: string) => void;
  setCustomClickEmoji: (emoji: string) => void;
  setGardenBackgroundColor: (color: string) => void;
  setIsExpandedView: (value: boolean) => void;
  setBedsideWidgetsEnabled: (value: boolean) => void;
  updateWeatherData: () => Promise<void>;
  clearWeatherData: () => void;
  setTemperatureUnit: (unit: 'celsius' | 'fahrenheit') => void;
  setHasManuallySetTemperatureUnit: (value: boolean) => void;
  updateRSSFeeds: () => Promise<void>;
  clearRSSData: () => void;
  toggleRSSFeed: (feedId: string, enabled: boolean) => void;
  addCustomRSSFeed: (feed: Omit<RSSFeed, 'id'>) => void;
  removeRSSFeed: (feedId: string) => void;
  clearResumeNotice: () => void;
  addWidgetPromenadePhoto: (uri: string) => WidgetPromenadeEntry | null;
  removeWidgetPromenadePhoto: (entryId: string) => void;
  resetGame: () => Promise<void>;
};

const PROFILE_STORAGE_KEY = 'lettuce-click:profile';
const THEME_STORAGE_KEY = 'lettuce-click:emoji-theme';
const GAME_STORAGE_KEY = 'lettuce-click:game';
const LAST_EXIT_STORAGE_KEY = 'lettuce-click:last-exit';

const upgradeCatalog: UpgradeDefinition[] = [
  {
    id: 'watering-can',
    name: 'Watering Can',
    description: 'Adds +1 click per second with a gentle sprinkle.',
    cost: 50,
    increment: 1,
    emoji: '💧',
  },
  {
    id: 'gardeners-gloves',
    name: 'Bloomguard Gloves',
    description: 'Adds +5 clicks per second with bloom-bright protection.',
    cost: 100,
    increment: 5,
    emoji: '🌱',
  },
  {
    id: 'sun-soaker',
    name: 'Sun Soaker Panels',
    description: 'Solar warmth adds +10 clicks per second.',
    cost: 400,
    increment: 10,
    emoji: '☀️',
  },
  {
    id: 'greenhouse',
    name: 'Mini Greenhouse',
    description: 'Climate control adds +20 clicks per second.',
    cost: 600,
    increment: 20,
    emoji: '🏡',
  },
  {
    id: 'irrigation',
    name: 'Irrigation Network',
    description: 'A flowing network adds +35 clicks per second.',
    cost: 1200,
    increment: 35,
    emoji: '🚿',
  },
  {
    id: 'pollinator-drones',
    name: 'Pollinator Drones',
    description: 'Autonomous helpers add +75 clicks per second.',
    cost: 5000,
    increment: 75,
    emoji: '🛸',
  },
  {
    id: 'soil-lab',
    name: 'Soil Enrichment Lab',
    description: 'Lab-grown compost adds +150 clicks per second.',
    cost: 12000,
    increment: 150,
    emoji: '🧪',
  },
  {
    id: 'weather-dome',
    name: 'Weather Dome',
    description: 'Precision weather control adds +400 clicks per second.',
    cost: 55000,
    increment: 400,
    emoji: '🌦️',
  },
  {
    id: 'quantum-growlights',
    name: 'Quantum Growlights',
    description: 'Quantum illumination adds +1,200 clicks per second.',
    cost: 250000,
    increment: 1200,
    emoji: '💡',
  },
  {
    id: 'hydroponic-spire',
    name: 'Hydroponic Spire',
    description: 'Vertical farms add +4,500 clicks per second.',
    cost: 1250000,
    increment: 4500,
    emoji: '🏙️',
  },
  {
    id: 'bioengineered-forest',
    name: 'Bioengineered Forest',
    description: 'Designer ecosystems add +18,000 clicks per second.',
    cost: 7500000,
    increment: 18000,
    emoji: '🧬',
  },
  {
    id: 'orbital-greenhouse',
    name: 'Orbital Greenhouse',
    description: 'Low-gravity growth adds +75,000 clicks per second.',
    cost: 42000000,
    increment: 75000,
    emoji: '🛰️',
  },
  {
    id: 'terraforming-fleet',
    name: 'Terraforming Fleet',
    description: 'Planet-scale gardeners add +320,000 clicks per second.',
    cost: 195000000,
    increment: 320000,
    emoji: '🚀',
  },
  {
    id: 'galactic-arborists',
    name: 'Galactic Arborists Guild',
    description: 'Interstellar caretakers add +1,350,000 clicks per second.',
    cost: 650000000,
    increment: 1350000,
    emoji: '🌌',
  },
  {
    id: 'cosmic-bloom',
    name: 'Cosmic Bloom Engine',
    description: 'Reality-bending growth adds +5,500,000 clicks per second.',
    cost: 1000000000,
    increment: 5500000,
    emoji: '🪐',
  },
  {
    id: 'stellar-seedvault',
    name: 'Stellar Seed Vault',
    description: 'Preserved starlit seeds add +25,000,000 clicks per second.',
    cost: 5_500_000_000,
    increment: 25000000,
    emoji: '🌠',
  },
  {
    id: 'chronogreenhouse',
    name: 'Chrono Greenhouse Array',
    description: 'Time-looped growth adds +120,000,000 clicks per second.',
    cost: 28_000_000_000,
    increment: 120000000,
    emoji: '⏳',
  },
  {
    id: 'multiversal-arbor',
    name: 'Multiversal Arbor',
    description: 'Parallel gardens add +750,000,000 clicks per second.',
    cost: 180_000_000_000,
    increment: 750000000,
    emoji: '🌀',
  },
  {
    id: 'celestial-terraformers',
    name: 'Celestial Terraformer Fleet',
    description: 'Constellation caretakers add +4,200,000,000 clicks per second.',
    cost: 1_200_000_000_000,
    increment: 4200000000,
    emoji: '🌟',
  },
  {
    id: 'infinite-bloom',
    name: 'Infinite Bloom Lattice',
    description: 'Reality-folding trellises add +22,000,000,000 clicks per second.',
    cost: 10_000_000_000_000,
    increment: 22000000000,
    emoji: '🪷',
  },
];

const emojiThemeCatalog: EmojiThemeDefinition[] = [
  {
    id: 'circle',
    name: 'Circle Orbit',
    description: 'Classic looping orbit that keeps emojis in a smooth circle.',
    cost: 0,
    emoji: '🔵',
  },
  {
    id: 'spiral',
    name: 'Spiral Bloom',
    description: 'Expanding spiral arms drift gently through the garden air.',
    cost: 0,
    emoji: '🌀',
  },
  {
    id: 'matrix',
    name: 'Matrix Cascade',
    description: 'A waterfall of emojis rains down like a digital curtain.',
    cost: 0,
    emoji: '🟩',
  },
  {
    id: 'clear',
    name: 'Clear Sky',
    description: 'Disable orbiting emojis for a minimalist focus on the lettuce.',
    cost: 0,
    emoji: '🌫️',
  },
  {
    id: 'bubble',
    name: 'Bubble Drift',
    description: 'Effervescent bubbles float in playful arcs around your harvest.',
    cost: 2400,
    emoji: '🫧',
  },
  {
    id: 'bubble-pop',
    name: 'Popped Bubble',
    description: 'Shimmering bursts ripple outward as bubbles pop in sequence.',
    cost: 3600,
    emoji: '💥',
  },
  {
    id: 'wave',
    name: 'The Force',
    description: 'Emojis glide along an invisible current that sways like telekinesis.',
    cost: 5200,
    emoji: '🌊',
  },
  {
    id: 'lake',
    name: 'Lake Drift',
    description: 'Emojis dive to the waterline and bob together like floating keepsakes.',
    cost: 6400,
    emoji: '💧',
  },
  {
    id: 'echo',
    name: 'Echo Pulse',
    description: 'Layered rings reverberate, echoing each upgrade you unlock.',
    cost: 7200,
    emoji: '📡',
  },
  {
    id: 'confetti',
    name: 'Confetti Fall',
    description: 'Festive emoji confetti showers the garden celebration.',
    cost: 9800,
    emoji: '🎉',
  },
  {
    id: 'laser',
    name: 'Laser Sweep',
    description: 'Sharp beams trace dazzling circles with sci-fi precision.',
    cost: 14500,
    emoji: '🔆',
  },
  {
    id: 'aurora',
    name: 'Aurora Veil',
    description: 'Waves of color ripple like northern lights through the garden.',
    cost: 19800,
    emoji: '🌈',
  },
  {
    id: 'firefly',
    name: 'Firefly Lanterns',
    description: 'Softly glowing fireflies dance in gentle looping patterns.',
    cost: 26800,
    emoji: '🪲',
  },
  {
    id: 'starlight',
    name: 'Starlight Chorus',
    description: 'Constellations sparkle in layered starfields around the lettuce.',
    cost: 35200,
    emoji: '✨',
  },
  {
    id: 'nebula',
    name: 'Nebula Drift',
    description: 'Slow cosmic clouds swirl with interstellar wonder.',
    cost: 48600,
    emoji: '🌌',
  },
  {
    id: 'supernova',
    name: 'Supernova Burst',
    description: 'Brilliant flares surge in dramatic orbits before fading.',
    cost: 76800,
    emoji: '☄️',
  },
];

const defaultOwnedThemes = emojiThemeCatalog.reduce<Record<HomeEmojiTheme, boolean>>((acc, theme) => {
  acc[theme.id] = theme.cost === 0;
  return acc;
}, {} as Record<HomeEmojiTheme, boolean>);

const isHomeEmojiTheme = (value: string): value is HomeEmojiTheme =>
  emojiThemeCatalog.some((theme) => theme.id === value);

export type OrbitingEmoji = {
  id: string;
  emoji: string;
};

const createPlacementId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_TEXT_COLOR = '#14532d';
const DEFAULT_TEXT_STYLE: TextStyleId = 'sprout';

const isTextStyleId = (value: unknown): value is TextStyleId =>
  value === 'sprout' ||
  value === 'bloom' ||
  value === 'canopy' ||
  value === 'whisper' ||
  value === 'serif' ||
  value === 'rounded' ||
  value === 'script' ||
  value === 'mono';

const normalizePlacement = (entry: unknown): Placement | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const baseId = typeof record.id === 'string' ? record.id : createPlacementId('placement');
  const x = typeof record.x === 'number' ? record.x : 0;
  const y = typeof record.y === 'number' ? record.y : 0;
  const scale = typeof record.scale === 'number' ? record.scale : 1;
  const rotation = typeof record.rotation === 'number' ? record.rotation : 0;
  const kind = record.kind;

  if (kind === 'photo' && typeof record.imageUri === 'string') {
    return {
      id: baseId,
      kind: 'photo',
      imageUri: record.imageUri,
      x,
      y,
      scale,
      rotation,
    };
  }

  if (kind === 'text' && typeof record.text === 'string') {
    const color = typeof record.color === 'string' ? record.color : DEFAULT_TEXT_COLOR;
    const style = isTextStyleId(record.style) ? record.style : DEFAULT_TEXT_STYLE;
    return {
      id: baseId,
      kind: 'text',
      text: record.text,
      color,
      style,
      x,
      y,
      scale,
      rotation,
    };
  }

  const emojiId = typeof record.emojiId === 'string' ? record.emojiId : null;

  if (!emojiId) {
    return null;
  }

  return {
    id: baseId,
    kind: 'emoji',
    emojiId,
    x,
    y,
    scale,
    rotation,
  };
};

type StoredGameState = {
  harvest: number;
  lifetimeHarvest: number;
  purchasedUpgrades: Record<string, number>;
  emojiInventory: Record<string, boolean>;
  placements: Placement[];
  orbitingUpgradeEmojis: OrbitingEmoji[];
  customEmojiCatalog?: Record<string, EmojiDefinition>;
  hasPremiumUpgrade?: boolean;
  premiumAccentColor?: string;
  customClickEmoji?: string;
  ownedThemes?: Record<HomeEmojiTheme, boolean>;
  temperatureUnit?: 'celsius' | 'fahrenheit';
  bedsideWidgetsEnabled?: boolean;
  hasManuallySetTemperatureUnit?: boolean;
  rssFeeds?: RSSFeed[];
  widgetPromenade?: WidgetPromenadeEntry[];
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [harvest, setHarvest] = useState(0);
  const [lifetimeHarvest, setLifetimeHarvest] = useState(0);
  const [profileLifetimeTotal, setProfileLifetimeTotal] = useState(0);
  const [tapValue, setTapValue] = useState(1);
  const [autoPerSecond, setAutoPerSecond] = useState(0);
  const [purchasedUpgrades, setPurchasedUpgrades] = useState<Record<string, number>>({});
  const [orbitingUpgradeEmojis, setOrbitingUpgradeEmojis] = useState<OrbitingEmoji[]>([]);
  const [emojiInventory, setEmojiInventory] = useState<Record<string, boolean>>({});
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profilePhotoWidgetEnabled, setProfilePhotoWidgetEnabled] = useState(false);
  const [homeEmojiTheme, setHomeEmojiThemeState] = useState<HomeEmojiTheme>('circle');
  const [ownedThemes, setOwnedThemes] = useState<Record<HomeEmojiTheme, boolean>>(() => ({
    ...defaultOwnedThemes,
  }));
  const [resumeNotice, setResumeNotice] = useState<PassiveResumeNotice | null>(null);
  const [customEmojiCatalog, setCustomEmojiCatalog] = useState<Record<string, EmojiDefinition>>({});
  const [hasPremiumUpgrade, setHasPremiumUpgrade] = useState(false);
  const [premiumAccentColor, setPremiumAccentColorState] = useState('#1f6f4a');
  const [customClickEmoji, setCustomClickEmojiState] = useState('🥬');
  const [gardenBackgroundColor, setGardenBackgroundColorState] = useState('#f2f9f2');
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [bedsideWidgetsEnabled, setBedsideWidgetsEnabled] = useState(true);
  const [weatherData, setWeatherData] = useState<{ temperature: number; condition: string; emoji: string; location: string } | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(0);
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [hasManuallySetTemperatureUnit, setHasManuallySetTemperatureUnit] = useState(false);
  const [rssFeeds, setRssFeeds] = useState<RSSFeed[]>([]);
  const [rssItems, setRssItems] = useState<RSSFeedItem[]>([]);
  const [rssError, setRssError] = useState<string | null>(null);
  const [rssLastUpdated, setRssLastUpdated] = useState(0);
  const [widgetPromenade, setWidgetPromenade] = useState<WidgetPromenadeEntry[]>([]);
  const initialisedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundInfoRef = useRef<
    | {
        timestamp: number;
        harvest: number;
        lifetimeHarvest: number;
        profileLifetimeTotal: number;
        autoPerSecond: number;
      }
    | null
  >(null);
  const harvestRef = useRef(harvest);
  const lifetimeHarvestRef = useRef(lifetimeHarvest);
  const profileLifetimeTotalRef = useRef(profileLifetimeTotal);
  const tapValueRef = useRef(tapValue);
  const autoPerSecondRef = useRef(autoPerSecond);
  const VARIATION_SELECTOR_REGEX = /[\uFE0E\uFE0F]/g;

  useEffect(() => {
    setOwnedThemes((prev) => {
      let updated: Record<HomeEmojiTheme, boolean> | null = null;

      emojiThemeCatalog.forEach((theme) => {
        if (theme.cost === 0 && !prev[theme.id]) {
          if (!updated) {
            updated = { ...prev };
          }
          updated[theme.id] = true;
        }
      });

      return updated ?? prev;
    });
  }, []);

  const stripVariationSelectors = useCallback(
    (value: string) => value.replace(VARIATION_SELECTOR_REGEX, ''),
    []
  );

  const computeCustomEmojiCost = useCallback((emojiValue: string) => {
    const codePoints = Array.from(emojiValue).map((char) => char.codePointAt(0) ?? 0);

    if (codePoints.length === 0) {
      return computeBellCurveCost(0.5);
    }

    const hash = codePoints.reduce((accumulator, point) => (accumulator * 257 + point) % 1_000_003, 0);
    const normalized = hash / 1_000_003;
    return computeBellCurveCost(normalized);
  }, []);

  const pickCustomCategory = useCallback((emojiValue: string): EmojiCategory => {
    const categories: EmojiCategory[] = ['plants', 'scenery', 'creatures', 'features', 'accents'];
    const codePoints = Array.from(emojiValue).map((char) => char.codePointAt(0) ?? 0);

    if (codePoints.length === 0) {
      return 'accents';
    }

    const total = codePoints.reduce((sum, point) => sum + point, 0);
    return categories[total % categories.length];
  }, []);

  const registerCustomEmoji = useCallback(
    (
      emoji: string,
      options?: { name?: string; costOverride?: number; imageUrl?: string; tags?: string[] }
    ): EmojiDefinition | null => {
      const trimmed = emoji.trim();

      if (trimmed.length === 0) {
        return null;
      }

      const normalized = stripVariationSelectors(trimmed);

      if (normalized.length === 0) {
        return null;
      }

      const idFragment = Array.from(normalized)
        .map((char) => {
          const codePoint = char.codePointAt(0);
          return codePoint ? codePoint.toString(16) : null;
        })
        .filter((value): value is string => Boolean(value))
        .join('-');

      // For Emoji Kitchen blends, we might have a very long ID or complex sequence.
      // If we have an imageUrl, we should trust it's a valid custom emoji even if the ID generation is tricky.
      // However, we still need a unique ID.
      if (!idFragment && !options?.imageUrl) {
        return null;
      }

      const customId = `custom-${idFragment || Date.now().toString()}`;

      if (customEmojiCatalog[customId]) {
        const existing = customEmojiCatalog[customId];
        // If we have new options (like imageUrl) that are missing from the existing definition, update it.
        if (options?.imageUrl && !existing.imageUrl) {
          const updated = {
            ...existing,
            imageUrl: options.imageUrl,
            name: options.name || existing.name,
            cost: options.costOverride ?? existing.cost,
          };
          
          setCustomEmojiCatalog((prev) => ({
            ...prev,
            [customId]: updated,
          }));
          
          return updated;
        }
        return existing;
      }

      // We need to return the definition immediately for the caller to use it.
      // Since setCustomEmojiCatalog is async/batched, we can't rely on reading it back from state immediately.
      // We'll construct the definition, schedule the update, and return the definition directly.

      const metaName = options?.name
        ? options.name
        : (emojiNameMap && (emojiNameMap[normalized] || emojiNameMap[trimmed])) || null;
      
      const titleCase = (value: string) =>
        value
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

      const nextDefinition: EmojiDefinition = {
        id: customId,
        emoji: trimmed,
        name: metaName ? titleCase(metaName as string) : `Garden Emoji ${trimmed}`,
        cost: options?.costOverride ?? computeCustomEmojiCost(normalized),
        category: pickCustomCategory(normalized),
        tags: [
          ...(metaName ? (metaName as string).split(/\s+/).map((s) => s.toLowerCase()) : []),
          trimmed.toLowerCase(),
          normalized.toLowerCase(),
          ...(metaName ? [] : ['custom emoji']),
          ...(options?.tags ?? []),
        ],
        popularity: 1000 + Object.keys(customEmojiCatalog).length,
        imageUrl: options?.imageUrl,
      };

      setCustomEmojiCatalog((prev) => {
        if (prev[customId]) {
          return prev;
        }
        return { ...prev, [customId]: nextDefinition };
      });

      return nextDefinition;
    },
    [
      computeCustomEmojiCost,
      customEmojiCatalog,
      pickCustomCategory,
      stripVariationSelectors,
    ]
  );

  const combinedEmojiCatalog = useMemo(
    () => [...gardenEmojiCatalog, ...Object.values(customEmojiCatalog)],
    [customEmojiCatalog]
  );

  const findEmojiDefinition = useCallback(
    (emojiId: string) => combinedEmojiCatalog.find((item) => item.id === emojiId) ?? null,
    [combinedEmojiCatalog]
  );

  useEffect(() => {
    if (autoPerSecond <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setHarvest((prev) => prev + autoPerSecond);
      setLifetimeHarvest((prev) => prev + autoPerSecond);
      setProfileLifetimeTotal((prev) => prev + autoPerSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [autoPerSecond]);

  useEffect(() => {
    harvestRef.current = harvest;
  }, [harvest]);

  useEffect(() => {
    lifetimeHarvestRef.current = lifetimeHarvest;
  }, [lifetimeHarvest]);

  useEffect(() => {
    profileLifetimeTotalRef.current = profileLifetimeTotal;
  }, [profileLifetimeTotal]);

  useEffect(() => {
    autoPerSecondRef.current = autoPerSecond;
  }, [autoPerSecond]);

  useEffect(() => {
    const nextTapValue = Math.max(autoPerSecond, 1);
    setTapValue(nextTapValue);
  }, [autoPerSecond]);

  useEffect(() => {
    tapValueRef.current = tapValue;
  }, [tapValue]);

  useEffect(() => {
    const backgroundStates: AppStateStatus[] = ['inactive', 'background'];

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (!initialisedRef.current) {
        return;
      }

      const movingToBackground = previousState === 'active' && backgroundStates.includes(nextAppState);
      const movingToForeground = backgroundStates.includes(previousState) && nextAppState === 'active';

      if (movingToBackground) {
        backgroundInfoRef.current = {
          timestamp: Date.now(),
          harvest: harvestRef.current,
          lifetimeHarvest: lifetimeHarvestRef.current,
          profileLifetimeTotal: profileLifetimeTotalRef.current,
          autoPerSecond: autoPerSecondRef.current,
        };

        AsyncStorage.setItem(LAST_EXIT_STORAGE_KEY, Date.now().toString()).catch(() => {
          // persistence best effort only
        });
        return;
      }

      if (movingToForeground) {
        AsyncStorage.removeItem(LAST_EXIT_STORAGE_KEY).catch(() => {
          // persistence best effort only
        });

        const info = backgroundInfoRef.current;
        backgroundInfoRef.current = null;

        if (!info) {
          return;
        }

        const elapsedSeconds = Math.max(Math.floor((Date.now() - info.timestamp) / 1000), 0);
        const passiveHarvest = elapsedSeconds * Math.max(info.autoPerSecond, 0);
        const greetings = ['Hi', 'Howdy', "What's Up", 'Hello'] as const;
        const greeting = greetings[Math.floor(Math.random() * greetings.length) % greetings.length];

        const harvestSnapshot = info.harvest + passiveHarvest;
        const lifetimeSnapshot = info.lifetimeHarvest + passiveHarvest;

        if (passiveHarvest > 0) {
          setHarvest((prev) => prev + passiveHarvest);
          setLifetimeHarvest((prev) => prev + passiveHarvest);
          setProfileLifetimeTotal((prev) => prev + passiveHarvest);
        }

        setResumeNotice({
          type: 'background',
          passiveHarvest,
          greeting,
          timestamp: Date.now(),
          harvestSnapshot,
          lifetimeHarvestSnapshot: lifetimeSnapshot,
          autoPerSecondSnapshot: info.autoPerSecond,
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const spendHarvest = useCallback(
    (amount: number) => {
      if (amount <= 0) {
        return true;
      }

      if (harvest < amount) {
        return false;
      }

      setHarvest((prev) => prev - amount);
      return true;
    },
    [harvest]
  );

  const addHarvest = useCallback(() => {
    const manualGain = Math.max(tapValueRef.current, 1);
    setHarvest((prev) => prev + manualGain);
    setLifetimeHarvest((prev) => prev + manualGain);
    setProfileLifetimeTotal((prev) => prev + manualGain);
  }, []);

  const addHarvestAmount = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      const normalized = Math.floor(amount);
      setHarvest((prev) => prev + normalized);
      setLifetimeHarvest((prev) => prev + normalized);
      setProfileLifetimeTotal((prev) => prev + normalized);
    },
    []
  );

  const spendHarvestAmount = useCallback((amount: number) => spendHarvest(amount), [spendHarvest]);

  const purchasePremiumUpgrade = useCallback(() => {
    setHasPremiumUpgrade(true);
  }, []);

  const setPremiumAccentColor = useCallback((color: string) => {
    if (!color || typeof color !== 'string') {
      return;
    }
    setPremiumAccentColorState(color);
  }, []);

  const setCustomClickEmoji = useCallback((emoji: string) => {
    if (!emoji || typeof emoji !== 'string') {
      setCustomClickEmojiState('🥬');
      return;
    }

    const trimmed = emoji.trim();
    if (trimmed.length === 0) {
      setCustomClickEmojiState('🥬');
      return;
    }

    const [first] = Array.from(trimmed);
    setCustomClickEmojiState(first);
  }, []);

  const setHomeEmojiTheme = useCallback(
    (theme: HomeEmojiTheme) => {
      if (!ownedThemes[theme]) {
        return;
      }

      setHomeEmojiThemeState(theme);
    },
    [ownedThemes]
  );

  const purchaseEmojiTheme = useCallback(
    (themeId: HomeEmojiTheme) => {
      const theme = emojiThemeCatalog.find((item) => item.id === themeId);

      if (!theme) {
        return false;
      }

      if (ownedThemes[themeId]) {
        setHomeEmojiThemeState(themeId);
        return true;
      }

      if (theme.cost > 0 && !spendHarvest(theme.cost)) {
        return false;
      }

      setOwnedThemes((prev) => ({
        ...prev,
        [themeId]: true,
      }));
      setHomeEmojiThemeState(themeId);
      return true;
    },
    [ownedThemes, spendHarvest]
  );

  const purchaseUpgrade = (upgradeId: string) => {
    const upgrade = upgradeCatalog.find((item) => item.id === upgradeId);

    if (!upgrade) {
      return false;
    }

    if (!spendHarvest(upgrade.cost)) {
      return false;
    }

    setPurchasedUpgrades((prev) => ({
      ...prev,
      [upgradeId]: (prev[upgradeId] ?? 0) + 1,
    }));

    setAutoPerSecond((prev) => prev + upgrade.increment);
    setOrbitingUpgradeEmojis((prev) => {
      const entry: OrbitingEmoji = {
        id: `${upgrade.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        emoji: upgrade.emoji,
      };
      const next = [...prev, entry];
      if (next.length > 100) {
        return next.slice(next.length - 100);
      }
      return next;
    });

    return true;
  };

  const purchaseEmoji = useCallback(
    (emojiId: string, definition?: EmojiDefinition) => {
      const emoji = definition || findEmojiDefinition(emojiId);

      if (!emoji) {
        return false;
      }

      if (emojiInventory[emojiId]) {
        return true;
      }

      if (!spendHarvest(emoji.cost)) {
        return false;
      }

      setEmojiInventory((prev) => ({
        ...prev,
        [emojiId]: true,
      }));

      return true;
    },
    [emojiInventory, findEmojiDefinition, spendHarvest]
  );

  const grantEmojiUnlock = useCallback((emojiId: string) => {
    let unlocked = false;
    setEmojiInventory((prev) => {
      if (prev[emojiId]) {
        unlocked = false;
        return prev;
      }

      unlocked = true;
      return {
        ...prev,
        [emojiId]: true,
      };
    });

    return unlocked;
  }, []);

  const placeEmoji = useCallback(
    (emojiId: string, position: { x: number; y: number }) => {
      if (!emojiInventory[emojiId]) {
        return false;
      }

      setPlacements((prev) => [
        ...prev,
        {
          id: createPlacementId(emojiId),
          kind: 'emoji',
          emojiId,
          x: position.x,
          y: position.y,
          scale: 1,
          rotation: 0,
        },
      ]);

      return true;
    },
    [emojiInventory]
  );

  const addPhotoPlacement = (imageUri: string, position: { x: number; y: number }) => {
    if (!imageUri) {
      return false;
    }

    setPlacements((prev) => [
      ...prev,
      {
        id: createPlacementId('photo'),
        kind: 'photo',
        imageUri,
        x: position.x,
        y: position.y,
        scale: 1,
        rotation: 0,
      },
    ]);

    return true;
  };

  const addTextPlacement = (
    text: string,
    position: { x: number; y: number },
    color = DEFAULT_TEXT_COLOR,
    style: TextStyleId = DEFAULT_TEXT_STYLE,
    scale = 1
  ) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

    const appliedColor = color && color.trim().length > 0 ? color : DEFAULT_TEXT_COLOR;
    const appliedStyle = isTextStyleId(style) ? style : DEFAULT_TEXT_STYLE;

    const sanitizedScale =
      typeof scale === 'number' && Number.isFinite(scale)
        ? Math.min(Math.max(scale, 0.5), 3)
        : 1;

    setPlacements((prev) => [
      ...prev,
      {
        id: createPlacementId('text'),
        kind: 'text',
        text: trimmed,
        color: appliedColor,
        style: appliedStyle,
        x: position.x,
        y: position.y,
        scale: sanitizedScale,
        rotation: 0,
      },
    ]);

    return true;
  };

  const updatePlacement = (placementId: string, updates: Partial<Placement>) => {
    setPlacements((prev) =>
      prev.map((placement) =>
        placement.id === placementId
          ? {
              ...placement,
              ...updates,
            } as Placement
          : placement
      )
    );
  };

  const removePlacement = (placementId: string) => {
    setPlacements((prevPlacements) => {
      const target = prevPlacements.find((placement) => placement.id === placementId);

      if (!target) {
        return prevPlacements;
      }

      return prevPlacements.filter((placement) => placement.id !== placementId);
    });
  };

  const clearGarden = useCallback(() => {
    setPlacements([]);
  }, []);

  const resetGame = useCallback(async () => {
    // Reset all in-memory state to defaults
    setHarvest(0);
    setLifetimeHarvest(0);
    setProfileLifetimeTotal(0);
    setPurchasedUpgrades({});
    setOrbitingUpgradeEmojis([]);
    setEmojiInventory({});
    setPlacements([]);
    setProfileName('');
    setProfileUsername('');
    setProfileImageUri(null);
    setProfilePhotoWidgetEnabled(false);
    setHomeEmojiThemeState('circle');
    setOwnedThemes({ ...defaultOwnedThemes });
    setResumeNotice(null);
    setCustomEmojiCatalog({});
    setHasPremiumUpgrade(false);
    setPremiumAccentColorState('#1f6f4a');
    setCustomClickEmojiState('🥬');
    setGardenBackgroundColorState('#f2f9f2');
    setIsExpandedView(false);
    setBedsideWidgetsEnabled(true);
    setWeatherData(null);
    setWeatherError(null);
    setWeatherLastUpdated(0);
    setTemperatureUnit('celsius');
    setHasManuallySetTemperatureUnit(false);
    setRssFeeds([]);
    setRssItems([]);
    setRssError(null);
    setRssLastUpdated(0);
    setWidgetPromenade([]);

    // Clear persisted storage
    try {
      await AsyncStorage.multiRemove([PROFILE_STORAGE_KEY, THEME_STORAGE_KEY, GAME_STORAGE_KEY, LAST_EXIT_STORAGE_KEY]);
    } catch (error) {
      // ignore persistence errors
      console.warn('Failed to clear storage during reset', error);
    }
  }, [
    setProfileName,
    setProfileUsername,
    setProfileImageUri,
    setProfilePhotoWidgetEnabled,
  ]);

  const addWidgetPromenadePhoto = useCallback(
    (uri: string): WidgetPromenadeEntry | null => {
      const trimmed = uri.trim();

      if (trimmed.length === 0) {
        return null;
      }

      const entry: WidgetPromenadeEntry = {
        id: `promenade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uri: trimmed,
        savedAt: Date.now(),
      };

      setWidgetPromenade((prev) => [entry, ...prev.filter((item) => item.uri !== trimmed)]);
      return entry;
    },
    []
  );

  const removeWidgetPromenadePhoto = useCallback((entryId: string) => {
    setWidgetPromenade((prev) => prev.filter((item) => item.id !== entryId));
  }, []);

  useEffect(() => {
    if (ownedThemes[homeEmojiTheme]) {
      return;
    }

    const fallback = emojiThemeCatalog.find((theme) => ownedThemes[theme.id]);
    if (fallback) {
      setHomeEmojiThemeState(fallback.id);
    } else {
      setHomeEmojiThemeState('circle');
    }
  }, [homeEmojiTheme, ownedThemes]);

  const value = useMemo<GameContextValue>(() => ({
    harvest,
    lifetimeHarvest,
    formatLifetimeHarvest: (value: number = lifetimeHarvest) => {
      if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(1)}B`;
      } else if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toFixed(0);
    },
    profileLifetimeTotal,
    tapValue,
    autoPerSecond,
    upgrades: upgradeCatalog,
    purchasedUpgrades,
    orbitingUpgradeEmojis,
    emojiCatalog: combinedEmojiCatalog,
    emojiInventory,
    placements,
    profileName,
    profileUsername,
    profileImageUri,
    profilePhotoWidgetEnabled,
    homeEmojiTheme,
    emojiThemes: emojiThemeCatalog,
    ownedThemes,
    resumeNotice,
    hasPremiumUpgrade,
  resetGame,
    premiumAccentColor,
    customClickEmoji,
    gardenBackgroundColor,
    isExpandedView,
    bedsideWidgetsEnabled,
    weatherData,
    weatherError,
    weatherLastUpdated,
    temperatureUnit,
    hasManuallySetTemperatureUnit,
    rssFeeds,
    rssItems,
    rssError,
    rssLastUpdated,
    widgetPromenade,
    registerCustomEmoji,
    setProfileLifetimeTotal,
    addHarvest,
    addHarvestAmount,
    spendHarvestAmount,
    purchaseUpgrade,
    purchaseEmojiTheme,
    purchaseEmoji,
    grantEmojiUnlock,
    placeEmoji,
    addPhotoPlacement,
    addTextPlacement,
    updatePlacement,
    removePlacement,
    clearGarden,
    setProfileName,
    setProfileUsername,
    setProfileImageUri,
    setProfilePhotoWidgetEnabled,
    setHomeEmojiTheme,
    purchasePremiumUpgrade,
    setPremiumAccentColor,
    setCustomClickEmoji,
    setGardenBackgroundColor: setGardenBackgroundColorState,
    setIsExpandedView,
    setBedsideWidgetsEnabled,
    clearResumeNotice: () => setResumeNotice(null),
    updateWeatherData: async () => {
      setWeatherError(null);
      try {
        const result = await weatherService.getCurrentWeather(true);
        if ('message' in result) {
          setWeatherError(result.message);
          setWeatherData(null);
        } else {
          setWeatherData(result);
          setWeatherError(null);
          setWeatherLastUpdated(Date.now());
        }
      } catch (error) {
        console.error('Weather update error:', error);
        setWeatherError('Weather service unavailable');
        setWeatherData(null);
      }
    },
    clearWeatherData: () => {
      setWeatherData(null);
      setWeatherError(null);
      setWeatherLastUpdated(0);
      weatherService.clearCache();
    },
    setTemperatureUnit,
    setHasManuallySetTemperatureUnit,
    updateRSSFeeds: async () => {
      try {
        setRssError(null);
        const items = await rssService.fetchMultipleFeeds(rssFeeds);
        setRssItems(items);
        setRssLastUpdated(Date.now());
        // Only log occasionally or when there are significant changes
        if (items.length > 0 && items.length % 20 === 0) {
          console.log('✅ GameContext RSS update:', items.length, 'items loaded');
        }
      } catch (error) {
        console.warn('RSS update error:', error);
        setRssError('RSS service unavailable');
        setRssItems([]);
      }
    },
    clearRSSData: () => {
      setRssItems([]);
      setRssError(null);
      setRssLastUpdated(0);
      rssService.clearAllCache();
    },
    toggleRSSFeed: (feedId: string, enabled: boolean) => {
      setRssFeeds(prevFeeds => 
        prevFeeds.map(feed => 
          feed.id === feedId ? { ...feed, enabled } : feed
        )
      );
    },
    addCustomRSSFeed: (feedData: Omit<RSSFeed, 'id'>) => {
      const newFeed: RSSFeed = {
        ...feedData,
        id: `custom-${Date.now()}`,
      };
      setRssFeeds(prevFeeds => [...prevFeeds, newFeed]);
    },
    removeRSSFeed: (feedId: string) => {
      setRssFeeds(prevFeeds => prevFeeds.filter(feed => feed.id !== feedId));
      rssService.clearFeedCache(feedId);
    },
    addWidgetPromenadePhoto,
    removeWidgetPromenadePhoto,
  }), [
    harvest,
    lifetimeHarvest,
    profileLifetimeTotal,
    tapValue,
    autoPerSecond,
    purchasedUpgrades,
    orbitingUpgradeEmojis,
    emojiInventory,
    placements,
    profileName,
    profileUsername,
    profileImageUri,
    profilePhotoWidgetEnabled,
    homeEmojiTheme,
    ownedThemes,
    resumeNotice,
    hasPremiumUpgrade,
    premiumAccentColor,
    customClickEmoji,
    gardenBackgroundColor,
    isExpandedView,
    bedsideWidgetsEnabled,
    weatherData,
    weatherError,
    weatherLastUpdated,
    temperatureUnit,
    combinedEmojiCatalog,
    registerCustomEmoji,
    addHarvest,
    addHarvestAmount,
    spendHarvestAmount,
    purchaseUpgrade,
    purchaseEmojiTheme,
    purchaseEmoji,
    grantEmojiUnlock,
    placeEmoji,
    addPhotoPlacement,
    addTextPlacement,
    updatePlacement,
    removePlacement,
    clearGarden,
    setProfileName,
    setProfileUsername,
    setProfileImageUri,
    setHomeEmojiTheme,
    purchasePremiumUpgrade,
    setPremiumAccentColor,
    setCustomClickEmoji,
    rssFeeds,
    rssItems,
    rssError,
    rssLastUpdated,
    widgetPromenade,
    addWidgetPromenadePhoto,
    removeWidgetPromenadePhoto,
  ]);

  useEffect(() => {
    if (initialisedRef.current) {
      return;
    }

    AsyncStorage.multiGet([PROFILE_STORAGE_KEY, THEME_STORAGE_KEY, GAME_STORAGE_KEY, LAST_EXIT_STORAGE_KEY])
      .then(([profileEntry, themeEntry, gameEntry, exitEntry]) => {
        if (profileEntry[1]) {
          try {
            const parsed = JSON.parse(profileEntry[1]) as {
              name?: string;
              username?: string;
              imageUri?: string | null;
              lifetimeTotal?: number;
              backgroundColor?: string;
              photoWidgetEnabled?: boolean;
            };
            setProfileName(parsed.name ?? '');
            setProfileUsername(parsed.username ?? '');
            setProfileImageUri(parsed.imageUri ?? null);
            setProfileLifetimeTotal(parsed.lifetimeTotal ?? 0);
            if (typeof parsed.backgroundColor === 'string' && parsed.backgroundColor.trim().length > 0) {
              setGardenBackgroundColorState(parsed.backgroundColor);
            }
            if (typeof parsed.photoWidgetEnabled === 'boolean') {
              setProfilePhotoWidgetEnabled(parsed.photoWidgetEnabled);
            }
          } catch (error) {
            // ignore malformed stored data
          }
        }

        if (themeEntry[1] && isHomeEmojiTheme(themeEntry[1])) {
          setHomeEmojiThemeState(themeEntry[1]);
        }

        let loadedLifetimeHarvest: number | undefined;
        let loadedHarvest: number | undefined;
        let loadedAutoPerSecond = 0;
        const shouldResetSession = Boolean(exitEntry[1]);

        if (gameEntry[1]) {
          try {
            const parsed = JSON.parse(gameEntry[1]) as Partial<StoredGameState>;
            if (typeof parsed.lifetimeHarvest === 'number' && Number.isFinite(parsed.lifetimeHarvest)) {
              setLifetimeHarvest(parsed.lifetimeHarvest);
              loadedLifetimeHarvest = parsed.lifetimeHarvest;
            }
            if (!shouldResetSession && typeof parsed.harvest === 'number' && Number.isFinite(parsed.harvest)) {
              setHarvest(parsed.harvest);
              loadedHarvest = parsed.harvest;
            } else if (shouldResetSession) {
              setHarvest(0);
            }
            if (parsed.purchasedUpgrades && typeof parsed.purchasedUpgrades === 'object' && !shouldResetSession) {
              setPurchasedUpgrades(parsed.purchasedUpgrades);
              const computedAuto = Object.entries(parsed.purchasedUpgrades).reduce((total, [upgradeId, count]) => {
                const upgrade = upgradeCatalog.find((item) => item.id === upgradeId);
                if (!upgrade || typeof count !== 'number') {
                  return total;
                }
                return total + upgrade.increment * count;
              }, 0);
              setAutoPerSecond(computedAuto);
              loadedAutoPerSecond = computedAuto;
            } else if (shouldResetSession) {
              setPurchasedUpgrades({});
              setAutoPerSecond(0);
              loadedAutoPerSecond = 0;
            }
            if (!shouldResetSession && parsed.emojiInventory && typeof parsed.emojiInventory === 'object') {
              setEmojiInventory(() => {
                const normalized: Record<string, boolean> = {};
                Object.entries(parsed.emojiInventory as Record<string, unknown>).forEach(([key, value]) => {
                  if (typeof value === 'boolean') {
                    normalized[key] = value;
                  } else if (typeof value === 'number') {
                    normalized[key] = value > 0;
                  }
                });
                return normalized;
              });
            } else if (shouldResetSession) {
              setEmojiInventory({});
            }
            if (!shouldResetSession && parsed.ownedThemes && typeof parsed.ownedThemes === 'object') {
              setOwnedThemes(() => {
                const merged = { ...defaultOwnedThemes };
                Object.entries(parsed.ownedThemes!).forEach(([key, value]) => {
                  if (typeof value === 'boolean' && typeof key === 'string' && isHomeEmojiTheme(key)) {
                    const themeKey = key as HomeEmojiTheme;
                    merged[themeKey] = merged[themeKey] || value;
                  }
                });
                return merged;
              });
            } else if (shouldResetSession) {
              setOwnedThemes({ ...defaultOwnedThemes });
            }
            if (!shouldResetSession && Array.isArray(parsed.placements)) {
              setPlacements(
                parsed.placements
                  .map((entry) => normalizePlacement(entry))
                  .filter((placement): placement is Placement => Boolean(placement))
              );
            } else if (shouldResetSession) {
              setPlacements([]);
            }
            if (!shouldResetSession && Array.isArray(parsed.orbitingUpgradeEmojis)) {
              setOrbitingUpgradeEmojis(parsed.orbitingUpgradeEmojis);
            } else if (shouldResetSession) {
              setOrbitingUpgradeEmojis([]);
            }
            if (!shouldResetSession && parsed.customEmojiCatalog && typeof parsed.customEmojiCatalog === 'object') {
              setCustomEmojiCatalog(parsed.customEmojiCatalog);
            } else if (shouldResetSession) {
              setCustomEmojiCatalog({});
            }
            if (typeof parsed.hasPremiumUpgrade === 'boolean') {
              setHasPremiumUpgrade(parsed.hasPremiumUpgrade);
              if (parsed.hasPremiumUpgrade) {
                // Debug: premium status restored from storage, useful for troubleshooting tests
                console.log('💠 Restored premium:', parsed.hasPremiumUpgrade);
              }
            }
            if (typeof parsed.premiumAccentColor === 'string') {
              setPremiumAccentColorState(parsed.premiumAccentColor);
            }
            if (typeof parsed.customClickEmoji === 'string') {
              const trimmed = parsed.customClickEmoji.trim();
              setCustomClickEmojiState(trimmed.length > 0 ? Array.from(trimmed)[0] : '🥬');
            }
            if (typeof parsed.temperatureUnit === 'string' && (parsed.temperatureUnit === 'celsius' || parsed.temperatureUnit === 'fahrenheit')) {
              setTemperatureUnit(parsed.temperatureUnit);
            }
            if (typeof parsed.bedsideWidgetsEnabled === 'boolean') {
              setBedsideWidgetsEnabled(parsed.bedsideWidgetsEnabled);
            }
            if (typeof parsed.hasManuallySetTemperatureUnit === 'boolean') {
              setHasManuallySetTemperatureUnit(parsed.hasManuallySetTemperatureUnit);
            }
            if (Array.isArray(parsed.rssFeeds)) {
              // Check if stored feeds are the old format (without items)
              const hasOldFormat = parsed.rssFeeds.some((f: any) => !f.items || f.items.length === 0);

              if (hasOldFormat) {
                // Use new DEFAULT_RSS_FEEDS with curated content
                console.log('🔄 Migrating from old RSS format to new instant feeds');
                setRssFeeds([]);
              } else {
                // Removed logic for merging RSS feeds as it is no longer relevant
                // const mergedFeeds = DEFAULT_RSS_FEEDS.map(defaultFeed => {
                //   const storedFeed = parsed.rssFeeds?.find((f: any) => f.id === defaultFeed.id);
                //   return {
                //     ...defaultFeed,
                //     enabled: storedFeed?.enabled !== undefined ? storedFeed.enabled : defaultFeed.enabled
                //   };
                // });
                setRssFeeds(parsed.rssFeeds);
              }
            }
            if (Array.isArray(parsed.widgetPromenade)) {
              const normalized = parsed.widgetPromenade
                .filter((entry): entry is WidgetPromenadeEntry => {
                  return (
                    entry &&
                    typeof entry === 'object' &&
                    typeof entry.id === 'string' &&
                    typeof entry.uri === 'string' &&
                    typeof entry.savedAt === 'number'
                  );
                })
                .sort((a, b) => b.savedAt - a.savedAt);
              setWidgetPromenade(normalized);
            } else if (shouldResetSession) {
              setWidgetPromenade([]);
            }
          } catch {
            // ignore malformed stored data
          }
        }

        if (exitEntry[1]) {
          if (shouldResetSession) {
            AsyncStorage.removeItem(LAST_EXIT_STORAGE_KEY).catch(() => {
              // persistence best effort only
            });
          } else {
            setResumeNotice({
              type: 'returning',
              lifetimeHarvest: loadedLifetimeHarvest ?? lifetimeHarvestRef.current,
              timestamp: Date.now(),
              harvestSnapshot: loadedHarvest ?? harvestRef.current,
              lifetimeHarvestSnapshot: loadedLifetimeHarvest ?? lifetimeHarvestRef.current,
              autoPerSecondSnapshot: loadedAutoPerSecond || autoPerSecondRef.current,
            });
            AsyncStorage.removeItem(LAST_EXIT_STORAGE_KEY).catch(() => {
              // persistence best effort only
            });
          }
        }
      })
      .finally(() => {
        initialisedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!initialisedRef.current) {
      return;
    }

    const payload = JSON.stringify({
      name: profileName,
      username: profileUsername,
      imageUri: profileImageUri,
      lifetimeTotal: profileLifetimeTotal,
      backgroundColor: gardenBackgroundColor,
      photoWidgetEnabled: profilePhotoWidgetEnabled,
    });

    AsyncStorage.setItem(PROFILE_STORAGE_KEY, payload).catch(() => {
      // persistence best effort only
    });
  }, [
    gardenBackgroundColor,
    profileImageUri,
    profileLifetimeTotal,
    profileName,
    profilePhotoWidgetEnabled,
    profileUsername,
  ]);

  useEffect(() => {
    if (!initialisedRef.current) {
      return;
    }

    AsyncStorage.setItem(THEME_STORAGE_KEY, homeEmojiTheme).catch(() => {
      // persistence best effort only
    });
  }, [homeEmojiTheme]);

  useEffect(() => {
    if (!initialisedRef.current) {
      return;
    }

    const payload: StoredGameState = {
      harvest,
      lifetimeHarvest,
      purchasedUpgrades,
      emojiInventory,
      placements,
      orbitingUpgradeEmojis,
      customEmojiCatalog,
      hasPremiumUpgrade,
      premiumAccentColor,
      customClickEmoji,
      ownedThemes,
      temperatureUnit,
      bedsideWidgetsEnabled,
      hasManuallySetTemperatureUnit,
      rssFeeds,
      widgetPromenade,
    };

    AsyncStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // persistence best effort only
    });
  }, [
    bedsideWidgetsEnabled,
    customClickEmoji,
    customEmojiCatalog,
    emojiInventory,
    harvest,
    hasPremiumUpgrade,
    hasManuallySetTemperatureUnit,
    lifetimeHarvest,
    orbitingUpgradeEmojis,
    placements,
    premiumAccentColor,
    purchasedUpgrades,
    ownedThemes,
    temperatureUnit,
    rssFeeds,
    rssItems,
    widgetPromenade,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  return context;
};

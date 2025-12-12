import React, { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShopPreviewModal } from './ShopPreviewModal';
import {
  Alert,
  Animated as RNAnimated,
  FlatList,
  LayoutChangeEvent,
  GestureResponderEvent,
  LayoutRectangle,
  ListRenderItem,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  Image,
  View,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computeBellCurveCost, emojiCategoryOrder, formatClickValue, MIN_EMOJI_COST } from '@/constants/emojiCatalog';
import { EmojiDefinition, Placement, TextStyleId, WidgetPromenadeEntry } from '@/context/GameContext';
import { useGame } from '@/context/GameContext';
import { fetchEmojiKitchenMash, formatCustomEmojiName, getRandomCompatibleEmoji } from '@/lib/emojiKitchenService';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Props = {
  harvest: number;
  emojiCatalog: EmojiDefinition[];
  emojiInventory: Record<string, boolean>;
  placements: Placement[];
  purchaseEmoji: (emojiId: string) => boolean;
  placeEmoji: (emojiId: string, position: { x: number; y: number }) => boolean;
  addPhotoPlacement: (uri: string, position: { x: number; y: number }) => boolean;
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
  registerCustomEmoji: (emoji: string) => EmojiDefinition | null;
  addWidgetPromenadePhoto: (uri: string) => WidgetPromenadeEntry | null;
  gardenBackgroundColor: string;
  hasPremiumUpgrade: boolean;
  purchasePremiumUpgrade: () => void;
  setCustomEmojiName: (emojiId: string, newName: string) => void;
  freeBlendsUsed: number;
  incrementFreeBlendsUsed: () => void;
  title?: string;
  onGardenSave?: (uri: string) => void;
};

type StrokePoint = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  color: string;
  size: number;
  points: StrokePoint[];
  modeledPoints?: StrokePoint[];
  style?: StrokeStyleId;
  seed?: number;
};

type StrokeStyleId = 'pencil' | 'pen' | 'marker' | 'chalk';

const VARIATION_SELECTOR_REGEX = /[\uFE0E\uFE0F]/g;
const EMOJI_SEQUENCE_REGEX =
  /\p{Extended_Pictographic}(?:[\uFE0E\uFE0F])?(?:\u200d\p{Extended_Pictographic}(?:[\uFE0E\uFE0F])?)*|[#*0-9](?:\uFE0F)?\u20E3/gu;

const stripVariationSelectors = (value: string) => value.replace(VARIATION_SELECTOR_REGEX, '');

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

const applyAlpha = (color: string, alpha: number) => {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
};

const getBrushPreset = (style?: StrokeStyleId) =>
  BRUSH_STYLE_OPTIONS.find((option) => option.id === style) ?? BRUSH_STYLE_OPTIONS.find((option) => option.id === 'pen')!;

const seededRandom = (seed: number, index: number) => {
  const x = Math.sin(seed * 997 + index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Lightweight stroke modeling inspired by Google's ink-stroke-modeler to keep
// brush styles smooth across platforms without extra native dependencies.
const modelStrokePoints = (points: StrokePoint[], style: StrokeStyleId, seed: number) => {
  if (points.length === 0) {
    return points;
  }

  const preset = getBrushPreset(style);
  const modeled: StrokePoint[] = [];
  let lastPoint = points[0];
  modeled.push(lastPoint);

  for (let index = 1; index < points.length; index += 1) {
    const nextPoint = points[index];
    const dx = nextPoint.x - lastPoint.x;
    const dy = nextPoint.y - lastPoint.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 2));

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const easedT = Math.pow(t, 0.85);
      const baseX = lerp(lastPoint.x, nextPoint.x, easedT);
      const baseY = lerp(lastPoint.y, nextPoint.y, easedT);
      const smoothingFactor = lerp(preset.smoothing, 1, easedT * 0.35);
      const smoothed = {
        x: lerp(lastPoint.x, baseX, smoothingFactor),
        y: lerp(lastPoint.y, baseY, smoothingFactor),
      };
      const jitterAmount = preset.jitter * 1.6;
      const noiseX = (seededRandom(seed, index * 31 + step) - 0.5) * jitterAmount;
      const noiseY = (seededRandom(seed, index * 31 + step + 17) - 0.5) * jitterAmount;

      const modeledPoint = {
        x: smoothed.x + noiseX,
        y: smoothed.y + noiseY,
      };

      modeled.push(modeledPoint);
      lastPoint = modeledPoint;
    }
  }

  return modeled;
};

const formatEmojiDescription = (entry: { tags: string[]; description?: string }) => {
  if (!entry.tags || entry.tags.length === 0) {
    return entry.description || 'A fresh garden accent ready to brighten your park.';
  }

  // Get the displayed tags (first 3) to filter them out of description
  const displayedTags = entry.tags.slice(0, 3).map(tag => tag.toLowerCase());
  
  const readableTags = entry.tags
    .slice(0, 5)
    .filter(tag => {
      // Remove tags that are shown as hashtags (first 3 tags)
      const normalized = tag.toLowerCase().replace(/[-_]/g, ' ');
      return !displayedTags.some(displayedTag => {
        const displayedNormalized = displayedTag.toLowerCase().replace(/[-_]/g, ' ');
        return normalized === displayedNormalized || normalized.includes(displayedNormalized) || displayedNormalized.includes(normalized);
      });
    })
    .map((tag) => tag.replace(/[-_]/g, ' '))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

  if (readableTags.length === 0) {
    return 'A unique decoration for your garden.';
  }

  if (readableTags.length === 1) {
    return `${readableTags[0]} inspiration for your garden layouts.`;
  }

  if (readableTags.length === 2) {
    return `${readableTags[0]} and ${readableTags[1]} vibes for your space.`;
  }

  const last = readableTags[readableTags.length - 1];
  const rest = readableTags.slice(0, -1).join(', ');
  return `${rest}, and ${last} aesthetics.`;
};

const CANVAS_BACKGROUND = '#ffffff';
const ERASER_COLOR = 'eraser';
const DEFAULT_TEXT_COLOR = '#14532d';
const SERIF_FONT_FAMILY = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) ?? 'serif';
const ROUNDED_FONT_FAMILY =
  Platform.select({ ios: 'AvenirNext-DemiBold', android: 'sans-serif-medium', default: 'sans-serif' }) ??
  'sans-serif';
const SCRIPT_FONT_FAMILY =
  Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: 'cursive' }) ?? 'cursive';
const MONO_FONT_FAMILY = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) ?? 'monospace';
const QUICK_DRAW_COLORS = [
  '#1f6f4a',
  '#15803d',
  '#ef4444',
  '#0ea5e9',
  '#ec4899',
  '#f59e0b',
  '#7c3aed',
  '#0f172a',
  '#f97316',
];
const COLOR_WHEEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#0ea5e9',
  '#38bdf8',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f472b6',
  '#94a3b8',
  '#0f172a',
];
const COLOR_WHEEL_DIAMETER = 160;
const COLOR_WHEEL_RADIUS = 64;
const COLOR_WHEEL_SWATCH_SIZE = 34;
const PEN_SIZES = [3, 5, 8, 12];
const BRUSH_STYLE_OPTIONS: { id: StrokeStyleId; label: string; helper: string; icon: string; sizeScale: number; opacity: number; smoothing: number; jitter: number; taper: boolean }[] = [
  {
    id: 'pencil',
    label: 'Pencil',
    helper: 'Sketch with a soft pencil grain.',
    icon: '✏️',
    sizeScale: 0.95,
    opacity: 0.82,
    smoothing: 0.7,
    jitter: 0.28,
    taper: true,
  },
  {
    id: 'pen',
    label: 'Pen',
    helper: 'Precise ink that hugs your path.',
    icon: '🖋️',
    sizeScale: 1,
    opacity: 1,
    smoothing: 0.78,
    jitter: 0.08,
    taper: true,
  },
  {
    id: 'marker',
    label: 'Marker',
    helper: 'Thick strokes with steady flow.',
    icon: '🖍️',
    sizeScale: 1.4,
    opacity: 0.9,
    smoothing: 0.68,
    jitter: 0.05,
    taper: false,
  },
  {
    id: 'chalk',
    label: 'Chalk',
    helper: 'Textured lines with dusty edges.',
    icon: '🧽',
    sizeScale: 1.25,
    opacity: 0.78,
    smoothing: 0.62,
    jitter: 0.38,
    taper: false,
  },
];
const TEXT_SCALE_MIN = 0.7;
const TEXT_SCALE_MAX = 2;
const TEXT_SLIDER_THUMB_SIZE = 24;
const TOTAL_EMOJI_LIBRARY_COUNT = 3953;
const GRID_COLUMN_COUNT = 4;
const GRID_VISIBLE_ROW_COUNT = 3;
const GRID_ROW_HEIGHT = 148;

const TEXT_STYLE_OPTIONS: { id: TextStyleId; label: string; textStyle: TextStyle; preview: string }[] = [
  { id: 'sprout', label: 'Sprout', textStyle: { fontSize: 18, fontWeight: '600' }, preview: 'Hello' },
  {
    id: 'bloom',
    label: 'Bloom',
    textStyle: { fontSize: 22, fontWeight: '700', letterSpacing: 0.4 },
    preview: 'Bloom',
  },
  {
    id: 'canopy',
    label: 'Canopy',
    textStyle: { fontSize: 26, fontWeight: '800', textTransform: 'uppercase' },
    preview: 'Rise',
  },
  {
    id: 'whisper',
    label: 'Whisper',
    textStyle: { fontSize: 20, fontStyle: 'italic', fontWeight: '500' },
    preview: 'Calm',
  },
  {
    id: 'serif',
    label: 'Serif',
    textStyle: { fontSize: 22, fontWeight: '600', fontFamily: SERIF_FONT_FAMILY },
    preview: 'Serif',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    textStyle: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.3,
      fontFamily: ROUNDED_FONT_FAMILY,
    },
    preview: 'Smile',
  },
  {
    id: 'script',
    label: 'Script',
    textStyle: {
      fontSize: 24,
      fontFamily: SCRIPT_FONT_FAMILY,
      fontWeight: Platform.OS === 'ios' ? '400' : '500',
    },
    preview: 'Flow',
  },
  {
    id: 'mono',
    label: 'Mono',
    textStyle: {
      fontSize: 20,
      letterSpacing: 1,
      fontFamily: MONO_FONT_FAMILY,
      fontWeight: '500',
    },
    preview: 'Code',
  },
];

const TEXT_STYLE_MAP = TEXT_STYLE_OPTIONS.reduce<Record<TextStyleId, TextStyle>>((acc, option) => {
  acc[option.id] = option.textStyle;
  return acc;
}, {} as Record<TextStyleId, TextStyle>);

const CATEGORY_LABELS: Record<EmojiDefinition['category'], string> = {
  plants: 'Plants & Foliage',
  scenery: 'Scenery & Sky',
  creatures: 'Garden Creatures',
  features: 'Garden Features',
  accents: 'Atmosphere & Accents',
};

const CATEGORY_ICONS: Record<EmojiDefinition['category'], string> = {
  plants: '🪴',
  scenery: '🌅',
  creatures: '🦋',
  features: '🏡',
  accents: '✨',
};

type CategoryFilter = 'custom' | 'all' | EmojiDefinition['category'];

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'custom', label: 'Custom', icon: '🧪' },
  { id: 'all', label: 'All Items', icon: '🌼' },
  { id: 'plants', label: 'Plants', icon: '🪴' },
  { id: 'scenery', label: 'Scenery', icon: '🌅' },
  { id: 'creatures', label: 'Creatures', icon: '🦋' },
  { id: 'features', label: 'Features', icon: '🏡' },
  { id: 'accents', label: 'Accents', icon: '✨' },
];

const INVENTORY_COLUMNS = 3;
const INVENTORY_COLUMN_GAP = 12;
const INVENTORY_ROW_GAP = 12;
const SHOP_EMOJI_CHOICES = ['🏡', '🚀', '🛍', '📱'] as const;
const INVENTORY_EMOJI_CHOICES = ['🧰', '📦', '💼', '👜'] as const;

// Colors for each inventory slot highlight
const INVENTORY_COLORS = {
  '🧰': { color: '#f59e0b', name: 'gold' },      // Gold/Amber
  '📦': { color: '#a855f7', name: 'purple' },    // Purple
  '💼': { color: '#3b82f6', name: 'blue' },      // Blue
  '👜': { color: '#ec4899', name: 'pink' },      // Pink
} as const;

type InventoryEntry = EmojiDefinition & {
  owned: boolean;
  searchBlob: string;
  normalizedEmoji: string;
};

type EmojiToken = {
  original: string;
  normalized: string;
};

function formatHarvestDisplay(harvest: number): string {
  if (harvest >= 1_000_000) {
    // Show up to 3 significant digits, e.g. 1.23M, 12.3M, 123M
    const millions = harvest / 1_000_000;
    if (millions < 10) {
      return millions.toFixed(2).replace(/\.00$/, '') + 'M';
    } else if (millions < 100) {
      return millions.toFixed(1).replace(/\.0$/, '') + 'M';
    } else {
      return Math.floor(millions).toLocaleString() + 'M';
    }
  }
  return harvest.toLocaleString();
}

export function GardenSection({
  harvest,
  emojiCatalog,
  emojiInventory,
  placements,
  purchaseEmoji,
  placeEmoji,
  addPhotoPlacement,
  addTextPlacement,
  updatePlacement,
  removePlacement,
  clearGarden,
  registerCustomEmoji,
  addWidgetPromenadePhoto,
  gardenBackgroundColor,
  hasPremiumUpgrade,
  purchasePremiumUpgrade,
  setCustomEmojiName,
  freeBlendsUsed,
  incrementFreeBlendsUsed,
  title = 'Lettuce Gardens',
  onGardenSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const gameContext = useGame();
  
  // Orientation detection and responsive layout
  const isLandscape = dimensions.width > dimensions.height;
  const responsiveGridColumns = isLandscape ? 6 : 4;
  const responsiveContentPadding = isLandscape ? 16 : 24;
  const responsiveBannerPadding = isLandscape ? 16 : 20;
  
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<'shop' | 'inventory' | null>(null);
  const [shopFilter, setShopFilter] = useState('');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPalette, setShowPalette] = useState(false);
  const [isFontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [showExtendedPalette, setShowExtendedPalette] = useState(false);
  const [showBrushPalette, setShowBrushPalette] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [penColor, setPenColor] = useState<string>(QUICK_DRAW_COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyleId>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [penHiddenForSave, setPenHiddenForSave] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [inventoryOrder, setInventoryOrder] = useState<string[]>([]);
  const [draggingInventoryId, setDraggingInventoryId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [selectedTextStyle, setSelectedTextStyle] = useState<TextStyleId>('sprout');
  const [textScale] = useState(1); // Fixed at 1.0, users resize by dragging
  const [stencilModeEnabled, setStencilModeEnabled] = useState(false);
  const [stencilOpacity, setStencilOpacity] = useState(0.6);
  const [stencilReferenceUri, setStencilReferenceUri] = useState<string | null>(null);
  const [isPickingStencilReference, setIsPickingStencilReference] = useState(false);
  const stencilTranslationX = useSharedValue(0);
  const stencilTranslationY = useSharedValue(0);
  const stencilScale = useSharedValue(1);
  const stencilPanStartX = useSharedValue(0);
  const stencilPanStartY = useSharedValue(0);
  const stencilScaleStart = useSharedValue(1);
  const [shopEmoji, setShopEmoji] = useState('🏡');
  const [inventoryEmoji, setInventoryEmoji] = useState('🧰');
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<'shop' | 'inventory' | null>(null);
  const [shopPreview, setShopPreview] = useState<InventoryEntry | null>(null);
  const [selectedInventoryEmoji, setSelectedInventoryEmoji] = useState<InventoryEntry | null>(null);
  const [isEditingInventoryName, setIsEditingInventoryName] = useState(false);
  const [editedInventoryName, setEditedInventoryName] = useState('');
  const inventoryFlipAnimation = useRef(new RNAnimated.Value(0)).current;
  
  // Separate wallets for each inventory icon (max 10 per wallet)
  const [inventoryWallets, setInventoryWallets] = useState<Record<string, InventoryEntry[]>>({
    '🧰': [],
    '📦': [],
    '💼': [],
    '👜': [],
  });
  
  // Current active wallet based on selected inventory emoji
  const walletEmojis = inventoryWallets[inventoryEmoji] || [];
  
  const [isDrawingGestureActive, setIsDrawingGestureActive] = useState(false);
  const [customEmojiLeft, setCustomEmojiLeft] = useState('🌸');
  const [customEmojiRight, setCustomEmojiRight] = useState('🌟');
  const [customBlendPreview, setCustomBlendPreview] = useState<string | null>(null);
  const [customBlendDescription, setCustomBlendDescription] = useState('');
  const [customBlendCost, setCustomBlendCost] = useState<number | null>(null);
  const [customBlendError, setCustomBlendError] = useState<string | null>(null);
  const [isLoadingCustomBlend, setIsLoadingCustomBlend] = useState(false);
  const [isEditingBlendName, setIsEditingBlendName] = useState(false);
  const [editedBlendName, setEditedBlendName] = useState('');
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const suppressAutoBlendRef = useRef(false);
  
  const [activeDrag, setActiveDrag] = useState<{ id: string; point: { x: number; y: number } } | null>(null);
  const [penButtonLayout, setPenButtonLayout] = useState<LayoutRectangle | null>(null);
  const canvasRef = useRef<View | null>(null);
  const filteredOwnedInventoryRef = useRef<InventoryEntry[]>([]);
  const draggingInventoryIdRef = useRef<string | null>(null);
  const dragStartIndexRef = useRef(0);
  const dragCurrentIndexRef = useRef(0);
  const skipNextCanvasTapRef = useRef(false);
  const skipTapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const colorWheelPositions = useMemo(
    () =>
      COLOR_WHEEL_COLORS.map((color, index) => {
        const angle = (index / COLOR_WHEEL_COLORS.length) * 2 * Math.PI - Math.PI / 2;
        const center = COLOR_WHEEL_DIAMETER / 2;
        const offset = COLOR_WHEEL_SWATCH_SIZE / 2;
        const left = center + Math.cos(angle) * COLOR_WHEEL_RADIUS - offset;
        const top = center + Math.sin(angle) * COLOR_WHEEL_RADIUS - offset;
        return { color, left, top };
      }),
    []
  );
  const baseBackgroundColor = useMemo(
    () => (gardenBackgroundColor && gardenBackgroundColor.trim().length > 0 ? gardenBackgroundColor : '#f2f9f2'),
    [gardenBackgroundColor]
  );
  const containerStyle = useMemo(() => [styles.container, { backgroundColor: baseBackgroundColor }], [baseBackgroundColor]);
  const canvasStyle = useMemo(
    () => [styles.canvas, { backgroundColor: stencilModeEnabled ? 'transparent' : CANVAS_BACKGROUND }],
    [stencilModeEnabled]
  );
  const stencilViewportStyle = useMemo(() => {
    if (!canvasSize.width || !canvasSize.height) {
      return { width: 240, height: 240, left: 0, top: 0 };
    }

    const width = Math.max(canvasSize.width * 0.82, 140);
    const height = Math.max(canvasSize.height * 0.82, 140);

    return {
      width,
      height,
      left: (canvasSize.width - width) / 2,
      top: (canvasSize.height - height) / 2,
    };
  }, [canvasSize.height, canvasSize.width]);

  const { height: windowHeight } = useWindowDimensions();
  const paletteMaxHeight = Math.max(windowHeight - insets.top - 32, 360);
  const palettePaddingBottom = 24 + insets.bottom;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    setActiveEmojiPicker(null);
  }, [activeSheet]);

  const deleteZoneCenter = useMemo(() => {
    if (!penButtonLayout) {
      return null;
    }

    return {
      x: penButtonLayout.x + penButtonLayout.width / 2,
      y: penButtonLayout.y + penButtonLayout.height / 2,
    };
  }, [penButtonLayout]);

  const isPointInDeleteZone = useCallback(
    (point: { x: number; y: number } | null) => {
      if (!point || !penButtonLayout || !deleteZoneCenter) {
        return false;
      }

      const radius = Math.max(penButtonLayout.width, penButtonLayout.height) / 2 + 24;
      const dx = point.x - deleteZoneCenter.x;
      const dy = point.y - deleteZoneCenter.y;
      return Math.hypot(dx, dy) <= radius;
    },
    [deleteZoneCenter, penButtonLayout]
  );

  const isDragOverDeleteZone = useMemo(
    () => (activeDrag ? isPointInDeleteZone(activeDrag.point) : false),
    [activeDrag, isPointInDeleteZone]
  );

  const deleteZoneVisible = Boolean(activeDrag);
  const shouldHighlightDeleteZone = deleteZoneVisible && isDragOverDeleteZone;

  const inventoryList = useMemo(
    () =>
      emojiCatalog
        .map<InventoryEntry>((item) => {
          const normalizedTags = item.tags.map((tag) => tag.toLowerCase());
          const normalizedName = item.name.toLowerCase();
          const condensedName = normalizedName.replace(/\s+/g, '');
          const categoryLabel = CATEGORY_LABELS[item.category].toLowerCase();
          const normalizedEmoji = stripVariationSelectors(item.emoji).toLowerCase();
          const searchBlob = Array.from(
            new Set([
              normalizedName,
              condensedName,
              item.emoji.toLowerCase(),
              normalizedEmoji,
              categoryLabel,
              ...normalizedTags,
            ])
          ).join(' ');

          return {
            ...item,
            owned: Boolean(emojiInventory[item.id]),
            searchBlob,
            normalizedEmoji,
          };
        })
        .sort((a, b) => {
          const categoryDiff = emojiCategoryOrder[a.category] - emojiCategoryOrder[b.category];
          if (categoryDiff !== 0) {
            return categoryDiff;
          }

          if (a.popularity !== b.popularity) {
            return a.popularity - b.popularity;
          }

          if (a.cost !== b.cost) {
            return a.cost - b.cost;
          }

          return a.name.localeCompare(b.name);
        }),
    [emojiCatalog, emojiInventory]
  );

  const ownedInventory = useMemo(() => inventoryList.filter((item) => item.owned), [inventoryList]);
  const normalizedFilter = shopFilter.trim().toLowerCase();
  const normalizedFilterEmoji = useMemo(() => stripVariationSelectors(normalizedFilter), [normalizedFilter]);
  const emojiTokens = useMemo<EmojiToken[]>(() => {
    const matches = shopFilter.match(EMOJI_SEQUENCE_REGEX);

    if (!matches) {
      return [];
    }

    return matches
      .map((glyph) => glyph.trim())
      .filter((glyph) => glyph.length > 0)
      .map((glyph) => {
        const normalized = stripVariationSelectors(glyph).toLowerCase();
        return normalized.length > 0 ? { original: glyph, normalized } : null;
      })
      .filter((token): token is EmojiToken => Boolean(token));
  }, [shopFilter]);
  const normalizedEmojiTokens = useMemo(
    () => emojiTokens.map((token) => token.normalized),
    [emojiTokens]
  );
  const normalizedFilterWords = useMemo(
    () => (normalizedFilter ? normalizedFilter.split(/\s+/).filter(Boolean) : []),
    [normalizedFilter]
  );
  const matchesFilter = useCallback(
    (item: InventoryEntry) => {
      if (!normalizedFilter) {
        return true;
      }

      if (item.searchBlob.includes(normalizedFilter)) {
        return true;
      }

      if (normalizedFilterWords.length > 1 && normalizedFilterWords.every((word) => item.searchBlob.includes(word))) {
        return true;
      }

      if (normalizedFilterEmoji && item.normalizedEmoji.includes(normalizedFilterEmoji)) {
        return true;
      }

      return normalizedEmojiTokens.some((glyph) => item.normalizedEmoji.includes(glyph));
    },
    [normalizedEmojiTokens, normalizedFilter, normalizedFilterEmoji, normalizedFilterWords]
  );
  const matchesCategory = useCallback(
    (item: InventoryEntry) => {
      if (activeCategory === 'all') {
        return true;
      }

      if (activeCategory === 'custom') {
        return item.id.startsWith('custom-');
      }

      return item.category === activeCategory;
    },
    [activeCategory]
  );

  // Track assigned costs to ensure uniqueness
  const assignedCostsRef = useRef<Map<number, string>>(new Map());
  
  const computeKitchenEmojiCost = useCallback((emojiValue: string) => {
    const codePoints = Array.from(emojiValue).map((char) => char.codePointAt(0) ?? 0);

    if (codePoints.length === 0) {
      return computeBellCurveCost(0.5);
    }

    const hash = codePoints.reduce((accumulator, point) => (accumulator * 257 + point) % 1_000_003, 0);
    const normalized = hash / 1_000_003;
    let baseCost = computeBellCurveCost(normalized);
    
    // Check if this cost is already assigned to a different emoji
    const existingEmoji = assignedCostsRef.current.get(baseCost);
    if (existingEmoji && existingEmoji !== emojiValue) {
      // Find a unique cost by incrementing/decrementing slightly
      let offset = 1;
      const maxOffset = 50;
      while (offset <= maxOffset) {
        // Try adding offset first
        const adjustedCost = baseCost + offset;
        if (!assignedCostsRef.current.has(adjustedCost)) {
          baseCost = adjustedCost;
          break;
        }
        // Try subtracting offset
        const adjustedCostDown = baseCost - offset;
        if (adjustedCostDown >= MIN_EMOJI_COST && !assignedCostsRef.current.has(adjustedCostDown)) {
          baseCost = adjustedCostDown;
          break;
        }
        offset++;
      }
    }
    
    // Register this emoji with its cost
    assignedCostsRef.current.set(baseCost, emojiValue);
    return baseCost;
  }, []);

  useEffect(() => {
    if (emojiTokens.length === 0) {
      return;
    }

    const seen = new Set<string>();
    emojiTokens.forEach((token) => {
      if (seen.has(token.original)) {
        return;
      }
      seen.add(token.original);
      registerCustomEmoji(token.original);
    });
  }, [emojiTokens, registerCustomEmoji]);

  useEffect(() => {
    if (activeCategory !== 'custom') {
      setCustomBlendError(null);
    }
  }, [activeCategory]);

  const handleBlendCustomEmoji = useCallback(async () => {
    setCustomBlendError(null);
    setIsLoadingCustomBlend(true);

    try {
      const result = await fetchEmojiKitchenMash(customEmojiLeft, customEmojiRight);
      const compositeEmoji = `${customEmojiLeft}${customEmojiRight}`;
      const estimatedCost = computeKitchenEmojiCost(compositeEmoji);
      setCustomBlendPreview(result.imageUrl);
      setCustomBlendDescription(result.description);
      setCustomBlendCost(estimatedCost);
    } catch (error) {
      setCustomBlendPreview(null);
      setCustomBlendDescription('');
      setCustomBlendCost(null);
      setCustomBlendError(
        error instanceof Error ? error.message : 'Unable to create a mashup right now. Please try again.'
      );
    } finally {
      setIsLoadingCustomBlend(false);
    }
  }, [computeKitchenEmojiCost, customEmojiLeft, customEmojiRight]);

  // Auto-blend when both emojis are present
  useEffect(() => {
    if (suppressAutoBlendRef.current) {
      console.log('🚫 Auto-blend suppressed');
      return;
    }
    if (customEmojiLeft && customEmojiRight && customEmojiLeft.trim().length > 0 && customEmojiRight.trim().length > 0) {
      console.log('🎨 Auto-blend triggered for:', customEmojiLeft, customEmojiRight);
      // Call blend directly without including it in dependencies to avoid infinite loops
      const blendEmojis = async () => {
        setCustomBlendError(null);
        setIsLoadingCustomBlend(true);

        try {
          const result = await fetchEmojiKitchenMash(customEmojiLeft, customEmojiRight);
          const compositeEmoji = `${customEmojiLeft}${customEmojiRight}`;
          const estimatedCost = computeKitchenEmojiCost(compositeEmoji);
          
          setCustomBlendPreview(result.imageUrl);
          setCustomBlendDescription(result.description);
          setCustomBlendCost(estimatedCost);
        } catch (error) {
          setCustomBlendPreview(null);
          setCustomBlendDescription('');
          setCustomBlendCost(null);
          setCustomBlendError(
            error instanceof Error ? error.message : 'Unable to create a mashup right now. Please try again.'
          );
        } finally {
          setIsLoadingCustomBlend(false);
        }
      };
      blendEmojis();
    }
  }, [customEmojiLeft, customEmojiRight, hasPremiumUpgrade, computeKitchenEmojiCost]);

  const handleRandomizeBlend = useCallback(async () => {
    // Filter for base emojis (not custom ones) to ensure better compatibility
    const candidates = emojiCatalog.filter(e => !e.id.startsWith('custom-'));
    
    if (candidates.length < 2) return;

    // Keep trying until we find a compatible pair
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      // Pick a random base emoji
      const left = candidates[Math.floor(Math.random() * candidates.length)].emoji;
      
      try {
        // Find a compatible partner
        const right = await getRandomCompatibleEmoji(left);
        
        if (right) {
          // Found a compatible pair! Set the emojis and let auto-blend handle the rest
          setCustomEmojiLeft(left);
          setCustomEmojiRight(right);
          return;
        }
      } catch (error) {
        // This emoji didn't work, try another
      }
      
      attempts++;
    }
  }, [emojiCatalog]);

  const handlePurchaseCustomBlend = useCallback(async () => {
    if (!customBlendPreview) {
      setCustomBlendError('Create a blend with Emoji Kitchen first.');
      return;
    }

    const compositeEmoji = `${customEmojiLeft}${customEmojiRight}`;
    const blendCost = customBlendCost ?? computeKitchenEmojiCost(compositeEmoji);

    // Check free blend limit for non-premium users
    if (!hasPremiumUpgrade) {
      if (blendCost >= 100000) {
        setCustomBlendError('Premium required: This blend costs 100K+ clicks. Upgrade to unlock it.');
        return;
      }
      
      if (freeBlendsUsed >= 5) {
        setCustomBlendError('Free blend limit reached. Upgrade to Premium for unlimited blends.');
        return;
      }
    }

    // First, register the custom emoji and get the definition immediately
    const definition = (registerCustomEmoji as any)(compositeEmoji, {
      name: customBlendDescription ? formatCustomEmojiName(customBlendDescription) : undefined,
      costOverride: blendCost,
      imageUrl: customBlendPreview,
      tags: ['emoji kitchen', 'blend', compositeEmoji],
    });

    if (!definition) {
      setCustomBlendError('Unable to save your custom emoji.');
      return;
    }

    // Check if already owned
    if (emojiInventory[definition.id]) {
      setCustomBlendError(null);
      setSelectedEmoji(definition.id);
      setShopPreview(definition as any);
      return;
    }

    const success = (purchaseEmoji as any)(definition.id, definition);

    if (!success) {
      setCustomBlendError('Earn more clicks to purchase this blend.');
      return;
    }

    // Increment free blend counter for non-premium users
    if (!hasPremiumUpgrade) {
      incrementFreeBlendsUsed();
    }

    setCustomBlendError(null);
    setSelectedEmoji(definition.id);
    setShopPreview(null); // Don't set shopPreview for custom blends - handled in the Emoji Kitchen card
  }, [
    computeKitchenEmojiCost,
    customBlendCost,
    customBlendDescription,
    customBlendPreview,
    customEmojiLeft,
    customEmojiRight,
    emojiInventory,
    purchaseEmoji,
    registerCustomEmoji,
    hasPremiumUpgrade,
    freeBlendsUsed,
    incrementFreeBlendsUsed,
  ]);

  const filteredShopInventory = useMemo(() => {
    const filtered = inventoryList.filter((item) => matchesCategory(item) && matchesFilter(item));
    const baseList =
      filtered.length === 0 && normalizedFilter && normalizedEmojiTokens.length === 0
        ? inventoryList.filter((item) => matchesCategory(item))
        : filtered;

    const sorter = (a: InventoryEntry, b: InventoryEntry) => {
      // For custom category, prioritize items based on user's harvest and sort order
      if (activeCategory === 'custom') {
        const canAffordA = harvest >= a.cost;
        const canAffordB = harvest >= b.cost;
        
        if (priceSortOrder === 'asc') {
          // Low to high: only show affordable items, sorted by cost
          if (canAffordA && !canAffordB) return -1;
          if (!canAffordA && canAffordB) return 1;
          return a.cost - b.cost;
        } else {
          // High to low: prioritize affordable items first, then by cost descending
          if (canAffordA && !canAffordB) return -1;
          if (!canAffordA && canAffordB) return 1;
          return b.cost - a.cost;
        }
      }
      
      // Default sorting for other categories
      if (a.cost === b.cost) {
        if (a.popularity === b.popularity) {
          return a.name.localeCompare(b.name);
        }
        return a.popularity - b.popularity;
      }

      return priceSortOrder === 'asc' ? a.cost - b.cost : b.cost - a.cost;
    };

    let sorted = [...baseList].sort(sorter);
    
    // Filter out unaffordable items when in custom category with low-to-high sort
    if (activeCategory === 'custom' && priceSortOrder === 'asc') {
      sorted = sorted.filter(item => harvest >= item.cost);
    }

    return sorted;
  }, [
    inventoryList,
    matchesCategory,
    matchesFilter,
    normalizedEmojiTokens.length,
    normalizedFilter,
    priceSortOrder,
    activeCategory,
    harvest,
  ]);
  const filteredOwnedInventory = useMemo(() => {
    const filtered = ownedInventory.filter((item) => matchesCategory(item) && matchesFilter(item));

    const applyOrder = (items: InventoryEntry[]) => {
      return [...items].sort((a, b) => {
        const orderA = inventoryOrder.indexOf(a.id);
        const orderB = inventoryOrder.indexOf(b.id);

        if (orderA === -1 && orderB === -1) {
          return 0;
        }

        if (orderA === -1) {
          return 1;
        }

        if (orderB === -1) {
          return -1;
        }

        return orderA - orderB;
      });
    };

    if (filtered.length === 0 && normalizedFilter && ownedInventory.length > 0) {
      return applyOrder(ownedInventory.filter((item) => matchesCategory(item)));
    }

    return applyOrder(filtered);
  }, [inventoryOrder, matchesCategory, matchesFilter, normalizedFilter, ownedInventory]);
  const selectedDetails = useMemo(
    () => inventoryList.find((item) => item.id === selectedEmoji) ?? null,
    [inventoryList, selectedEmoji]
  );

  useEffect(() => {
    if (ownedInventory.length === 0) {
      setInventoryOrder([]);
      return;
    }

    setInventoryOrder((prev) => {
      const retained = prev.filter((id) => ownedInventory.some((entry) => entry.id === id));
      const missing = ownedInventory
        .map((entry) => entry.id)
        .filter((id) => !retained.includes(id));
      return [...retained, ...missing];
    });
  }, [ownedInventory]);

  useEffect(() => {
    filteredOwnedInventoryRef.current = filteredOwnedInventory;
  }, [filteredOwnedInventory]);

  useEffect(() => {
    draggingInventoryIdRef.current = draggingInventoryId;
  }, [draggingInventoryId]);

  const canReorderInventory = useMemo(
    () =>
      activeCategory === 'all' &&
      normalizedFilter.length === 0 &&
      normalizedEmojiTokens.length === 0 &&
      ownedInventory.length > 0,
    [activeCategory, normalizedEmojiTokens.length, normalizedFilter.length, ownedInventory.length]
  );

  const handleInventoryTileLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    if (width > 0 && height > 0) {
      tileSizeRef.current = { width, height };
    }
  }, []);

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  }, []);

  const getCanvasCenter = useCallback(() => {
    const { width, height } = canvasSize;

    if (width <= 0 || height <= 0) {
      return { x: 180, y: 200 };
    }

    return { x: width / 2, y: height / 2 };
  }, [canvasSize]);

  const commitInventoryReorder = useCallback((emojiId: string, targetIndex: number) => {
    const list = filteredOwnedInventoryRef.current;

    if (list.length === 0) {
      return;
    }

    const ids = list.map((entry) => entry.id);
    const boundedIndex = Math.max(0, Math.min(ids.length - 1, targetIndex));
    const baseOrder = ids.filter((id, index) => ids.indexOf(id) === index);
    const currentIndex = baseOrder.indexOf(emojiId);

    if (currentIndex !== -1) {
      baseOrder.splice(currentIndex, 1);
    }

    baseOrder.splice(boundedIndex, 0, emojiId);

    setInventoryOrder((prev) => {
      const remaining = prev.filter((id) => !baseOrder.includes(id));
      return [...baseOrder, ...remaining];
    });
  }, []);

  const beginInventoryDrag = useCallback((emojiId: string, index: number) => {
    dragStartIndexRef.current = index;
    dragCurrentIndexRef.current = index;
    draggingInventoryIdRef.current = emojiId;
    setDraggingInventoryId(emojiId);
  }, []);

  const updateInventoryDrag = useCallback(
    (translationX: number, translationY: number) => {
      const activeId = draggingInventoryIdRef.current;

      if (!activeId) {
        return;
      }

      const { width, height } = tileSizeRef.current;

      if (width <= 0 || height <= 0) {
        return;
      }

      const effectiveWidth = width + INVENTORY_COLUMN_GAP;
      const effectiveHeight = height + INVENTORY_ROW_GAP;
      const columnShift = Math.round(translationX / effectiveWidth);
      const rowShift = Math.round(translationY / effectiveHeight);
      const nextIndex =
        dragStartIndexRef.current + columnShift + rowShift * INVENTORY_COLUMNS;
      const listLength = filteredOwnedInventoryRef.current.length;

      if (listLength === 0) {
        return;
      }

      const boundedIndex = Math.max(0, Math.min(listLength - 1, nextIndex));

      if (boundedIndex === dragCurrentIndexRef.current) {
        return;
      }

      dragCurrentIndexRef.current = boundedIndex;
      commitInventoryReorder(activeId, boundedIndex);
    },
    [commitInventoryReorder]
  );

  const endInventoryDrag = useCallback(() => {
    if (!draggingInventoryIdRef.current) {
      return;
    }

    draggingInventoryIdRef.current = null;
    dragStartIndexRef.current = 0;
    dragCurrentIndexRef.current = 0;
    setDraggingInventoryId(null);
  }, []);

  const handleCanvasPress = (event: GestureResponderEvent) => {
    if (skipNextCanvasTapRef.current) {
      skipNextCanvasTapRef.current = false;
      if (skipTapResetTimeoutRef.current) {
        clearTimeout(skipTapResetTimeoutRef.current);
        skipTapResetTimeoutRef.current = null;
      }
      return;
    }

    if (isDrawingMode) {
      return;
    }

    if (!selectedEmoji) {
      return;
    }

    if (!emojiInventory[selectedEmoji]) {
      Alert.alert('Locked decoration', 'Unlock this emoji before placing it in your garden.');
      setSelectedEmoji(null);
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    const placed = placeEmoji(selectedEmoji, { x: locationX, y: locationY });

    if (!placed) {
      Alert.alert('Placement unavailable', 'Unlock this emoji to decorate with it.');
      setSelectedEmoji(null);
    }
  };

  const handleSelect = useCallback((emojiId: string, owned: boolean) => {
    if (!owned) {
      Alert.alert('Unlock required', 'Buy this decoration before placing it in the garden.');
      return;
    }

    setSelectedEmoji(emojiId);
    setActiveSheet(null);
    setIsDrawingMode(false);
  }, []);

  const handleInventorySelect = useCallback((item: InventoryEntry) => {
    // Toggle emoji stats display in inventory
    if (selectedInventoryEmoji?.id === item.id) {
      setSelectedInventoryEmoji(null);
      setIsEditingInventoryName(false);
    } else {
      setSelectedInventoryEmoji(item);
      setIsEditingInventoryName(false);
    }
  }, [selectedInventoryEmoji]);

  const handleInventoryEmojiIconFlip = useCallback(() => {
    RNAnimated.timing(inventoryFlipAnimation, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      inventoryFlipAnimation.setValue(0);
    });
  }, [inventoryFlipAnimation]);

  const handleInventoryLongPress = useCallback((item: InventoryEntry) => {
    console.log('🎒 Long press detected for:', item.name, 'Inventory:', inventoryEmoji);
    
    // Toggle emoji in the current inventory wallet
    setInventoryWallets(prev => {
      const currentWallet = prev[inventoryEmoji] || [];
      const isInWallet = currentWallet.some(e => e.id === item.id);
      
      if (isInWallet) {
        console.log('🗑️ Removing from wallet:', item.name);
        // Remove from current wallet
        return {
          ...prev,
          [inventoryEmoji]: currentWallet.filter(e => e.id !== item.id),
        };
      } else {
        console.log('✨ Adding to wallet:', item.name);
        // Add to current wallet (max 10 items)
        if (currentWallet.length >= 10) {
          console.log('💼 Wallet full, replacing oldest');
          return {
            ...prev,
            [inventoryEmoji]: [...currentWallet.slice(1), item], // Remove first, add new
          };
        }
        return {
          ...prev,
          [inventoryEmoji]: [...currentWallet, item],
        };
      }
    });
  }, [inventoryEmoji]);

  const handlePurchase = (emojiId: string) => {
    const success = purchaseEmoji(emojiId);

    if (!success) {
      Alert.alert('Not enough clicks', 'Gather more clicks to unlock this decoration.');
    }

    return success;
  };

  const handleSelectPenColor = useCallback(
    (color: string) => {
      setPenColor(color);
      setShowExtendedPalette(false);
      setIsDrawingMode(true);
    },
    [setIsDrawingMode, setShowExtendedPalette]
  );

  const handleSelectStrokeStyle = useCallback(
    (styleId: StrokeStyleId) => {
      setStrokeStyle(styleId);
      setIsDrawingMode(true);
    },
    []
  );

  const handleClearDrawings = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  const handleClearGarden = useCallback(() => {
    if (placements.length > 0) {
      clearGarden();
    }
    handleClearDrawings();
    setIsDrawingMode(false);
    setSelectedEmoji(null);
    setStencilModeEnabled(false);
    setStencilReferenceUri(null);
  }, [clearGarden, handleClearDrawings, placements, setIsDrawingMode, setStencilReferenceUri]);

  const handleSaveSnapshot = useCallback(async () => {
    if (!canvasRef.current || isSavingSnapshot) {
      return;
    }

    const permission = await MediaLibrary.requestPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access so we can save your garden to your device.'
      );
      return;
    }

    try {
      setIsSavingSnapshot(true);
      setPenHiddenForSave(true);
      await wait(80);
      const snapshotUri = await captureRef(canvasRef, { format: 'png', quality: 1 });
      // Don't call MediaLibrary.saveToLibraryAsync here - let the callback handle it
      // Show custom confirmation modal with updated text
      if (onGardenSave) {
        onGardenSave(snapshotUri);
      } else {
        // Fallback for screens that don't pass the callback
        Alert.alert(
          'Garden saved',
          'Your garden snapshot is now in your photos. Would you like to add it to your Promenade Gallery?',
          [
            {
              text: 'Photos only',
              style: 'cancel',
            },
            {
              text: 'Add to Promenade Gallery',
              onPress: () => {
                const entry = addWidgetPromenadePhoto(snapshotUri);
                if (entry) {
                  Alert.alert('Saved to Promenade Gallery', 'Your snapshot is ready to view and share from your Promenade Gallery.');
                }
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Save failed', 'We could not save the garden. Please try again.');
    } finally {
      setPenHiddenForSave(false);
      setIsSavingSnapshot(false);
    }
  }, [addWidgetPromenadePhoto, canvasRef, isSavingSnapshot]);

  const handleAddPhoto = useCallback(async () => {
    if (isPickingPhoto) {
      return;
    }

    try {
      setIsPickingPhoto(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', 'Enable photo access to add pictures to your garden.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset?.uri;

      if (!uri) {
        Alert.alert('Add photo failed', 'We could not read that photo. Please try another.');
        return;
      }

      const center = getCanvasCenter();
      const added = addPhotoPlacement(uri, center);
      if (added) {
        setShowPalette(false);
      }
    } catch {
      Alert.alert('Add photo failed', 'We could not open your photo library.');
    } finally {
      setIsPickingPhoto(false);
    }
  }, [addPhotoPlacement, getCanvasCenter, isPickingPhoto, setShowPalette]);

  const ensureCameraPermission = useCallback(async () => {
    if (cameraPermission?.granted) {
      return true;
    }

    const result = await requestCameraPermission();

    if (result?.granted) {
      return true;
    }

    Alert.alert('Camera access needed', 'Allow camera access to overlay your stencil on the canvas.');
    return false;
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handlePickStencilReference = useCallback(async () => {
    if (isPickingStencilReference) {
      return;
    }

    try {
      setIsPickingStencilReference(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', 'Enable photo access to choose a stencil reference.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset?.uri;

      if (!uri) {
        Alert.alert('Pick photo failed', 'We could not read that photo. Please try another.');
        return;
      }

      setStencilReferenceUri(uri);
    } catch {
      Alert.alert('Pick photo failed', 'We could not open your photo library.');
    } finally {
      setIsPickingStencilReference(false);
    }
  }, [isPickingStencilReference]);

  const handleToggleStencilMode = useCallback(async () => {
    const next = !stencilModeEnabled;
    const hasCanvasContent = placements.length > 0 || strokes.length > 0;

    if (next) {
      const hasReference = Boolean(stencilReferenceUri);
      if (!hasReference && !hasCanvasContent) {
        Alert.alert(
          'Add a stencil reference',
          'Choose a reference photo or create something on the canvas to overlay on your camera.'
        );
        return;
      }

      const granted = await ensureCameraPermission();
      if (!granted) {
        return;
      }
    }

    setStencilModeEnabled(next);
  }, [ensureCameraPermission, placements.length, stencilModeEnabled, stencilReferenceUri, strokes.length]);

  const handleAdjustStencilOpacity = useCallback((delta: number) => {
    setStencilOpacity((prev) => clamp(Number((prev + delta).toFixed(2)), 0.1, 1));
  }, []);

  useEffect(() => {
    stencilTranslationX.value = 0;
    stencilTranslationY.value = 0;
    stencilScale.value = 1;
  }, [stencilReferenceUri, stencilScale, stencilTranslationX, stencilTranslationY]);

  // Filter out emojis from text input
  const handleTextInputChange = useCallback((text: string) => {
    // Remove emoji characters - matches all emoji patterns including:
    // - Basic emoji
    // - Emoji with skin tone modifiers
    // - Zero-width joiners (combined emoji)
    // - Variation selectors
    const filteredText = text.replace(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}](?:[\p{Emoji_Modifier}]|[\u{200D}][\p{Emoji_Presentation}\p{Extended_Pictographic}])*[\uFE0E\uFE0F]?/gu,
      ''
    );
    setTextDraft(filteredText);
  }, []);

  const handleAddText = useCallback(() => {
    const trimmed = textDraft.replace(/\n+/g, ' ').trim();

    if (trimmed.length === 0) {
      return;
    }

    const color = penColor === ERASER_COLOR ? DEFAULT_TEXT_COLOR : penColor;
    const center = getCanvasCenter();
    const normalizedScale = clamp(textScale, TEXT_SCALE_MIN, TEXT_SCALE_MAX);
    const added = addTextPlacement(trimmed, center, color, selectedTextStyle, normalizedScale);

    if (added) {
      setTextDraft('');
      setShowPalette(false);
      Keyboard.dismiss();
    }
  }, [addTextPlacement, getCanvasCenter, penColor, selectedTextStyle, setShowPalette, textDraft, textScale]);

  const handlePlacementDragBegin = useCallback(
    (placementId: string, center: { x: number; y: number }) => {
      if (isDrawingMode) {
        setIsDrawingMode(false);
      }

      setActiveDrag({ id: placementId, point: center });
    },
    [isDrawingMode]
  );

  const handlePlacementGesture = useCallback(() => {
    skipNextCanvasTapRef.current = true;
    if (skipTapResetTimeoutRef.current) {
      clearTimeout(skipTapResetTimeoutRef.current);
    }
    skipTapResetTimeoutRef.current = setTimeout(() => {
      skipNextCanvasTapRef.current = false;
      skipTapResetTimeoutRef.current = null;
    }, 160);
  }, []);

  const handlePlacementDragMove = useCallback((placementId: string, center: { x: number; y: number }) => {
    setActiveDrag({ id: placementId, point: center });
  }, []);

  const stencilPanGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      stencilPanStartX.value = stencilTranslationX.value;
      stencilPanStartY.value = stencilTranslationY.value;
    })
    .onChange((event) => {
      stencilTranslationX.value = stencilPanStartX.value + event.translationX;
      stencilTranslationY.value = stencilPanStartY.value + event.translationY;
    });

  const stencilPinchGesture = Gesture.Pinch()
    .onStart(() => {
      stencilScaleStart.value = stencilScale.value;
    })
    .onChange((event) => {
      const nextScale = stencilScaleStart.value * event.scale;
      stencilScale.value = Math.min(Math.max(nextScale, STENCIL_MIN_SCALE), STENCIL_MAX_SCALE);
    });

  const stencilTransformGesture = Gesture.Simultaneous(stencilPanGesture, stencilPinchGesture);

  const stencilImageAnimatedStyle = useAnimatedStyle(() => {
    const clampedScale = Math.min(Math.max(stencilScale.value, STENCIL_MIN_SCALE), STENCIL_MAX_SCALE);
    return {
      transform: [
        { translateX: stencilTranslationX.value },
        { translateY: stencilTranslationY.value },
        { scale: clampedScale },
      ],
    };
  });

  const handlePlacementDragEnd = useCallback(
    (placementId: string, center: { x: number; y: number }) => {
      const shouldDelete = isPointInDeleteZone(center);

      if (shouldDelete) {
        removePlacement(placementId);
      }

      setActiveDrag(null);
    },
    [isPointInDeleteZone, removePlacement]
  );

  const renderStrokeSegments = useCallback(
    (stroke: Stroke, prefix: string) => {
      const preset = getBrushPreset(stroke.style);
      const points = stroke.modeledPoints && stroke.modeledPoints.length > 0 ? stroke.modeledPoints : stroke.points;
      if (points.length === 0) {
        return [] as React.ReactElement[];
      }

      const segments: React.ReactElement[] = [];
      const firstPoint = points[0];
      const strokeColor = applyAlpha(stroke.color, preset.opacity);
      const baseSize = stroke.size * preset.sizeScale;
      const pointCount = Math.max(points.length - 1, 1);
      const taperForIndex = (index: number) => {
        if (!preset.taper) {
          return 1;
        }

        const progress = index / pointCount;
        if (progress < 0.2) {
          return lerp(0.45, 1, progress / 0.2);
        }

        if (progress > 0.8) {
          return lerp(1, 0.55, (progress - 0.8) / 0.2);
        }

        return 1;
      };
      segments.push(
        <View
          key={`${prefix}-point-0`}
          style={[
            styles.strokeSegment,
            {
              width: baseSize * taperForIndex(0),
              height: baseSize * taperForIndex(0),
              borderRadius: (baseSize * taperForIndex(0)) / 2,
              left: firstPoint.x - (baseSize * taperForIndex(0)) / 2,
              top: firstPoint.y - (baseSize * taperForIndex(0)) / 2,
              backgroundColor: strokeColor,
              transform: [],
              shadowColor: stroke.color,
              shadowOpacity: preset.id === 'chalk' ? 0.25 : preset.id === 'marker' ? 0.12 : 0,
              shadowRadius: preset.id === 'chalk' ? 4 : preset.id === 'marker' ? 3 : 0,
            },
          ]}
        />

      );

      for (let index = 1; index < points.length; index += 1) {
        const prev = points[index - 1];
        const point = points[index];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
          continue;
        }

        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const thickness = baseSize * taperForIndex(index);
        segments.push(
          <View
            key={`${prefix}-segment-${index}`}
            style={[
              styles.strokeSegment,
              {
                width: distance,
                height: thickness,
                backgroundColor: strokeColor,
                left: (prev.x + point.x) / 2 - distance / 2,
                top: (prev.y + point.y) / 2 - thickness / 2,
                borderRadius: thickness / 2,
                transform: [{ rotateZ: `${angle}deg` }],
                shadowColor: stroke.color,
                shadowOpacity: preset.id === 'chalk' ? 0.22 : preset.id === 'marker' ? 0.1 : 0,
                shadowRadius: preset.id === 'chalk' ? 4 : preset.id === 'marker' ? 3 : 0,
              },
            ]}
          />
        );
      }

      return segments;
    },
    []
  );

  const beginStroke = useCallback(
    (x: number, y: number) => {
      const strokeColor = penColor === ERASER_COLOR ? CANVAS_BACKGROUND : penColor;
      const seed = Math.random();
      const strokeStyleId = strokeStyle ?? 'pen';
      const stroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        color: strokeColor,
        size: penSize,
        points: [{ x, y }],
        style: strokeStyleId,
        seed,
      };
      stroke.modeledPoints = modelStrokePoints(stroke.points, strokeStyleId, seed);
      setCurrentStroke(stroke);
    },
    [penColor, penSize, strokeStyle]
  );

  const appendPoint = useCallback((x: number, y: number) => {
    setCurrentStroke((prev) => {
      if (!prev) {
        return prev;
      }

      const lastPoint = prev.points[prev.points.length - 1];
      if (lastPoint && Math.abs(lastPoint.x - x) < 0.5 && Math.abs(lastPoint.y - y) < 0.5) {
        return prev;
      }

      const style = prev.style ?? strokeStyle ?? 'pen';
      const seed = prev.seed ?? Math.random();
      const nextPoints = [...prev.points, { x, y }];

      return {
        ...prev,
        seed,
        style,
        points: nextPoints,
        modeledPoints: modelStrokePoints(nextPoints, style, seed),
      };
    });
  }, [strokeStyle]);

  const endStroke = useCallback(() => {
    setCurrentStroke((prev) => {
      if (prev && prev.points.length > 0) {
        const style = prev.style ?? strokeStyle ?? 'pen';
        const seed = prev.seed ?? Math.random();
        const modeledPoints = modelStrokePoints(prev.points, style, seed);
        setStrokes((existing) => [...existing, { ...prev, style, seed, modeledPoints }]);
      }
      return null;
    });
  }, [strokeStyle]);

  const handleCanvasTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!isDrawingMode) {
        return;
      }

      const { locationX, locationY } = event.nativeEvent;
      setIsDrawingGestureActive(true);
      beginStroke(locationX, locationY);
    },
    [beginStroke, isDrawingMode]
  );

  const handleCanvasTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isDrawingMode) {
        return;
      }

      const touch = event.nativeEvent.touches?.[0];
      if (touch) {
        appendPoint(touch.locationX, touch.locationY);
        return;
      }

      appendPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [appendPoint, isDrawingMode]
  );

  const handleCanvasTouchEnd = useCallback(() => {
    if (!isDrawingMode) {
      setIsDrawingGestureActive(false);
      return;
    }

    endStroke();
    setIsDrawingGestureActive(false);
  }, [endStroke, isDrawingMode]);

  useEffect(() => {
    if (!isDrawingMode) {
      setCurrentStroke(null);
    }
  }, [isDrawingMode]);

  useEffect(() => {
    if (!isDrawingMode) {
      setIsDrawingGestureActive(false);
    }
  }, [isDrawingMode]);

  useEffect(() => {
    if (!showPalette) {
      setShowExtendedPalette(false);
      setFontDropdownOpen(false);
    }
  }, [showPalette]);

  useEffect(
    () => () => {
      if (skipTapResetTimeoutRef.current) {
        clearTimeout(skipTapResetTimeoutRef.current);
        skipTapResetTimeoutRef.current = null;
      }
    },
    []
  );

  const selectedTextStyleOption = useMemo(
    () => TEXT_STYLE_OPTIONS.find((option) => option.id === selectedTextStyle) ?? TEXT_STYLE_OPTIONS[0],
    [selectedTextStyle]
  );

  const shouldShowCanvasEmptyState = useMemo(
    () =>
      placements.length === 0 &&
      strokes.length === 0 &&
      !selectedEmoji &&
      !currentStroke &&
      !stencilReferenceUri &&
      !stencilModeEnabled,
    [currentStroke, placements.length, stencilModeEnabled, stencilReferenceUri, strokes.length, selectedEmoji]
  );
  const handleCloseSheet = useCallback(() => {
    setActiveSheet(null);
    setActiveEmojiPicker(null);
    setShopPreview(null);
  }, []);
  const handleOpenSheet = useCallback((sheet: 'shop' | 'inventory') => setActiveSheet(sheet), []);
  const togglePriceSortOrder = useCallback(
    () => setPriceSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')),
    []
  );
  const handleChangeCategory = useCallback(
    (category: CategoryFilter) => {
      setActiveCategory(category);
      endInventoryDrag();
    },
    [endInventoryDrag]
  );

  const keyExtractor = useCallback((item: InventoryEntry) => item.id, []);

  const bannerTopPadding = insets.top + 24;
  const contentBottomPadding = insets.bottom + 48;
  const canClearGarden = placements.length > 0 || strokes.length > 0 || stencilModeEnabled || !!stencilReferenceUri;
  const totalCollected = useMemo(
    () => Object.values(emojiInventory).filter(Boolean).length,
    [emojiInventory]
  );
  const collectionProgressLabel = useMemo(
    () =>
      `${totalCollected.toLocaleString()} / ${TOTAL_EMOJI_LIBRARY_COUNT.toLocaleString()}`,
    [totalCollected]
  );
  const handleDismissShopPreview = useCallback(() => setShopPreview(null), []);
  
  const handlePurchaseShopPreview = useCallback((itemId: string) => {
    const success = purchaseEmoji(itemId);
    return success;
  }, [purchaseEmoji]);
  
  const handleUnlockPreview = () => {
    if (!shopPreview) {
      return;
    }

    if (shopPreview.owned) {
      handleDismissShopPreview();
      handleOpenSheet('inventory');
      return;
    }

    const success = handlePurchase(shopPreview.id);
    if (success) {
      handleDismissShopPreview();
      handleOpenSheet('inventory');
    }
  };

  const renderShopItem: ListRenderItem<InventoryEntry> = ({ item }) => {
    const owned = item.owned;
    const canAfford = harvest >= item.cost;
    const locked = !owned;
    const categoryLabel = CATEGORY_LABELS[item.category];

    const accessibilityHint = locked
      ? canAfford
        ? `View details and unlock this ${categoryLabel.toLowerCase()} decoration.`
        : `Earn more harvest to unlock this ${categoryLabel.toLowerCase()} decoration.`
      : 'View details or open it in your inventory.';

    return (
      <View style={styles.sheetTileWrapper}>
        <Pressable
          style={({ pressed }) => [
            styles.shopTile,
            locked && styles.shopTileLocked,
            pressed && styles.shopTilePressed,
          ]}
          onPress={() => {
            // Check if this is a custom blend
            if (item.id.startsWith('custom-') && item.imageUrl) {
              // Extract the two emojis from the composite - use the stored emoji string
              const compositeEmoji = item.emoji;
              const emojis = Array.from(compositeEmoji);
              
              // For custom blends, we need at least 2 emoji characters
              if (emojis.length >= 2) {
                // Set the emojis (this will trigger auto-blend via useEffect)
                const emoji1 = emojis[0];
                const emoji2 = emojis.length > 1 ? emojis.slice(1).join('') : emojis[1];
                
                setCustomEmojiLeft(emoji1);
                setCustomEmojiRight(emoji2);
                
                // Pre-populate the blend preview so user doesn't see re-blend
                setCustomBlendPreview(item.imageUrl);
                setCustomBlendDescription(item.name);
                setCustomBlendCost(item.cost);
                setCustomBlendError(null);
                
                // Switch to custom category to show the Emoji Kitchen UI
                setActiveCategory('custom');
                
                // If owned, the UI will automatically show the info card
                // If not owned but not enough harvest, the UI will show the purchase option
                return;
              }
            }
            // For non-custom emojis, show the preview card
            setShopPreview(item);
          }}
          accessibilityLabel={`${item.name} emoji`}
          accessibilityHint={`${accessibilityHint} Price ${formatClickValue(item.cost)} clicks.`}
        >
            <View style={styles.shopTileAura}>
              <View style={styles.shopTileHalo} />
              <View style={[styles.shopTileCircle, locked && styles.shopTileCircleLocked]}>
                {item.imageUrl ? (
                  <ExpoImage 
                    source={{ uri: item.imageUrl }} 
                    style={styles.shopTileEmojiImage}
                    contentFit="contain"
                  />
                ) : !failedImageUrls.has(item.imageUrl || '') && !item.id.startsWith('custom-') ? (
                  <Text style={styles.shopTileEmoji}>{item.emoji}</Text>
                ) : (
                  // For custom blends without imageUrl, show a subtle loading indicator
                  <View style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
                    <Text style={styles.shopTileEmoji}>✨</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        </View>
      );
  };

  const renderInventoryItem: ListRenderItem<InventoryEntry> = ({ item, index }) => {
    const isSelected = selectedEmoji === item.id;
    const categoryLabel = CATEGORY_LABELS[item.category];
    const categoryIcon = CATEGORY_ICONS[item.category];
    const isDragging = draggingInventoryId === item.id;
    const shouldShake = false; // Disable shaking/jiggling for wallet system
    const isInWallet = walletEmojis.some(e => e.id === item.id);

    return (
      <InventoryTileItem
        key={item.id}
        item={item}
        index={index}
        isSelected={isSelected}
        isDragging={isDragging}
        categoryLabel={categoryLabel}
        categoryIcon={categoryIcon}
        canReorder={canReorderInventory}
        onSelect={handleSelect}
        onInventorySelect={handleInventorySelect}
        onInventoryLongPress={handleInventoryLongPress}
        isInWallet={isInWallet}
        walletColor={INVENTORY_COLORS[inventoryEmoji as keyof typeof INVENTORY_COLORS]?.color || '#f59e0b'}
        onLayout={handleInventoryTileLayout}
        beginDrag={beginInventoryDrag}
        updateDrag={updateInventoryDrag}
        endDrag={endInventoryDrag}
        draggingIdRef={draggingInventoryIdRef}
        shouldShake={shouldShake}
      />
    );
  };

  const handleShuffleSingle = useCallback(async (side: 'left' | 'right') => {
    const otherEmoji = side === 'left' ? customEmojiRight : customEmojiLeft;
    
    if (!otherEmoji || otherEmoji.trim().length === 0) {
       const candidates = emojiCatalog.filter(e => !e.id.startsWith('custom-'));
       if (candidates.length > 0) {
         const random = candidates[Math.floor(Math.random() * candidates.length)].emoji;
         if (side === 'left') setCustomEmojiLeft(random);
         else setCustomEmojiRight(random);
       }
       return;
    }

    setIsLoadingCustomBlend(true);
    try {
      const newEmoji = await getRandomCompatibleEmoji(otherEmoji);
      if (newEmoji) {
        if (side === 'left') setCustomEmojiLeft(newEmoji);
        else setCustomEmojiRight(newEmoji);
      }
    } catch (error) {
      console.warn('Shuffle failed:', error);
    } finally {
      setIsLoadingCustomBlend(false);
    }
  }, [customEmojiLeft, customEmojiRight, emojiCatalog]);

  // Cleanup function to reset states on unmount
  useEffect(() => {
    return () => {
      setCustomEmojiLeft('🌸');
      setCustomEmojiRight('🌟');
      setCustomBlendPreview(null);
      setCustomBlendDescription('');
      setCustomBlendCost(null);
      setCustomBlendError(null);
      setIsLoadingCustomBlend(false);
    };
  }, []);

  // Debugging: Log state changes
  useEffect(() => {
    console.log('State changed:');
    console.log('customEmojiLeft:', customEmojiLeft);
    console.log('customEmojiRight:', customEmojiRight);
    console.log('customBlendPreview:', customBlendPreview);
    console.log('customBlendDescription:', customBlendDescription);
    console.log('customBlendCost:', customBlendCost);
    console.log('customBlendError:', customBlendError);
    console.log('isLoadingCustomBlend:', isLoadingCustomBlend);
  }, [
    customEmojiLeft,
    customEmojiRight,
    customBlendPreview,
    customBlendDescription,
    customBlendCost,
    customBlendError,
    isLoadingCustomBlend,
  ]);

  const filteredShopInventoryDebug = useMemo(() => {
    return filteredShopInventory.map((item) => ({
      id: item.id,
      name: item.name,
      owned: item.owned,
      cost: item.cost,
      popularity: item.popularity,
      category: item.category,
      tags: item.tags,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      searchBlob: item.searchBlob,
      normalizedEmoji: item.normalizedEmoji,
    }));
  }, [filteredShopInventory]);

  const shouldShowStencilDetails = stencilModeEnabled;

  return (
    <Fragment>
      <View style={containerStyle}>
      <ScrollView
        style={styles.contentScroll}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.contentScrollContent,
          {
            paddingTop: 0,
            paddingBottom: contentBottomPadding,
            paddingHorizontal: responsiveContentPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDrawingGestureActive}>

        <View style={[styles.launcherRow, isLandscape && styles.launcherRowLandscape]}>
          <Pressable
            style={[styles.launcherCard, isLandscape && styles.launcherCardLandscape]}
            onPress={() => handleOpenSheet('shop')}
            accessibilityLabel="Open the Garden shop">
            <Text style={styles.launcherIcon}>{shopEmoji}</Text>
            <Text style={styles.launcherHeading}>GardenShop</Text>
          </Pressable>
          <Pressable
            style={[styles.launcherCard, isLandscape && styles.launcherCardLandscape]}
            onPress={() => handleOpenSheet('inventory')}
            accessibilityLabel="Open your inventory">
            <Text style={styles.launcherIcon}>{inventoryEmoji}</Text>
            <Text style={styles.launcherHeading}>Inventory</Text>
          </Pressable>
        </View>

        <View style={styles.walletContainer}>
          <Text style={styles.walletTitle}>Emoji Wallet</Text>
          {walletEmojis.length > 0 ? (
            <View style={styles.walletGrid}>
              {Array.from({ length: 10 }, (_, index) => {
                const emoji = walletEmojis[index];
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.walletSlot,
                      emoji && selectedEmoji === emoji.id && styles.walletSlotActive,
                      !emoji && styles.walletSlotEmpty,
                    ]}
                    onPress={() => {
                      if (emoji) {
                        setSelectedEmoji(emoji.id);
                        setIsDrawingMode(false);
                      }
                    }}
                    disabled={!emoji}
                  >
                    {emoji && (
                      emoji.imageUrl ? (
                        <ExpoImage source={{ uri: emoji.imageUrl }} style={styles.walletEmojiImage} contentFit="contain" />
                      ) : !emoji.id.startsWith('custom-') ? (
                        <Text style={styles.walletEmoji}>{emoji.emoji}</Text>
                      ) : (
                        // For custom blends without imageUrl, show a subtle loading indicator
                        <View style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
                          <Text style={styles.walletEmoji}>✨</Text>
                        </View>
                      )
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.walletEmpty}>
              <Text style={styles.walletEmptyText}>Long press emojis in inventory to add them here</Text>
            </View>
          )}
        </View>

        <View style={styles.canvasContainer}>
          <Pressable
            ref={canvasRef}
            style={canvasStyle}
            onLayout={handleCanvasLayout}
            onPress={handleCanvasPress}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
            onTouchCancel={handleCanvasTouchEnd}>
            {stencilModeEnabled && cameraPermission?.granted ? (
              <View pointerEvents="none" style={styles.stencilLayer} accessibilityElementsHidden>
                <CameraView style={styles.stencilCamera} facing="back" />
              </View>
            ) : null}
            <View pointerEvents="box-none" style={styles.canvasContentLayer}>
              {stencilModeEnabled && cameraPermission?.granted && stencilReferenceUri ? (
                <GestureDetector gesture={stencilTransformGesture}>
                  <Animated.View
                    style={[
                      styles.stencilImageOverlay,
                      stencilViewportStyle,
                      { opacity: stencilOpacity },
                      stencilImageAnimatedStyle,
                    ]}
                  >
                    <Image source={{ uri: stencilReferenceUri }} style={styles.stencilImage} resizeMode="contain" />
                  </Animated.View>
                </GestureDetector>
              ) : null}
              <View pointerEvents="none" style={styles.drawingSurface}>
                {strokes.reduce<React.ReactElement[]>((acc, stroke) => {
                  acc.push(...renderStrokeSegments(stroke, stroke.id));
                  return acc;
                }, [])}
                {currentStroke ? renderStrokeSegments(currentStroke, `${currentStroke.id}-live`) : null}
              </View>
              {isDrawingMode && !penHiddenForSave ? (
                <View pointerEvents="none" style={styles.drawingModeBadge}>
                  <Text style={styles.drawingModeBadgeText}>Drawing mode</Text>
                </View>
              ) : null}
              {shouldShowCanvasEmptyState ? (
                <View pointerEvents="none" style={styles.canvasEmptyState}>
                  <Text style={styles.canvasEmptyTitle}>Tap the canvas to begin</Text>
                  <Text style={styles.canvasEmptyCopy}>
                    Selected emoji, photos, or text will appear where you tap. Adjust them later by dragging,
                    pinching, twisting, double tapping, swiping, or long pressing.
                  </Text>
                </View>
              ) : null}
              {placements.map((placement) => {
                if (placement.kind === 'emoji') {
                  const emoji = emojiCatalog.find((item) => item.id === placement.emojiId);

                  if (!emoji) {
                    return null;
                  }

                  return (
                    <DraggablePlacement
                      key={placement.id}
                      placement={placement}
                      baseSize={EMOJI_SIZE}
                      onUpdate={(updates) => updatePlacement(placement.id, updates)}
                      onDragBegin={handlePlacementDragBegin}
                      onDragMove={handlePlacementDragMove}
                      onDragEnd={handlePlacementDragEnd}
                      onGestureActivated={handlePlacementGesture}
                    >
                      {emoji.imageUrl ? (
                        <ExpoImage source={{ uri: emoji.imageUrl }} style={styles.canvasEmojiImage} contentFit="contain" />
                      ) : (
                        <Text style={styles.canvasEmojiGlyph}>{emoji.emoji}</Text>
                      )}
                    </DraggablePlacement>
                  );
                }

                if (placement.kind === 'photo') {
                  return (
                    <DraggablePlacement
                      key={placement.id}
                      placement={placement}
                      baseSize={PHOTO_BASE_SIZE}
                      onUpdate={(updates) => updatePlacement(placement.id, updates)}
                      onDragBegin={handlePlacementDragBegin}
                      onDragMove={handlePlacementDragMove}
                      onDragEnd={handlePlacementDragEnd}
                      onGestureActivated={handlePlacementGesture}
                    >
                      <View style={styles.canvasPhotoFrame}>
                        <Image source={{ uri: placement.imageUri }} style={styles.canvasPhotoImage} />
                      </View>
                    </DraggablePlacement>
                  );
                }

                return (
                  <DraggablePlacement
                    key={placement.id}
                    placement={placement}
                    baseSize={TEXT_BASE_SIZE}
                    onUpdate={(updates) => updatePlacement(placement.id, updates)}
                    onDragBegin={handlePlacementDragBegin}
                    onDragMove={handlePlacementDragMove}
                    onDragEnd={handlePlacementDragEnd}
                    onGestureActivated={handlePlacementGesture}
                  >
                    <Text
                      style={[
                        styles.canvasText,
                        TEXT_STYLE_MAP[placement.style ?? 'sprout'],
                        { color: placement.color ?? DEFAULT_TEXT_COLOR },
                      ]}
                    >
                      {placement.text}
                    </Text>
                  </DraggablePlacement>
                );
              })}
              {!penHiddenForSave ? (
                <Pressable
                  style={styles.penButton}
                  accessibilityLabel={
                    deleteZoneVisible ? 'Trash can drop zone' : 'Open drawing palette'
                  }
                  accessibilityHint={
                    deleteZoneVisible
                      ? 'Drag an item here to delete it from the garden.'
                      : 'Opens options to pick colors and stroke sizes. Long press to exit drawing mode.'
                  }
                  onPress={() => {
                    if (deleteZoneVisible) {
                      return;
                    }

                    setShowExtendedPalette(false);
                    setShowPalette(true);
                  }}
                  onLongPress={() => {
                    if (deleteZoneVisible) {
                      return;
                    }
                    setIsDrawingMode(false);
                  }}
                  disabled={deleteZoneVisible}
                  onLayout={({ nativeEvent }) => setPenButtonLayout(nativeEvent.layout)}
                >
                  <View
                    style={[
                      styles.penButtonCircle,
                      isDrawingMode && !deleteZoneVisible && styles.penButtonCircleActive,
                      deleteZoneVisible && styles.penButtonCircleDelete,
                      shouldHighlightDeleteZone && styles.penButtonCircleDeleteActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.penButtonIcon,
                        isDrawingMode && !deleteZoneVisible && styles.penButtonIconActive,
                        deleteZoneVisible && styles.penButtonIconDelete,
                        shouldHighlightDeleteZone && styles.penButtonIconDeleteActive,
                      ]}
                    >
                      {deleteZoneVisible ? '🗑️' : '✏️'}
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              </View>
            </Pressable>

        <View style={styles.canvasActions}>
          <Pressable
            style={[styles.primaryButton, styles.clearButton, !canClearGarden && styles.clearButtonDisabled]}
            disabled={!canClearGarden}
            onPress={handleClearGarden}>
            <Text style={styles.primaryText}>Clear Garden</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, isSavingSnapshot && styles.primaryButtonDisabled]}
              onPress={handleSaveSnapshot}
              disabled={isSavingSnapshot}>
              <Text style={styles.primaryText}>{isSavingSnapshot ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={showPalette}
        animationType={isLandscape ? "fade" : "slide"}
        transparent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setShowPalette(false)}
      >
        <View style={[styles.paletteOverlay, isLandscape && styles.paletteOverlayLandscape]}>
          <Pressable style={styles.paletteBackdrop} onPress={() => setShowPalette(false)} />
          <View
            style={[
              styles.paletteCard,
              { maxHeight: paletteMaxHeight, paddingBottom: palettePaddingBottom },
              isLandscape && styles.paletteCardLandscape,
              isLandscape && { paddingLeft: insets.left, paddingRight: insets.right },
            ]}
          >
            <View style={styles.paletteHandle} />
            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.paletteTitle}>Garden Studio</Text>
                <Text style={styles.paletteSubtitle}>
                  Tune your pen, lettering, and photo charms without leaving the garden.
                </Text>
              </View>
              {isLandscape && (
                <Pressable
                  style={styles.sheetCloseXButton}
                  onPress={() => setShowPalette(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close garden studio"
                >
                  <Text style={styles.sheetCloseXText}>❌</Text>
                </Pressable>
              )}
            </View>
            <ScrollView
              style={styles.paletteScroll}
              contentContainerStyle={styles.paletteScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.paletteSection}>
                <Text style={styles.paletteLabel}>Pen &amp; color</Text>
                <View style={styles.paletteColorRow}>
                  {QUICK_DRAW_COLORS.map((color) => {
                    const isActive = penColor === color;
                    return (
                      <Pressable
                        key={color}
                        style={[styles.colorSwatch, { backgroundColor: color }, isActive && styles.colorSwatchActive]}
                        onPress={() => handleSelectPenColor(color)}
                        accessibilityLabel={`Set pen color to ${color}`}
                      />
                    );
                  })}
                  <Pressable
                    key="eraser"
                    style={[styles.eraserSwatch, penColor === ERASER_COLOR && styles.colorSwatchActive]}
                    onPress={() => handleSelectPenColor(ERASER_COLOR)}
                    accessibilityLabel="Use eraser"
                  >
                    <Text style={styles.eraserIcon}>🧽</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.colorWheelButton, showExtendedPalette && styles.colorWheelButtonActive]}
                    onPress={() => {
                      setShowExtendedPalette((prev) => !prev);
                      setShowBrushPalette(false);
                    }}
                    accessibilityLabel={showExtendedPalette ? 'Hide color wheel' : 'Show color wheel'}
                  >
                    <Text style={styles.colorWheelIcon}>🎨</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.colorWheelButton, showBrushPalette && styles.colorWheelButtonActive]}
                    onPress={() => {
                      setShowBrushPalette((prev) => !prev);
                      setShowExtendedPalette(false);
                    }}
                    accessibilityLabel={showBrushPalette ? 'Hide brush styles' : 'Show brush styles'}
                  >
                    <Text style={styles.colorWheelIcon}>🖌️</Text>
                  </Pressable>
                </View>
                {showExtendedPalette ? (
                  <View style={styles.colorWheelWrap}>
                    <View style={styles.colorWheelPanel}>
                      <View style={styles.colorWheelColumn}>
                        <View style={styles.colorWheel}>
                          {colorWheelPositions.map(({ color, left, top }) => {
                            const isActive = penColor === color;
                            return (
                              <Pressable
                                key={color}
                                style={[
                                  styles.colorWheelSwatch,
                                  { backgroundColor: color, left, top },
                                  isActive && styles.colorWheelSwatchActive,
                                ]}
                                onPress={() => handleSelectPenColor(color)}
                                accessibilityLabel={`Set pen color to ${color}`}
                              />
                            );
                          })}
                          <Pressable
                            style={styles.colorWheelClose}
                            onPress={() => setShowExtendedPalette(false)}
                            accessibilityLabel="Collapse color wheel"
                          >
                            <Text style={styles.colorWheelCloseText}>Close</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}
                {showBrushPalette ? (
                  <View style={styles.brushStyleWrap}>
                    <View style={styles.brushStyleHeaderRow}>
                      <Text style={styles.brushStyleTitle}>Brush stroke</Text>
                      <Text style={styles.brushStyleSubtitle}>Pick a stroke personality with emoji flair.</Text>
                    </View>
                    <View style={styles.brushStyleGrid}>
                      {BRUSH_STYLE_OPTIONS.map((option) => {
                        const isActive = option.id === strokeStyle;
                        const previewColor = penColor === ERASER_COLOR ? '#cbd5e1' : applyAlpha(penColor, option.opacity);
                        return (
                          <Pressable
                            key={option.id}
                            style={[styles.brushStyleChip, isActive && styles.brushStyleChipActive]}
                            onPress={() => handleSelectStrokeStyle(option.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${option.label} brush style`}
                            accessibilityState={{ selected: isActive }}
                          >
                            <View style={styles.brushStyleChipHeader}>
                              <View style={styles.brushStyleIconBubble}>
                                <Text style={styles.brushStyleEmoji}>{option.icon}</Text>
                              </View>
                              <Text style={styles.brushStyleChipLabel}>{option.label}</Text>
                            </View>
                            <View style={styles.brushPreviewRow}>
                              <Text style={styles.brushPreviewEmoji}>{option.icon}</Text>
                              <View
                                style={[
                                  styles.brushPreviewStroke,
                                  {
                                    backgroundColor: previewColor,
                                    shadowColor: penColor === ERASER_COLOR ? '#94a3b8' : penColor,
                                  },
                                ]}
                              />
                              <Text style={styles.brushPreviewEmoji}>✨</Text>
                            </View>
                            <Text style={styles.brushStyleChipHelper}>{option.helper}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
              <View style={styles.paletteSection}>
                <Text style={styles.paletteLabel}>Pen size</Text>
                <View style={styles.paletteSizeRow}>
                  {PEN_SIZES.map((size) => (
                    <Pressable
                      key={size}
                      style={[styles.sizeOption, penSize === size && styles.sizeOptionActive]}
                      onPress={() => setPenSize(size)}
                      accessibilityLabel={`Set pen size to ${size} pixels`}>
                      <View
                        style={[
                          styles.sizeOptionPreview,
                          {
                            width: size * 2,
                            height: size * 2,
                            borderRadius: size,
                            backgroundColor: penColor === ERASER_COLOR ? '#f1f5f9' : penColor,
                            borderColor: penColor === ERASER_COLOR ? '#94a3b8' : 'transparent',
                          },
                        ]}
                      />
                      <Text style={styles.sizeOptionLabel}>{size}px</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.paletteSection}>
                <Text style={styles.paletteLabel}>Sketchbook extras</Text>
                <Pressable
                  style={[styles.additionCard, isPickingPhoto && styles.additionCardDisabled]}
                  onPress={handleAddPhoto}
                  disabled={isPickingPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo decoration"
                >
                  <View style={[styles.additionCircle, isPickingPhoto && styles.additionCircleDisabled]}>
                    <Text style={styles.additionCircleIcon}>🖼️</Text>
                  </View>
                  <View style={styles.additionBody}>
                    <Text style={styles.additionTitle}>Photo charm</Text>
                    <Text style={styles.additionCopy}>
                      Drop a photo from your library onto the canvas.
                    </Text>
                  </View>
                </Pressable>
                <View
                  style={[
                    styles.stencilCard,
                    !shouldShowStencilDetails && styles.stencilCardCollapsed,
                  ]}
                >
                  <View style={styles.stencilHeader}>
                    <View style={styles.stencilIconBubble}>
                      <Text style={styles.stencilIcon}>🎨</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stencilTitle}>Stencil mode</Text>
                      <Text style={styles.stencilCopy}>
                        Superimpose your reference photo over the live camera to trace details on the canvas.
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.stencilToggle, stencilModeEnabled && styles.stencilToggleActive]}
                      onPress={handleToggleStencilMode}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: stencilModeEnabled }}
                      accessibilityLabel="Toggle stencil mode"
                    >
                      <View
                        style={[styles.stencilToggleKnob, stencilModeEnabled && styles.stencilToggleKnobActive]}
                      />
                    </Pressable>
                  </View>
                  {shouldShowStencilDetails ? (
                    <View style={styles.stencilBody}>
                      <View style={styles.stencilPreviewRow}>
                        <View style={styles.stencilPreviewFrame}>
                          {stencilReferenceUri ? (
                            <Image source={{ uri: stencilReferenceUri }} style={styles.stencilPreviewImage} />
                          ) : (
                            <Text style={styles.stencilPreviewPlaceholder}>Pick a reference photo</Text>
                          )}
                        </View>
                        <View style={styles.stencilActions}>
                          <Pressable
                            style={[styles.stencilButton, isPickingStencilReference && styles.stencilButtonDisabled]}
                            onPress={handlePickStencilReference}
                            disabled={isPickingStencilReference}
                            accessibilityRole="button"
                            accessibilityLabel="Choose stencil reference photo"
                          >
                            <Text style={styles.stencilButtonText}>
                              {stencilReferenceUri ? 'Replace photo' : 'Choose photo'}
                            </Text>
                          </Pressable>
                          {stencilModeEnabled ? (
                            <View style={styles.stencilOpacityRow}>
                              <Text style={styles.stencilOpacityLabel}>Opacity</Text>
                              <View style={styles.stencilOpacityControls}>
                                <Pressable
                                  style={styles.stencilOpacityPill}
                                  onPress={() => handleAdjustStencilOpacity(-0.1)}
                                  accessibilityLabel="Lower stencil opacity"
                                >
                                  <Text style={styles.stencilOpacityText}>-</Text>
                                </Pressable>
                                <View style={styles.stencilOpacityValue}>
                                  <Text style={styles.stencilOpacityValueText}>{Math.round(stencilOpacity * 100)}%</Text>
                                </View>
                                <Pressable
                                  style={styles.stencilOpacityPill}
                                  onPress={() => handleAdjustStencilOpacity(0.1)}
                                  accessibilityLabel="Increase stencil opacity"
                                >
                                  <Text style={styles.stencilOpacityText}>+</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.stencilHelperText}>
                        Turn on stencil mode to fade your reference over the camera feed while you arrange items on the canvas.
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.stencilCollapsedHelper}>
                      Toggle stencil mode to pick a reference and float it over the camera feed.
                    </Text>
                  )}
                </View>
                <View style={styles.textComposer}>
                  <Pressable
                    style={[
                      styles.fontPickerButton,
                      isFontDropdownOpen && styles.fontPickerButtonActive,
                    ]}
                    onPress={() => setFontDropdownOpen((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel="Choose text style"
                    accessibilityState={{ expanded: isFontDropdownOpen }}
                  >
                    <View style={styles.fontPickerIconBubble}>
                      <Text style={styles.fontPickerIcon}>🔠</Text>
                    </View>
                    <View style={styles.fontPickerBody}>
                      <Text style={styles.fontPickerTitle}>Text style</Text>
                      <Text style={styles.fontPickerSubtitle} numberOfLines={1}>
                        {selectedTextStyleOption.label}
                      </Text>
                      <Text
                        style={[selectedTextStyleOption.textStyle, styles.fontPickerPreview]}
                        numberOfLines={1}
                      >
                        {selectedTextStyleOption.preview}
                      </Text>
                    </View>
                    <Text style={styles.fontPickerCaret}>{isFontDropdownOpen ? '▴' : '▾'}</Text>
                  </Pressable>
                  {isFontDropdownOpen ? (
                    <View style={styles.fontDropdownMenu}>
                      {TEXT_STYLE_OPTIONS.map((option) => {
                        const isActive = option.id === selectedTextStyle;
                        return (
                          <Pressable
                            key={option.id}
                            style={[
                              styles.fontOption,
                              styles.fontDropdownOption,
                              isActive && styles.fontOptionActive,
                            ]}
                            onPress={() => {
                              setSelectedTextStyle(option.id);
                              setFontDropdownOpen(false);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`${option.label} text style`}
                          >
                            <Text
                              style={[option.textStyle, styles.fontOptionPreview]}
                              numberOfLines={1}
                            >
                              {option.preview}
                            </Text>
                            <Text
                              style={[styles.fontOptionLabel, isActive && styles.fontOptionLabelActive]}
                              numberOfLines={1}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  <TextInput
                    style={styles.textComposerInput}
                    value={textDraft}
                    onChangeText={handleTextInputChange}
                    placeholder="Write a garden note"
                    placeholderTextColor="#4a5568"
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                    onSubmitEditing={handleAddText}
                  />
                  <Pressable
                    style={[
                      styles.textComposerButton,
                      textDraft.trim().length === 0 && styles.textComposerButtonDisabled,
                    ]}
                    onPress={handleAddText}
                    disabled={textDraft.trim().length === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Add a text decoration"
                  >
                    <Text
                      style={[
                        styles.textComposerButtonText,
                        textDraft.trim().length === 0 && styles.textComposerButtonTextDisabled,
                      ]}
                    >
                      Add text
                    </Text>
                  </Pressable>
                  <Text style={styles.textComposerHint}>
                    Uses the active pen color for the text fill. Drag corners to resize, rotate, or move your text.
                  </Text>
                </View>
              </View>
            </ScrollView>
            <Pressable
              style={styles.paletteCloseButton}
              onPress={() => setShowPalette(false)}
              accessibilityLabel="Close drawing palette">
              <Text style={styles.paletteCloseButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      <Modal
        visible={activeSheet === 'shop'}
        animationType={isLandscape ? "fade" : "slide"}
        transparent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={handleCloseSheet}
      >
        <View style={[styles.sheetOverlay, isLandscape && styles.sheetOverlayLandscape]}>
          <Pressable style={styles.sheetBackdrop} onPress={handleCloseSheet} />
          <View style={[styles.sheetCard, isLandscape && styles.sheetCardLandscape]}>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 16 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>Garden shop</Text>
                <View style={styles.sheetHeaderButtons}>
                  <Pressable
                    style={styles.sheetEmojiButton}
                    onPress={() =>
                      setActiveEmojiPicker((prev) => (prev === 'shop' ? null : 'shop'))
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Change Garden shop icon"
                  >
                    <Text style={styles.sheetHeaderEmoji}>{shopEmoji}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sheetCloseXButton}
                    onPress={handleCloseSheet}
                    accessibilityRole="button"
                    accessibilityLabel="Close garden shop"
                  >
                    <Text style={styles.sheetCloseXText}>❌</Text>
                  </Pressable>
                </View>
              </View>
              {activeEmojiPicker === 'shop' ? (
                <View style={styles.sheetEmojiChooser}>
                  {SHOP_EMOJI_CHOICES.map((emoji) => {
                    const isActive = shopEmoji === emoji;
                    return (
                      <Pressable
                        key={emoji}
                        style={[styles.sheetEmojiOption, isActive && styles.sheetEmojiOptionActive]}
                        onPress={() => {
                          setShopEmoji(emoji);
                          setActiveEmojiPicker(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={`Use ${emoji} for GardenShop`}
                      >
                        <Text
                          style={[styles.sheetEmojiOptionText, isActive && styles.sheetEmojiOptionTextActive]}
                        >
                          {emoji}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            <View style={styles.sheetSearchBlock}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search or paste emoji"
                  placeholderTextColor="#4a5568"
                  value={shopFilter}
                  onChangeText={setShopFilter}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {shopFilter.length > 0 ? (
                  <Pressable
                    accessibilityLabel="Clear emoji search"
                    style={styles.clearSearchButton}
                    onPress={() => setShopFilter('')}>
                    <Text style={styles.clearSearchText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Price</Text>
                <Pressable
                  style={styles.sortToggle}
                  onPress={togglePriceSortOrder}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle price sorting"
                  accessibilityValue={{
                    text: priceSortOrder === 'asc' ? 'Low to high' : 'High to low',
                  }}
                >
                  <Text style={styles.sortIcon}>{priceSortOrder === 'asc' ? '↑' : '↓'}</Text>
                  <Text style={styles.sortToggleText}>
                    {priceSortOrder === 'asc' ? 'Low to high' : 'High to low'}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.categoryFilterBlock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFilterContent}
              >
                {CATEGORY_OPTIONS.map((option) => {
                  const isActive = option.id === activeCategory;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                      onPress={() => handleChangeCategory(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Filter ${option.label}`}>
                      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                        {`${option.icon} ${option.label}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {activeCategory === 'custom' && (
              <View style={styles.customBlendCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customBlendTitle}>Create with Emoji Kitchen</Text>
                    {!hasPremiumUpgrade && (
                      <Text style={{ fontSize: 12, color: freeBlendsUsed >= 5 ? '#ef4444' : '#64748b', marginTop: 4 }}>
                        {freeBlendsUsed < 5 
                          ? `${5 - freeBlendsUsed} free blend${5 - freeBlendsUsed === 1 ? '' : 's'} remaining (under 100K clicks)`
                          : 'Free blend limit reached. Upgrade for unlimited blends.'}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={handleRandomizeBlend} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 24 }}>🎲</Text>
                  </Pressable>
                </View>
                <Text style={styles.customBlendCopy}>
                  Pick two emoji to blend into a brand-new garden decoration.
                </Text>

                <>
                  <View style={styles.customBlendInputs}>
                      <View style={styles.customBlendInputContainer}>
                        <TextInput
                          style={[styles.customBlendInput, { color: '#0f172a' }]}
                          value={customEmojiLeft}
                          onChangeText={(value) => {
                            // Only allow emoji (no letters or numbers)
                            const emojiOnly = value.replace(/[^\p{Extended_Pictographic}\u200d\uFE0E\uFE0F]/gu, '');
                            setCustomEmojiLeft(emojiOnly.trim());
                          }}
                          maxLength={6}
                          placeholder=""
                          accessibilityLabel="First emoji for Emoji Kitchen"
                        />
                        <View style={styles.customBlendSeparator} />
                        <Pressable onPress={() => handleShuffleSingle('left')} style={styles.shuffleButton}>
                          <Text style={styles.shuffleButtonText}>🔀</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.customBlendPlus}>+</Text>

                      <View style={styles.customBlendInputContainer}>
                        <TextInput
                          style={[styles.customBlendInput, { color: '#0f172a' }]}
                          value={customEmojiRight}
                          onChangeText={(value) => {
                            // Only allow emoji (no letters or numbers)
                            const emojiOnly = value.replace(/[^\p{Extended_Pictographic}\u200d\uFE0E\uFE0F]/gu, '');
                            setCustomEmojiRight(emojiOnly.trim());
                          }}
                          maxLength={6}
                          placeholder=""
                          accessibilityLabel="Second emoji for Emoji Kitchen"
                        />
                        <View style={styles.customBlendSeparator} />
                        <Pressable onPress={() => handleShuffleSingle('right')} style={styles.shuffleButton}>
                          <Text style={styles.shuffleButtonText}>🔀</Text>
                        </Pressable>
                      </View>
                    </View>

                    {customBlendError ? <Text style={styles.customBlendError}>{customBlendError}</Text> : null}
                    
                    {/* Show paywall immediately if limit reached */}
                    {!hasPremiumUpgrade && freeBlendsUsed >= 5 ? (
                      <View style={styles.customBlendUpsell}>
                        <Text style={styles.customBlendUpsellTitle}>Free blend limit reached</Text>
                        <Text style={styles.customBlendUpsellCopy}>
                          You've used all 5 free blends! Upgrade to Premium for unlimited Emoji Kitchen mashups, premium accents, and special garden backgrounds.
                        </Text>
                        <Pressable style={styles.customBlendUpsellButton} onPress={purchasePremiumUpgrade}>
                          <Text style={styles.customBlendUpsellButtonText}>Upgrade to Premium</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        {/* Show blend preview and purchase options */}
                        {(() => {
                      const compositeEmoji = `${customEmojiLeft}${customEmojiRight}`;
                      const blendDefinition = emojiCatalog.find((e) => e.emoji === compositeEmoji && e.id.startsWith('custom-'));
                      const isOwned = blendDefinition && emojiInventory[blendDefinition.id];

                      // If loading and no preview yet, show loading state
                      if (isLoadingCustomBlend && !customBlendPreview) {
                        return (
                          <View style={styles.customBlendPreviewRow}>
                            <View style={[styles.customBlendImageContainer, { backgroundColor: '#f1f5f9' }]}>
                              <Text style={{ fontSize: 32 }}>⏳</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, color: '#0ea5e9', fontWeight: '600' }}>Blending...</Text>
                              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Creating your custom emoji</Text>
                            </View>
                          </View>
                        );
                      }

                      // If we have a preview and it's owned, show the owned card
                      if (customBlendPreview && isOwned && blendDefinition) {
                        return (
                          <View style={styles.emojiStatsContainer}>
                            <View style={styles.emojiStatsHeader}>
                              <Pressable onPress={() => {
                                // Flip animation could be added here if needed
                              }}>
                                <View style={styles.emojiStatsIconContainer}>
                                  <ExpoImage
                                    key={`${customEmojiLeft}-${customEmojiRight}-${customBlendPreview}`}
                                    source={{ uri: customBlendPreview }}
                                    style={styles.emojiStatsIconImage}
                                    contentFit="contain"
                                    cachePolicy="none"
                                    transition={200}
                                  />
                                </View>
                              </Pressable>
                              <View style={[styles.emojiStatsInfo, { flex: 1 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={[styles.emojiStatsName, { flex: 1 }]}>{blendDefinition.name}</Text>
                                  {hasPremiumUpgrade && !isEditingBlendName && (
                                    <Pressable 
                                      onPress={() => {
                                        setEditedBlendName(blendDefinition.name);
                                        setIsEditingBlendName(true);
                                      }}
                                      hitSlop={8}
                                    >
                                      <Text style={{ fontSize: 20 }}>✏️</Text>
                                    </Pressable>
                                  )}
                                </View>
                                {isEditingBlendName && (
                                  <View style={styles.editNameContainer}>
                                    <TextInput
                                      style={styles.editNameInput}
                                      value={editedBlendName}
                                      onChangeText={setEditedBlendName}
                                      placeholder="Enter custom name"
                                      maxLength={40}
                                      autoFocus
                                    />
                                    <View style={styles.editNameActions}>
                                      <Pressable 
                                        onPress={() => {
                                          if (editedBlendName.trim()) {
                                            setCustomEmojiName(blendDefinition.id, editedBlendName.trim());
                                          }
                                          setIsEditingBlendName(false);
                                        }}
                                        style={styles.editNameSaveButton}
                                      >
                                        <Text style={styles.editNameSaveText}>Save</Text>
                                      </Pressable>
                                      <Pressable 
                                        onPress={() => {
                                          setIsEditingBlendName(false);
                                          setEditedBlendName('');
                                        }}
                                        style={styles.editNameCancelButton}
                                      >
                                        <Text style={styles.editNameCancelText}>Cancel</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={styles.emojiStatsDetails}>
                              <Text style={styles.emojiStatsDescription}>{formatEmojiDescription(blendDefinition as any)}</Text>
                              <View style={styles.emojiStatsTags}>
                                {blendDefinition.tags.slice(0, 3).map((tag, index) => (
                                  <View key={index} style={styles.emojiStatsTag}>
                                    <Text style={styles.emojiStatsTagText}>#{tag}</Text>
                                  </View>
                                ))}
                              </View>
                              {gameContext?.emojiGameStats[blendDefinition.id]?.checkersGamesPlayed ? (
                                <View style={styles.emojiStatsGames}>
                                  <Text style={styles.emojiStatsGameLabel}>Checkers</Text>
                                  <View style={styles.emojiStatsGameRow}>
                                    <Text style={styles.emojiStatsGameValue}>{gameContext.emojiGameStats[blendDefinition.id].checkersWins || 0} wins</Text>
                                    <Text style={styles.emojiStatsGameValue}>{gameContext.emojiGameStats[blendDefinition.id].checkersGamesPlayed || 0} games</Text>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      }

                      // If we have a preview but it's not owned, show the purchase preview
                      if (customBlendPreview) {
                        return (
                          <View style={styles.customBlendPreviewRow}>
                            <View style={styles.customBlendImageContainer}>
                              <ExpoImage
                                key={`${customEmojiLeft}-${customEmojiRight}-${customBlendPreview}`}
                                source={{ uri: customBlendPreview }}
                                style={styles.customBlendImage}
                                contentFit="contain"
                                cachePolicy="none"
                                transition={200}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.customBlendName} numberOfLines={2}>
                                {customBlendDescription ? formatCustomEmojiName(customBlendDescription) : 'Emoji Kitchen blend'}
                              </Text>
                              <Text style={styles.customBlendPrice}>
                                Costs {formatClickValue(customBlendCost ?? computeKitchenEmojiCost(compositeEmoji))}{' '}
                                clicks
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      // Fallback: if no preview and not loading, show message
                      return (
                        <View style={styles.customBlendPreviewRow}>
                          <View style={[styles.customBlendImageContainer, { backgroundColor: '#f1f5f9' }]}>
                            <Text style={{ fontSize: 32 }}>🎨</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '600' }}>Ready to blend</Text>
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Adjust emojis above</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {(() => {
                      const compositeEmoji = `${customEmojiLeft}${customEmojiRight}`;
                      const blendDefinition = emojiCatalog.find((e) => e.emoji === compositeEmoji && e.id.startsWith('custom-'));
                      const isOwned = blendDefinition && emojiInventory[blendDefinition.id];

                      if (isOwned) return null;

                      return (
                        <Pressable
                          style={[
                            styles.customBlendPurchase,
                            (!customBlendPreview || isLoadingCustomBlend) && styles.customBlendButtonDisabled,
                          ]}
                          disabled={!customBlendPreview || isLoadingCustomBlend}
                          onPress={handlePurchaseCustomBlend}
                          accessibilityLabel="Purchase custom Emoji Kitchen blend"
                        >
                          <Text style={styles.customBlendPurchaseText}>
                            Purchase blend
                          </Text>
                        </Pressable>
                      );
                    })()}
                      </>
                    )}
                </>
              </View>
            )}

            <View style={[styles.sheetList, isLandscape && styles.sheetListLandscape, styles.sheetListContent, isLandscape && styles.sheetListContentLandscape]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {filteredShopInventory.map((item, index) => {
                  const isLastInRow = (index + 1) % responsiveGridColumns === 0 || index === filteredShopInventory.length - 1;
                  const currentRow = Math.floor(index / responsiveGridColumns);
                  const selectedRow = shopPreview ? Math.floor(filteredShopInventory.findIndex(i => i.id === shopPreview.id) / responsiveGridColumns) : -1;
                  const shouldShowPreviewAfter = shopPreview && !shopPreview.id.startsWith('custom-') && selectedRow === currentRow && isLastInRow;
                  
                  return (
                    <React.Fragment key={item.id}>
                      <View style={{ width: `${100 / responsiveGridColumns - 2}%` }}>
                        {renderShopItem({ item, index, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
                      </View>
                      {shouldShowPreviewAfter && (
                        <View style={{
                          width: '100%',
                          backgroundColor: '#f0f9ff',
                          borderWidth: 2,
                          borderColor: '#0ea5e9',
                          borderRadius: 12,
                          padding: 16,
                          marginVertical: 8,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{
                              width: 60,
                              height: 60,
                              borderRadius: 30,
                              backgroundColor: '#ffffff',
                              borderWidth: 2,
                              borderColor: shopPreview.owned ? '#16a34a' : '#f59e0b',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 12,
                            }}>
                              {shopPreview.imageUrl ? (
                                <ExpoImage
                                  source={{ uri: shopPreview.imageUrl }}
                                  style={styles.previewEmojiImage}
                                  contentFit="contain"
                                />
                              ) : (
                                <Text style={{ fontSize: 32 }}>{shopPreview.emoji}</Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>
                                {shopPreview.name}
                              </Text>
                              <Text style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>
                                {shopPreview.owned ? 'Owned' : `${formatClickValue(shopPreview.cost)} clicks`}
                              </Text>
                            </View>
                            <Pressable
                              style={{ padding: 8 }}
                              onPress={() => setShopPreview(null)}
                            >
                              <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
                            </Pressable>
                          </View>
                          
                          {shopPreview.tags.length > 0 && (
                            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                              {shopPreview.tags.slice(0, 3).join(' • ')}
                            </Text>
                          )}
                          
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            {!shopPreview.owned && (
                              <Pressable
                                style={{
                                  backgroundColor: '#16a34a',
                                  paddingHorizontal: 20,
                                  paddingVertical: 10,
                                  borderRadius: 8,
                                  flex: 1,
                                }}
                                onPress={() => {
                                  // Check if emoji exists in current catalog
                                  let definition = emojiCatalog.find(e => e.id === shopPreview.id || e.emoji === shopPreview.emoji);
                                  
                                  // If not found, register it now
                                  if (!definition && shopPreview.emoji) {
                                    const registered = registerCustomEmoji(shopPreview.emoji);
                                    if (registered) {
                                      definition = registered;
                                    }
                                  }
                                  
                                  // Purchase with the definition
                                  const success = definition 
                                    ? purchaseEmoji(definition.id)
                                    : purchaseEmoji(shopPreview.id);
                                    
                                  if (success) {
                                    setShopPreview(null);
                                  }
                                }}
                              >
                                <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                                  Buy for {formatClickValue(shopPreview.cost)}
                                </Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={{
                                backgroundColor: '#f3f4f6',
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: 8,
                                flex: shopPreview.owned ? 1 : 0,
                              }}
                              onPress={() => setShopPreview(null)}
                            >
                              <Text style={{ color: '#374151', fontWeight: '500', textAlign: 'center' }}>
                                {shopPreview.owned ? 'Close' : 'Cancel'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              {/* Scrolling placeholder removed - no test content */}
            </View>
              {filteredShopInventory.length === 0 && activeCategory !== 'custom' && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No emoji match your search</Text>
                  <Text style={styles.emptyStateCopy}>
                    Clear the search or try a different emoji keyword to keep shopping.
                  </Text>
                </View>
              )}
              <Pressable style={styles.sheetCloseButton} onPress={handleCloseSheet} accessibilityLabel="Close Garden shop">
                <Text style={styles.sheetCloseButtonText}>Done</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={activeSheet === 'inventory'}
        animationType={isLandscape ? "fade" : "slide"}
        transparent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={handleCloseSheet}
      >
        <View style={[styles.sheetOverlay, isLandscape && styles.sheetOverlayLandscape]}>
          <Pressable style={styles.sheetBackdrop} onPress={handleCloseSheet} />
          <View style={[styles.sheetCard, isLandscape && styles.sheetCardLandscape]}>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 16 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>Inventory</Text>
                <View style={styles.sheetHeaderButtons}>
                  <Pressable
                    style={styles.sheetEmojiButton}
                    onPress={() =>
                      setActiveEmojiPicker((prev) => (prev === 'inventory' ? null : 'inventory'))
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Change inventory icon"
                  >
                    <Text style={styles.sheetHeaderEmoji}>{inventoryEmoji}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sheetCloseXButton}
                    onPress={handleCloseSheet}
                    accessibilityRole="button"
                    accessibilityLabel="Close inventory"
                  >
                    <Text style={styles.sheetCloseXText}>❌</Text>
                  </Pressable>
                </View>
              </View>
            {activeEmojiPicker === 'inventory' ? (
              <View style={styles.sheetEmojiChooser}>
                {INVENTORY_EMOJI_CHOICES.map((emoji) => {
                  const isActive = inventoryEmoji === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      style={[styles.sheetEmojiOption, isActive && styles.sheetEmojiOptionActive]}
                      onPress={() => {
                        setInventoryEmoji(emoji);
                        setActiveEmojiPicker(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Use ${emoji} for inventory`}
                    >
                      <Text
                        style={[styles.sheetEmojiOptionText, isActive && styles.sheetEmojiOptionTextActive]}
                      >
                        {emoji}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.sheetSearchBlock}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search your inventory"
                  placeholderTextColor="#4a5568"
                  value={shopFilter}
                  onChangeText={setShopFilter}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {shopFilter.length > 0 ? (
                  <Pressable
                    accessibilityLabel="Clear inventory search"
                    style={styles.clearSearchButton}
                    onPress={() => setShopFilter('')}>
                    <Text style={styles.clearSearchText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {selectedInventoryEmoji && (
                  <View style={styles.emojiStatsContainer}>
                    <View style={styles.emojiStatsHeader}>
                      <Pressable onPress={handleInventoryEmojiIconFlip}>
                        <RNAnimated.View 
                          style={[
                            styles.emojiStatsIconContainer,
                            {
                              transform: [{ 
                                rotateY: inventoryFlipAnimation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '360deg'],
                                })
                              }],
                            },
                          ]}
                        >
                          {selectedInventoryEmoji.imageUrl ? (
                            <ExpoImage
                              source={{ uri: selectedInventoryEmoji.imageUrl }}
                              style={styles.emojiStatsIconImage}
                              contentFit="contain"
                            />
                          ) : (
                            <Text style={styles.emojiStatsIcon}>{selectedInventoryEmoji.emoji}</Text>
                          )}
                        </RNAnimated.View>
                      </Pressable>
                      <View style={[styles.emojiStatsInfo, { flex: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[styles.emojiStatsName, { flex: 1 }]}>{selectedInventoryEmoji.name}</Text>
                          {hasPremiumUpgrade && !isEditingInventoryName && (
                            <Pressable 
                              onPress={() => {
                                setEditedInventoryName(selectedInventoryEmoji.name);
                                setIsEditingInventoryName(true);
                              }}
                              hitSlop={8}
                            >
                              <Text style={{ fontSize: 20 }}>✏️</Text>
                            </Pressable>
                          )}
                        </View>
                        {isEditingInventoryName && (
                          <View style={styles.editNameContainer}>
                            <TextInput
                              style={styles.editNameInput}
                              value={editedInventoryName}
                              onChangeText={setEditedInventoryName}
                              placeholder="Enter custom name"
                              maxLength={40}
                              autoFocus
                            />
                            <View style={styles.editNameActions}>
                              <Pressable 
                                onPress={() => {
                                  if (editedInventoryName.trim()) {
                                    setCustomEmojiName(selectedInventoryEmoji.id, editedInventoryName.trim());
                                  }
                                  setIsEditingInventoryName(false);
                                }}
                                style={styles.editNameSaveButton}
                              >
                                <Text style={styles.editNameSaveText}>Save</Text>
                              </Pressable>
                              <Pressable 
                                onPress={() => {
                                  setIsEditingInventoryName(false);
                                  setEditedInventoryName('');
                                }}
                                style={styles.editNameCancelButton}
                              >
                                <Text style={styles.editNameCancelText}>Cancel</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.emojiStatsDetails}>
                      <Text style={styles.emojiStatsDescription}>{formatEmojiDescription(selectedInventoryEmoji)}</Text>
                      
                      {/* Purchase Cost */}
                      <View style={styles.emojiCostContainer}>
                        <Text style={styles.emojiCostLabel}>💰 Purchase Cost:</Text>
                        <Text style={styles.emojiCostValue}>{formatClickValue(selectedInventoryEmoji.cost)}</Text>
                      </View>
                      
                      <View style={styles.emojiStatsTags}>{selectedInventoryEmoji.tags.slice(0, 3).map((tag, index) => (
                          <View key={index} style={styles.emojiStatsTag}>
                            <Text style={styles.emojiStatsTagText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
              )}
            </View>
            <View style={styles.categoryFilterBlock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFilterContent}
              >
                {CATEGORY_OPTIONS.map((option) => {
                  const isActive = option.id === activeCategory;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                      onPress={() => handleChangeCategory(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Filter ${option.label}`}>
                      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                        {`${option.icon} ${option.label}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={[styles.sheetList, isLandscape && styles.sheetListLandscape, styles.sheetListContent, isLandscape && styles.sheetListContentLandscape]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {filteredOwnedInventory.map((item, index) => (
                  <View key={item.id} style={{ width: `${100 / responsiveGridColumns - 2}%` }}>
                    {renderInventoryItem({ item, index, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
                  </View>
                ))}
              </View>
              {filteredOwnedInventory.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>Inventory is empty</Text>
                  <Text style={styles.emptyStateCopy}>
                    Purchase decorations in the shop, then come back to place them.
                  </Text>
                </View>
              )}
            </View>
              <Pressable style={styles.sheetCloseButton} onPress={handleCloseSheet} accessibilityLabel="Close inventory">
                <Text style={styles.sheetCloseButtonText}>Done</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
      
      {shopPreview && (
        <ShopPreviewModal
          visible={true}
          item={shopPreview}
          harvest={harvest}
          hasPremiumUpgrade={hasPremiumUpgrade}
          onClose={handleDismissShopPreview}
          onPurchase={handlePurchaseShopPreview}
          onRename={setCustomEmojiName}
        />
      )}

    </Fragment>
  );
}

const EMOJI_SIZE = 64;
const PHOTO_BASE_SIZE = 150;
const TEXT_BASE_SIZE = 220;
const STENCIL_MIN_SCALE = 0.5;
const STENCIL_MAX_SCALE = 2.5;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

type InventoryTileItemProps = {
  item: InventoryEntry;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  categoryLabel: string;
  categoryIcon: string;
  canReorder: boolean;
  onSelect: (emojiId: string, owned: boolean) => void;
  onInventorySelect?: (item: InventoryEntry) => void;
  onInventoryLongPress?: (item: InventoryEntry) => void;
  isInWallet?: boolean;
  walletColor?: string;
  onLayout: (event: LayoutChangeEvent) => void;
  beginDrag: (emojiId: string, index: number) => void;
  updateDrag: (dx: number, dy: number) => void;
  endDrag: () => void;
  draggingIdRef: React.MutableRefObject<string | null>;
  shouldShake: boolean;
};

function InventoryTileItem({
  item,
  index,
  isSelected,
  isDragging,
  categoryLabel,
  categoryIcon,
  canReorder,
  onSelect,
  onInventorySelect,
  onInventoryLongPress,
  isInWallet,
  walletColor = '#f59e0b',
  onLayout,
  beginDrag,
  updateDrag,
  endDrag,
  draggingIdRef,
  shouldShake,
}: InventoryTileItemProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const wiggle = useSharedValue(0);
  const scale = useSharedValue(isDragging ? 1.05 : 1);

  useEffect(() => {
    scale.value = withTiming(isDragging ? 1.05 : 1, { duration: 120 });
  }, [isDragging, scale]);

  useEffect(() => {
    if (shouldShake) {
      wiggle.value = withRepeat(withSequence(withTiming(-2.5, { duration: 120 }), withTiming(2.5, { duration: 120 })), -1, true);
    } else {
      cancelAnimation(wiggle);
      wiggle.value = withTiming(0, { duration: 150 });
    }
  }, [shouldShake, wiggle]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${wiggle.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.sheetTileWrapper, animatedStyle]}>
      <Pressable
        onLayout={onLayout}
          style={[
            styles.shopTile,
            isSelected && styles.shopTilePressed,
            isDragging && styles.shopTilePressed,
            isInWallet && { borderColor: walletColor, borderWidth: 3 },
          ]}
          onPress={() => {
            if (draggingIdRef.current) {
              return;
            }
            // Use inventory select handler if available (for stats display)
            if (onInventorySelect) {
              onInventorySelect(item);
            } else {
              onSelect(item.id, item.owned);
            }
          }}
          onLongPress={() => {
            console.log('📱 Pressable long press fired for:', item.name);
            if (onInventoryLongPress) {
              onInventoryLongPress(item);
            }
          }}
          delayLongPress={Platform.OS === 'android' ? 350 : 400}
          accessibilityLabel={`${item.name} (${categoryLabel}) emoji`}
          accessibilityHint="Tap for stats, long press to add to wallet."
        >
          <View style={styles.shopTileAura}>
            <View style={styles.shopTileHalo} />
          <View style={[
            styles.shopTileCircle,
            isSelected && { borderColor: '#0f766e', backgroundColor: '#ecfdf3' }
          ]}>
              {item.imageUrl ? (
                <ExpoImage 
                  source={{ uri: item.imageUrl }} 
                  style={styles.shopTileEmojiImage}
                  contentFit="contain"
                />
              ) : !imageLoadFailed && !item.id.startsWith('custom-') ? (
                <Text style={styles.shopTileEmoji}>{item.emoji}</Text>
              ) : (
                // For custom blends without imageUrl, show a subtle loading indicator
                <View style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
                  <Text style={styles.shopTileEmoji}>✨</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

type DraggablePlacementProps = {
  placement: Placement;
  baseSize: number;
  onUpdate: (updates: Partial<Placement>) => void;
  children: ReactNode;
  onDragBegin?: (placementId: string, center: { x: number; y: number }) => void;
  onDragMove?: (placementId: string, center: { x: number; y: number }) => void;
  onDragEnd?: (placementId: string, center: { x: number; y: number }) => void;
  onLongPressChange?: (placementId: string, isActive: boolean) => void;
  onGestureActivated?: (placementId: string) => void;
};

function DraggablePlacement({
  placement,
  onUpdate,
  baseSize,
  children,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onLongPressChange,
  onGestureActivated,
}: DraggablePlacementProps) {
  const x = useSharedValue(placement.x);
  const y = useSharedValue(placement.y);
  const scale = useSharedValue(placement.scale ?? 1);
  const panStartX = useSharedValue(placement.x);
  const panStartY = useSharedValue(placement.y);
  const pinchStart = useSharedValue(placement.scale ?? 1);
  const rotation = useSharedValue(placement.rotation ?? 0);
  const rotationStart = useSharedValue(placement.rotation ?? 0);

  useEffect(() => {
    x.value = placement.x;
    y.value = placement.y;
    scale.value = placement.scale ?? 1;
    rotation.value = placement.rotation ?? 0;
  }, [placement.rotation, placement.x, placement.y, placement.scale, rotation, scale, x, y]);

  const reportUpdate = () => {
    'worklet';
    const nextScale = Math.min(Math.max(scale.value, MIN_SCALE), MAX_SCALE);
    scale.value = nextScale;
    runOnJS(onUpdate)({ x: x.value, y: y.value, scale: nextScale, rotation: rotation.value });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panStartX.value = x.value;
      panStartY.value = y.value;
      if (onDragBegin) {
        runOnJS(onDragBegin)(placement.id, { x: x.value, y: y.value });
      }
    })
    .onChange((event) => {
      x.value = panStartX.value + event.translationX;
      y.value = panStartY.value + event.translationY;
      if (onDragMove) {
        runOnJS(onDragMove)(placement.id, { x: x.value, y: y.value });
      }
    })
    .onFinalize(() => {
      reportUpdate();
      if (onDragEnd) {
        runOnJS(onDragEnd)(placement.id, { x: x.value, y: y.value });
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStart.value = scale.value;
    })
    .onChange((event) => {
      const next = pinchStart.value * event.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(reportUpdate)
    .onFinalize(reportUpdate);

  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      rotationStart.value = rotation.value;
    })
    .onChange((event) => {
      rotation.value = rotationStart.value + (event.rotation * 180) / Math.PI;
    })
    .onEnd(reportUpdate)
    .onFinalize(reportUpdate);

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(220)
    .onBegin(() => {
      if (onGestureActivated) {
        runOnJS(onGestureActivated)(placement.id);
      }
    })
    .onEnd(() => {
      scale.value = Math.min(scale.value * 1.12, MAX_SCALE);
      reportUpdate();
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onBegin(() => {
      if (onGestureActivated) {
        runOnJS(onGestureActivated)(placement.id);
      }
    })
    .onEnd(() => {
      scale.value = Math.min(scale.value * 1.25, MAX_SCALE);
      reportUpdate();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      if (onGestureActivated) {
        runOnJS(onGestureActivated)(placement.id);
      }
      if (onLongPressChange) {
        runOnJS(onLongPressChange)(placement.id, true);
      }
    })
    .onEnd(() => {
      scale.value = Math.max(scale.value * 0.8, MIN_SCALE);
      reportUpdate();
    })
    .onFinalize(() => {
      if (onLongPressChange) {
        runOnJS(onLongPressChange)(placement.id, false);
      }
    });

  const tapGestures = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  const swipeUpGesture = Gesture.Fling()
    .direction(Directions.UP)
    .onEnd(() => {
      scale.value = Math.min(scale.value * 1.15, MAX_SCALE);
      reportUpdate();
    });

  const swipeDownGesture = Gesture.Fling()
    .direction(Directions.DOWN)
    .onEnd(() => {
      scale.value = Math.max(scale.value * 0.85, MIN_SCALE);
      reportUpdate();
    });

  const swipeLeftGesture = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      rotation.value = rotation.value - 15;
      reportUpdate();
    });

  const swipeRightGesture = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      rotation.value = rotation.value + 15;
      reportUpdate();
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture,
    tapGestures,
    longPressGesture,
    swipeUpGesture,
    swipeDownGesture,
    swipeLeftGesture,
    swipeRightGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    const clampedScale = Math.min(Math.max(scale.value, MIN_SCALE), MAX_SCALE);
    const halfSize = (baseSize * clampedScale) / 2;
    return {
      left: x.value - halfSize,
      top: y.value - halfSize,
      width: baseSize,
      height: baseSize,
      transform: [{ scale: clampedScale }, { rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.canvasItem, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContent: {
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 24,
  },
  harvestBanner: {
    backgroundColor: '#22543d',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    gap: 4,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  harvestDecorativeCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  harvestDecorativeCircle2: {
    position: 'absolute',
    bottom: -25,
    left: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  harvestDecorativeCircle3: {
    position: 'absolute',
    top: 20,
    left: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  harvestTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f0fff4',
    textAlign: 'center',
  },
  harvestAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c6f6d5',
    textAlign: 'center',
  },
  harvestHint: {
    color: '#e6fffa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  harvestBannerLandscape: {
    paddingVertical: 16,
    gap: 3,
  },
  harvestTitleLandscape: {
    fontSize: 24,
  },
  harvestAmountLandscape: {
    fontSize: 16,
  },
  harvestHintLandscape: {
    fontSize: 13,
    lineHeight: 18,
  },
  launcherRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  launcherCard: {
    flex: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
    minWidth: 160,
  },
  launcherRowLandscape: {
    gap: 8,
    paddingHorizontal: 20,
  },
  launcherCardLandscape: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 18,
    minWidth: 140,
  },
  launcherIcon: {
    fontSize: 44,
    textAlign: 'center',
  },
  launcherHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#134e32',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  clearSearchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#bbf7d0',
  },
  clearSearchText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532d',
  },
  collectionSummary: {
    marginTop: 12,
    backgroundColor: '#ecfdf3',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  collectionSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  collectionSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#134e32',
  },
  collectionSummaryHint: {
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 18,
  },
  emptyState: {
    width: '100%',
    backgroundColor: '#f0fff4',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22543d',
  },
  emptyStateCopy: {
    fontSize: 13,
    color: '#2d3748',
    textAlign: 'center',
    lineHeight: 18,
  },
  emojiTile: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  emojiTileSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf3',
    shadowColor: '#0f766e',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emojiTilePressed: {
    transform: [{ scale: 0.99 }],
  },
  emojiTileDragging: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  emojiTileLocked: {
    backgroundColor: '#f5d08a',
    borderColor: '#f59e0b',
    shadowColor: '#b45309',
  },
  emojiTileDisabled: {
    opacity: 0.65,
  },
  emojiBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  emojiBadgeLocked: {
    opacity: 0.9,
  },
  emojiBadgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  emojiBadgeGlowActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  emojiBadgeCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.25)',
    shadowColor: '#0f766e',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  emojiBadgeCoreSelected: {
    backgroundColor: '#ecfdf3',
    borderColor: 'rgba(21, 128, 61, 0.45)',
  },
  emojiBadgeCoreLocked: {
    backgroundColor: '#fef3c7',
    borderColor: 'rgba(245, 158, 11, 0.65)',
    shadowColor: '#b45309',
  },
  emojiBadgeSelected: {
    shadowColor: '#0f172a',
  },
  emojiGlyphLarge: {
    fontSize: 34,
  },
  emojiGlyphSelected: {
    transform: [{ scale: 1.05 }],
  },
  emojiGlyphLocked: {
    opacity: 0.7,
  },
  emojiTileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134e32',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 18,
    minHeight: 36,
    paddingHorizontal: 6,
    flexShrink: 1,
    letterSpacing: 0.25,
    textTransform: 'capitalize',
  },
  emojiTileFooter: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
  },
  emojiTileCostBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 118, 110, 0.12)',
  },
  emojiTileCostText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
    letterSpacing: 0.2,
  },
  emojiTileCategoryMarker: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  emojiTileCategoryMarkerText: {
    fontSize: 18,
  },
  emojiLockOverlay: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
  },
  emojiLockGlyph: {
    fontSize: 22,
  },
  canvasContainer: {
    gap: 16,
    width: '100%',
  },
  selectionStatus: {
    backgroundColor: '#e6fffa',
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: '#0f766e',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  selectionStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#134e32',
  },
  selectionStatusCopy: {
    fontSize: 13,
    color: '#2d3748',
    lineHeight: 19,
  },
  selectionStatusActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionStatusMeta: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '600',
  },
  stopPlacingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#0f766e',
  },
  stopPlacingText: {
    color: '#f0fff4',
    fontSize: 12,
    fontWeight: '700',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    minHeight: 360,
    position: 'relative',
    shadowColor: '#22543d',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  canvasContentLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  stencilLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  stencilCamera: {
    ...StyleSheet.absoluteFillObject,
  },
  stencilImageOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  stencilImage: {
    width: '100%',
    height: '100%',
  },
  drawingSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  drawingModeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(34, 84, 61, 0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  drawingModeBadgeText: {
    color: '#f0fff4',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  canvasEmptyState: {
    position: 'absolute',
    top: '32%',
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 6,
  },
  canvasEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134e32',
    textAlign: 'center',
  },
  canvasEmptyCopy: {
    fontSize: 13,
    color: '#2d3748',
    textAlign: 'center',
    lineHeight: 18,
  },
  canvasItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasEmojiGlyph: {
    fontSize: 58,
  },
  canvasEmojiImage: {
    width: 64,
    height: 64,
  },
  canvasPhotoFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(15, 118, 110, 0.35)',
    backgroundColor: '#ffffff',
  },
  canvasPhotoImage: {
    width: '100%',
    height: '100%',
  },
  canvasText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  penButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  penButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fff4',
    borderWidth: 2,
    borderColor: '#1f6f4a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#134e32',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  penButtonCircleActive: {
    backgroundColor: '#1f6f4a',
  },
  penButtonCircleDelete: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#dc2626',
  },
  penButtonCircleDeleteActive: {
    backgroundColor: '#dc2626',
    borderColor: '#7f1d1d',
  },
  penButtonIcon: {
    fontSize: 26,
    color: '#1f6f4a',
  },
  penButtonIconActive: {
    color: '#f0fff4',
  },
  penButtonIconDelete: {
    color: '#dc2626',
  },
  penButtonIconDeleteActive: {
    color: '#fef2f2',
  },
  strokeSegment: {
    position: 'absolute',
  },
  canvasActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#22543d',
    borderRadius: 14,
    paddingVertical: 12,
  },
  clearButton: {
    backgroundColor: '#dc2626',
  },
  clearButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  primaryText: {
    textAlign: 'center',
    color: '#f0fff4',
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 31, 23, 0.55)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Put backdrop behind content
  },
  sheetCard: {
    backgroundColor: '#f2f9f2',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    minHeight: '70%',
    width: '100%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#bbf7d0',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#134e32',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetEmojiButton: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#d1fae5',
  },
  sheetHeaderEmoji: {
    fontSize: 26,
  },
  sheetEmojiChooser: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 6,
  },
  sheetEmojiOption: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sheetEmojiOptionActive: {
    backgroundColor: '#22543d',
    borderColor: '#134e32',
  },
  sheetEmojiOptionText: {
    fontSize: 22,
  },
  sheetEmojiOptionTextActive: {
    color: '#f0fff4',
  },
  sheetEmojiCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sheetEmojiCloseText: {
    fontSize: 16,
  },
  sheetHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetCloseXButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseXText: {
    fontSize: 16,
  },
  sheetSearchBlock: {
    gap: 8,
  },
  sortRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#134e32',
  },
  sortIcon: {
    fontSize: 14,
    color: '#0f766e',
  },
  sheetColumn: {
    gap: 12,
    marginBottom: 12,
  },
  sheetList: {
    flex: 1, // Allow to grow
  },
  sheetListLandscape: {
    flex: 1, // Take all available space
  },
  sheetListContent: {
    paddingBottom: 24,
    paddingHorizontal: 4,
  },
  sheetListContentLandscape: {
    paddingBottom: 100, // Reasonable padding
    paddingHorizontal: 8,
    flexGrow: 1, // Allow content to grow
  },
  categoryFilterBlock: {
    marginTop: 4,
  },
  categoryFilterContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  categoryPillActive: {
    backgroundColor: '#22543d',
    borderColor: '#22543d',
    shadowColor: '#134e32',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  categoryPillText: {
    color: '#134e32',
    fontWeight: '600',
    fontSize: 12,
  },
  categoryPillTextActive: {
    color: '#f0fff4',
  },
  sheetTileWrapper: {
    flex: 1,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  shopTile: {
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.24)',
    shadowColor: 'rgba(15, 23, 42, 0.12)',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  shopTileLocked: {
    backgroundColor: '#fef9f5',
    borderColor: 'rgba(180, 83, 9, 0.28)',
  },
  shopTilePressed: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.2,
  },
  shopTileAura: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
  },
  shopTileHalo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(125, 211, 161, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.2)',
    shadowColor: 'rgba(21, 128, 61, 0.35)',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    position: 'absolute',
  },
  shopTileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#15803d',
    shadowColor: 'rgba(21, 128, 61, 0.25)',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  shopTileCircleLocked: {
    borderColor: '#b45309',
    shadowColor: 'rgba(180, 83, 9, 0.32)',
  },
  shopTileEmoji: {
    fontSize: 32,
  },
  shopTileEmojiImage: {
    width: 36,
    height: 36,
  },
  inventoryPriceTag: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inventoryPriceText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fbbf24',
  },
  customBlendCard: {
    backgroundColor: '#ecfeff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    marginHorizontal: 4,
    gap: 12,
  },
  customBlendTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  customBlendCopy: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  customBlendInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBlendInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingRight: 8,
  },
  customBlendInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
  },
  customBlendSeparator: {
    width: 1,
    height: '60%',
    backgroundColor: '#bae6fd',
    marginHorizontal: 4,
  },
  shuffleButton: {
    padding: 4,
  },
  shuffleButtonText: {
    fontSize: 18,
  },
  customBlendPlus: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  customBlendButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  customBlendButtonDisabled: {
    opacity: 0.5,
  },
  customBlendButtonText: {
    color: '#ecfeff',
    fontWeight: '700',
    fontSize: 15,
  },
  customBlendError: {
    color: '#b91c1c',
    fontSize: 13,
  },
  customBlendPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customBlendImageContainer: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  customBlendImage: {
    width: 78,
    height: 78,
  },
  customBlendName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  customBlendPrice: {
    fontSize: 14,
    color: '#0f172a',
  },
  customBlendPurchase: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  customBlendPurchaseText: {
    color: '#ecfdf3',
    fontWeight: '700',
    fontSize: 15,
  },
  customBlendUpsell: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#facc15',
    gap: 8,
  },
  customBlendUpsellTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#713f12',
  },
  customBlendUpsellCopy: {
    fontSize: 14,
    color: '#854d0e',
    lineHeight: 20,
  },
  customBlendUpsellButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  customBlendUpsellButtonText: {
    color: '#fefce8',
    fontWeight: '700',
  },
  sheetCloseButton: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#22543d',
  },
  sheetCloseButtonText: {
    textAlign: 'center',
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  paletteOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 31, 23, 0.55)',
    paddingBottom: 0,
    alignItems: 'stretch',
  },
  paletteBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  paletteCard: {
    backgroundColor: '#f8fffb',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 14,
    alignSelf: 'stretch',
    shadowColor: '#0f2e20',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
  },
  paletteHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#bbf7d0',
  },
  paletteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f5132',
    textAlign: 'left',
  },
  paletteSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#166534',
  },
  paletteScroll: {
    flexGrow: 0,
  },
  paletteScrollContent: {
    paddingBottom: 12,
    gap: 14,
  },
  paletteSection: {
    gap: 8,
  },
  paletteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#134e32',
  },
  paletteColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
  },
  colorSwatch: {
    width: COLOR_WHEEL_SWATCH_SIZE,
    height: COLOR_WHEEL_SWATCH_SIZE,
    borderRadius: COLOR_WHEEL_SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#1f6f4a',
    shadowColor: '#1f6f4a',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  eraserSwatch: {
    width: COLOR_WHEEL_SWATCH_SIZE,
    height: COLOR_WHEEL_SWATCH_SIZE,
    borderRadius: COLOR_WHEEL_SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eraserIcon: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: '700',
  },
  colorWheelButton: {
    width: COLOR_WHEEL_SWATCH_SIZE,
    height: COLOR_WHEEL_SWATCH_SIZE,
    borderRadius: COLOR_WHEEL_SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: '#1f6f4a',
    backgroundColor: '#fef9c3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#facc15',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  colorWheelButtonActive: {
    borderColor: '#0f766e',
    backgroundColor: '#fef3c7',
  },
  colorWheelIcon: {
    fontSize: 20,
  },
  colorWheelWrap: {
    marginTop: 16,
    alignItems: 'stretch',
  },
  colorWheelPanel: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  colorWheelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  colorWheel: {
    width: COLOR_WHEEL_DIAMETER,
    height: COLOR_WHEEL_DIAMETER,
    borderRadius: COLOR_WHEEL_DIAMETER / 2,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#d1d5db',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#0f2e20',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  colorWheelSwatch: {
    position: 'absolute',
    width: COLOR_WHEEL_SWATCH_SIZE,
    height: COLOR_WHEEL_SWATCH_SIZE,
    borderRadius: COLOR_WHEEL_SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorWheelSwatchActive: {
    borderColor: '#1f6f4a',
    shadowColor: '#1f6f4a',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  colorWheelClose: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorWheelCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  brushStyleWrap: {
    marginTop: 14,
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brushStyleHeaderRow: {
    gap: 4,
  },
  brushStyleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#134e32',
    letterSpacing: 0.3,
  },
  brushStyleSubtitle: {
    fontSize: 12,
    color: '#0f172a',
    opacity: 0.85,
  },
  brushStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  brushStyleChip: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fffb',
    gap: 8,
    flexGrow: 1,
    flexBasis: '48%',
  },
  brushStyleChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf3',
    shadowColor: '#0f766e',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  brushStyleChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brushStyleIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  brushStyleEmoji: {
    fontSize: 16,
  },
  brushStyleChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  brushPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brushPreviewEmoji: {
    fontSize: 15,
  },
  brushPreviewStroke: {
    flex: 1,
    height: 12,
    borderRadius: 16,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  brushStyleChipHelper: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  paletteSizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
  },
  sizeOptionActive: {
    borderColor: '#1f6f4a',
    backgroundColor: '#ecfdf3',
  },
  sizeOptionPreview: {
    borderRadius: 999,
    borderWidth: 2,
  },
  sizeOptionLabel: {
    fontSize: 12,
    color: '#134e32',
    fontWeight: '600',
  },
  additionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f8fffb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  additionCardDisabled: {
    opacity: 0.65,
  },
  additionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  additionCircleDisabled: {
    opacity: 0.6,
  },
  additionCircleIcon: {
    fontSize: 30,
  },
  additionBody: {
    flex: 1,
    gap: 4,
  },
  additionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14532d',
  },
  additionCopy: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  stencilCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stencilCardCollapsed: {
    paddingVertical: 12,
  },
  stencilHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stencilIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ecfdf3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stencilIcon: {
    fontSize: 22,
  },
  stencilTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#134e32',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stencilCopy: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  stencilCollapsedHelper: {
    marginTop: 8,
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  stencilToggle: {
    width: 56,
    height: 30,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    padding: 4,
    justifyContent: 'center',
  },
  stencilToggleActive: {
    backgroundColor: '#10b981',
    alignItems: 'flex-end',
  },
  stencilToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stencilToggleKnobActive: {
    backgroundColor: '#ecfdf3',
  },
  stencilBody: {
    gap: 12,
  },
  stencilPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stencilPreviewFrame: {
    width: 110,
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stencilPreviewImage: {
    width: '100%',
    height: '100%',
  },
  stencilPreviewPlaceholder: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  stencilActions: {
    flex: 1,
    gap: 10,
  },
  stencilButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
  },
  stencilButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  stencilButtonText: {
    color: '#ecfdf3',
    fontSize: 13,
    fontWeight: '700',
  },
  stencilOpacityRow: {
    gap: 8,
  },
  stencilOpacityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14532d',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stencilOpacityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stencilOpacityPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stencilOpacityText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f766e',
  },
  stencilOpacityValue: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#0f766e',
  },
  stencilOpacityValueText: {
    color: '#ecfdf3',
    fontSize: 13,
    fontWeight: '800',
  },
  stencilHelperText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  textComposer: {
    marginTop: 12,
    gap: 10,
  },
  fontPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fontPickerButtonActive: {
    borderColor: '#0f766e',
    shadowOpacity: 0.1,
    backgroundColor: '#f0fdfa',
  },
  fontPickerIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontPickerIcon: {
    fontSize: 22,
  },
  fontPickerBody: {
    flex: 1,
    gap: 2,
  },
  fontPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14532d',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fontPickerSubtitle: {
    fontSize: 12,
    color: '#166534',
  },
  fontPickerPreview: {
    fontSize: 16,
    color: '#134e32',
  },
  fontPickerCaret: {
    fontSize: 18,
    color: '#134e32',
  },
  fontDropdownMenu: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fontDropdownOption: {
    width: '100%',
  },
  textComposerInput: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#134e32',
    textAlignVertical: 'top',
  },
  textComposerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#15803d',
  },
  textComposerButtonDisabled: {
    backgroundColor: '#bbf7d0',
  },
  textComposerButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ecfdf5',
  },
  textComposerButtonTextDisabled: {
    color: '#166534',
  },
  fontOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  fontOptionActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fontOptionPreview: {
    fontSize: 20,
    color: '#134e32',
    textAlign: 'center',
  },
  fontOptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f5132',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fontOptionLabelActive: {
    color: '#0f766e',
  },
  textSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  textSizeGlyphSmall: {
    fontSize: 14,
    color: '#0f5132',
    fontWeight: '700',
  },
  textSizeGlyphLarge: {
    fontSize: 24,
    color: '#0f5132',
    fontWeight: '700',
  },
  textSizeSlider: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 118, 110, 0.12)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  textSizeSliderTrack: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 15,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 118, 110, 0.25)',
  },
  textSizeSliderFill: {
    position: 'absolute',
    left: 16,
    top: 15,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0f766e',
  },
  textSizeSliderThumb: {
    position: 'absolute',
    top: 5,
    width: TEXT_SLIDER_THUMB_SIZE,
    height: TEXT_SLIDER_THUMB_SIZE,
    borderRadius: TEXT_SLIDER_THUMB_SIZE / 2,
    backgroundColor: '#0f766e',
    shadowColor: '#0f766e',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  textSizeValuePill: {
    borderRadius: 14,
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  textSizeValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134e32',
  },
  textComposerHint: {
    fontSize: 12,
    color: '#1f2937',
  },
  paletteCloseButton: {
    backgroundColor: '#22543d',
    borderRadius: 16,
    paddingVertical: 12,
  },
  paletteCloseButtonText: {
    textAlign: 'center',
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  shopPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 1000,
  },
  shopPreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  shopPreviewCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    gap: 18,
    shadowColor: 'rgba(15, 23, 42, 0.35)',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
    zIndex: 1001,
  },
  shopPreviewAura: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopPreviewHalo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(187, 247, 208, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(22, 101, 52, 0.22)',
    shadowColor: 'rgba(21, 128, 61, 0.38)',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  shopPreviewCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#15803d',
    shadowColor: 'rgba(22, 101, 52, 0.32)',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  shopPreviewEmoji: {
    fontSize: 60,
  },
  shopPreviewTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14532d',
    textAlign: 'center',
  },
  shopPreviewDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#1f2937',
  },
  shopPreviewPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f5132',
  },
  shopPreviewUnicode: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shopPreviewActions: {
    alignSelf: 'stretch',
    gap: 12,
  },
  shopPreviewButton: {
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: '#1f6f4a',
    alignItems: 'center',
  },
  shopPreviewButtonDisabled: {
    backgroundColor: 'rgba(31, 111, 74, 0.35)',
  },
  shopPreviewButtonText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  shopPreviewSecondaryButton: {
    borderRadius: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.32)',
    alignItems: 'center',
    backgroundColor: '#ecfdf3',
  },
  shopPreviewSecondaryButtonText: {
    color: '#0f5132',
    fontWeight: '600',
    fontSize: 15,
  },
  previewEmojiImage: {
    width: 44,
    height: 44,
  },
  inventoryTileAura: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
  },
  inventoryTileHalo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(125, 211, 161, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.15)',
    shadowColor: 'rgba(21, 128, 61, 0.25)',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    position: 'absolute',
  },
  inventoryTileHaloSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    borderColor: 'rgba(22, 101, 52, 0.35)',
    shadowColor: 'rgba(21, 128, 61, 0.45)',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  inventoryTileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#15803d',
    shadowColor: 'rgba(21, 128, 61, 0.25)',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  inventoryTileCircleSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf3',
    shadowColor: 'rgba(15, 118, 110, 0.35)',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  inventoryTileEmoji: {
    fontSize: 32,
  },
  emojiStatsContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emojiStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  emojiStatsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: 'rgba(34, 197, 94, 0.2)',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emojiStatsIcon: {
    fontSize: 32,
  },
  emojiStatsIconImage: {
    width: 36,
    height: 36,
  },
  emojiStatsInfo: {
    flex: 1,
  },
  emojiStatsName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  emojiStatsCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emojiStatsDetails: {
    gap: 8,
  },
  emojiStatsDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emojiCostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  emojiCostLabel: {
    fontSize: 13,
    color: '#78350f',
    fontWeight: '600',
  },
  emojiCostValue: {
    fontSize: 15,
    color: '#92400e',
    fontWeight: '700',
  },
  emojiStatsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiStatsTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  emojiStatsTagText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  emojiStatsGames: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  emojiStatsGameLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  emojiStatsGameRow: {
    flexDirection: 'row',
    gap: 16,
  },
  emojiStatsGameValue: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  editNameContainer: {
    marginTop: 8,
    gap: 8,
  },
  editNameInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#0f172a',
  },
  editNameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editNameSaveButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editNameSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editNameCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editNameCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  walletContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  walletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'space-between',
  },
  walletSlot: {
    width: 52,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletSlotEmpty: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  walletSlotActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  walletEmoji: {
    fontSize: 24,
  },
  walletEmojiImage: {
    width: 28,
    height: 28,
  },
  walletEmpty: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  walletEmptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  walletHighlight: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // Landscape-specific styles for modals
  sheetOverlayLandscape: {
    // Layout properties moved to contentContainerStyle
  },
  sheetCardLandscape: {
    height: '100%', // Full screen height
    maxWidth: '100%', // Full screen width
    width: '100%',
    borderRadius: 0, // No rounded corners for full screen
    maxHeight: '100%',
    minHeight: '100%',
  },
  paletteCardLandscape: {
    maxWidth: '100%',
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  paletteOverlayLandscape: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  textSizeControlsLandscape: {
    gap: 12, // Slightly more spacing in landscape for better touch targets
  },
  textSizeSliderLandscape: {
    height: 40, // Larger touch target in landscape
    minHeight: 40,
  },
  textSizeSliderTrackLandscape: {
    top: 18, // Adjusted for 40px height (center: 20px - 2px track height/2)
  },
  textSizeSliderFillLandscape: {
    top: 18, // Matched with track position
  },
  textSizeSliderThumbLandscape: {
    top: 8, // Adjusted for 40px height (center: 20px - 12px thumb height/2)
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useGame } from '@/context/GameContext';

const PREMIUM_ACCENT_OPTIONS = ['#1f6f4a', '#047857', '#2563eb', '#a855f7', '#f97316', '#0ea5e9'];
const CLICK_EMOJI_CHOICES = ['🍁', '🍪', '🌺', '🌲', '🌴', '🍄', '🍀', '🍎', '🍏', '🖼️', '🗺️', '🪙', '🛎️', '🌵'] as const;
const BACKGROUND_WHEEL_COLORS = [
  '#f2f9f2',
  '#ffffff',
  '#e0f2fe',
  '#fef3c7',
  '#fde68a',
  '#e9d5ff',
  '#fce7f3',
  '#fee2e2',
  '#dcfce7',
  '#cffafe',
  '#e2e8f0',
  '#1f2937',
];
const BACKGROUND_WHEEL_DIAMETER = 200;
const BACKGROUND_WHEEL_RADIUS = 80;
const BACKGROUND_WHEEL_SWATCH_SIZE = 44;

type ProfileContentProps = {
  mode?: 'screen' | 'modal';
  onRequestClose?: () => void;
};

export function ProfileContent({ mode = 'screen', onRequestClose }: ProfileContentProps) {
  const {
    profileName,
    profileUsername,
    profileImageUri,
    profileLifetimeTotal,
    setProfileName,
    setProfileUsername,
    setProfileImageUri,
    hasPremiumUpgrade,
    premiumAccentColor,
    customClickEmoji,
    purchasePremiumUpgrade,
    setPremiumAccentColor,
    setCustomClickEmoji,
    gardenBackgroundColor,
    setGardenBackgroundColor,
    profilePhotoWidgetEnabled,
    setProfilePhotoWidgetEnabled,
    bedsideWidgetsEnabled,
    setBedsideWidgetsEnabled,
    rssFeeds,
    toggleRSSFeed,
    addCustomRSSFeed,
    removeRSSFeed,
    emojiCatalog,
    emojiInventory,
    registerCustomEmoji,
    resetGame,
  } = useGame();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [name, setName] = useState(profileName);
  const [username, setUsername] = useState(profileUsername);
  const [isSaving, setIsSaving] = useState(false);
  const [emojiInput, setEmojiInput] = useState(customClickEmoji);
  const [accentSelection, setAccentSelection] = useState(premiumAccentColor);
  const [showRSSFeeds, setShowRSSFeeds] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('News');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiInputRef = useRef<TextInput>(null);
  const displayName = useMemo(() => {
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : 'Gardener';
  }, [name]);

  useEffect(() => {
    setName(profileName);
  }, [profileName]);

  useEffect(() => {
    setUsername(profileUsername);
  }, [profileUsername]);

  useEffect(() => {
    setEmojiInput(customClickEmoji);
  }, [customClickEmoji]);

  useEffect(() => {
    setAccentSelection(premiumAccentColor);
  }, [premiumAccentColor]);

  const emojiOptions = useMemo(() => {
    const options: { id: string; emoji: string }[] = [];
    CLICK_EMOJI_CHOICES.forEach((glyph) => {
      const catalogEntry =
        emojiCatalog.find((entry) => entry.emoji === glyph) ?? registerCustomEmoji(glyph) ?? null;

      if (catalogEntry && !options.some((option) => option.id === catalogEntry.id)) {
        options.push(catalogEntry);
      }
    });
    return options;
  }, [CLICK_EMOJI_CHOICES, emojiCatalog]);
  const backgroundWheelPositions = useMemo(
    () =>
      BACKGROUND_WHEEL_COLORS.map((color, index) => {
        const angle = (index / BACKGROUND_WHEEL_COLORS.length) * 2 * Math.PI - Math.PI / 2;
        const center = BACKGROUND_WHEEL_DIAMETER / 2;
        const offset = BACKGROUND_WHEEL_SWATCH_SIZE / 2;
        const left = center + Math.cos(angle) * BACKGROUND_WHEEL_RADIUS - offset;
        const top = center + Math.sin(angle) * BACKGROUND_WHEEL_RADIUS - offset;
        return { color, left, top };
      }),
    []
  );

  const persistProfile = useCallback(() => {
    setIsSaving(true);
    setProfileName(name.trim());
    setProfileUsername(username.trim());
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(false);
      saveTimeoutRef.current = null;
    }, 320);
  }, [name, username, setProfileName, setProfileUsername]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    },
    []
  );

  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to choose a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setProfileImageUri(asset.uri);
        setProfilePhotoWidgetEnabled(true);
      }
    } catch {
      Alert.alert('Something went wrong', 'Unable to open the photo library right now.');
    }
  }, [setProfileImageUri, setProfilePhotoWidgetEnabled]);

  const handleRemoveImage = useCallback(() => {
    setProfileImageUri(null);
    setProfilePhotoWidgetEnabled(false);
  }, [setProfileImageUri, setProfilePhotoWidgetEnabled]);

  const handleUpgrade = useCallback(() => {
    if (hasPremiumUpgrade) {
      return;
    }

    Alert.alert(
      'Upgrade to Garden Plus',
      'Unlock custom emoji and accent colors for your clicker button and menu icon.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Upgrade', onPress: purchasePremiumUpgrade },
      ]
    );
  }, [hasPremiumUpgrade, purchasePremiumUpgrade]);

  const handleSelectAccent = useCallback(
    (color: string) => {
      if (!hasPremiumUpgrade) {
        Alert.alert('Upgrade required', 'Upgrade to choose custom accent colors.');
        return;
      }

      setAccentSelection(color);
      setPremiumAccentColor(color);
    },
    [hasPremiumUpgrade, setPremiumAccentColor]
  );

  const handleSelectBackgroundColor = useCallback(
    (color: string) => {
      setGardenBackgroundColor(color);
    },
    [setGardenBackgroundColor]
  );

  const handleResetBackground = useCallback(() => {
    setGardenBackgroundColor('#f2f9f2');
  }, [setGardenBackgroundColor]);

  const handleTogglePhotoWidget = useCallback(
    (value: boolean) => {
      setProfilePhotoWidgetEnabled(value);
    },
    [setProfilePhotoWidgetEnabled]
  );

  const handleToggleBedsideWidgets = useCallback(
    (value: boolean) => {
      setBedsideWidgetsEnabled(value);
    },
    [setBedsideWidgetsEnabled]
  );

  const handleToggleRSSFeed = useCallback(
    (feedId: string, enabled: boolean) => {
      toggleRSSFeed(feedId, enabled);
    },
    [toggleRSSFeed]
  );

  const handleAddCustomFeed = useCallback(() => {
    if (!newFeedName.trim() || !newFeedUrl.trim()) {
      Alert.alert('Missing Information', 'Please enter both feed name and URL.');
      return;
    }

    if (!newFeedUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    addCustomRSSFeed({
      name: newFeedName.trim(),
      url: newFeedUrl.trim(),
      category: newFeedCategory,
      enabled: true,
    });

    setNewFeedName('');
    setNewFeedUrl('');
    setNewFeedCategory('News');
    
    Alert.alert('Success', 'RSS feed added successfully!');
  }, [newFeedName, newFeedUrl, newFeedCategory, addCustomRSSFeed]);

  const handleRemoveFeed = useCallback(
    (feedId: string, feedName: string) => {
      Alert.alert(
        'Remove Feed',
        `Are you sure you want to remove "${feedName}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeRSSFeed(feedId),
          },
        ]
      );
    },
    [removeRSSFeed]
  );

  const applyEmojiSelection = useCallback(
    (value: string) => {
      if (!hasPremiumUpgrade) {
        Alert.alert('Upgrade required', 'Upgrade to change your click emoji.');
        return;
      }

      const trimmed = value.trim();

      if (trimmed.length === 0) {
        setEmojiInput('');
        return;
      }

      const glyph = Array.from(trimmed)[0];

      if (!glyph) {
        setEmojiInput('');
        return;
      }

      setEmojiInput(glyph);
      setCustomClickEmoji(glyph);
      registerCustomEmoji(glyph);
    },
    [hasPremiumUpgrade, registerCustomEmoji, setCustomClickEmoji]
  );

  const handleEmojiInputChange = useCallback(
    (value: string) => {
      applyEmojiSelection(value);
    },
    [applyEmojiSelection]
  );

  const handleChooseEmoji = useCallback(
    (emoji: string) => {
      if (!hasPremiumUpgrade) {
        Alert.alert('Upgrade required', 'Upgrade to change your click emoji.');
        return;
      }

      applyEmojiSelection(emoji);
    },
    [applyEmojiSelection, hasPremiumUpgrade]
  );

  const handleClose = useCallback(() => {
    if (onRequestClose) {
      onRequestClose();
    }
  }, [onRequestClose]);

  const handleSaveProfile = useCallback(() => {
    persistProfile();
    handleClose();
  }, [handleClose, persistProfile]);

  const styles = useMemo(() => createResponsiveStyles(isLandscape), [isLandscape]);
  
  const isModal = mode === 'modal';
  const closeAccessibilityLabel = isModal ? 'Close profile editor' : 'Go back';
  const closeLabel = isModal ? 'Back' : '← Back';
  const closeButtonStyle = isModal ? styles.modalBackButton : styles.backButton;
  const closeTextStyle = isModal ? styles.modalBackLabel : styles.backLabel;
  const containerStyle = useMemo(() => [styles.safeArea, { paddingTop: insets.top + 12 }], [insets.top, styles.safeArea]);
  const contentStyle = useMemo(
    () => [
      styles.content, 
      { 
        paddingBottom: 40 + insets.bottom,
        paddingLeft: isLandscape ? Math.max(insets.left + 16, 24) : 24,
        paddingRight: isLandscape ? Math.max(insets.right + 16, 24) : 24,
      }
    ],
    [insets.bottom, insets.left, insets.right, isLandscape, styles.content]
  );
  const widgetDisabled = !profileImageUri;
  const widgetValue = widgetDisabled ? false : profilePhotoWidgetEnabled;
  const widgetDescription = widgetDisabled
    ? 'Add a photo to sync it with quick actions and your profile preview.'
    : 'Keep your quick actions refreshed with your latest garden photo.';
  const widgetThumbColor =
    Platform.OS === 'android'
      ? widgetValue
        ? '#166534'
        : '#e2e8f0'
      : undefined;

  if (isModal) {
    return (
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.topBar}>
              <Pressable
                onPress={handleClose}
                style={closeButtonStyle}
                accessibilityLabel={closeAccessibilityLabel}
              >
                <Text style={closeTextStyle}>{closeLabel}</Text>
              </Pressable>
            </View>
            {/* ...existing modal content... */}
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Garden Plus customization</Text>
              {hasPremiumUpgrade ? (
                <>
                  <Text style={styles.upgradeCopy}>Choose an accent color for your click target.</Text>
                  <View style={styles.accentRow}>
                    {PREMIUM_ACCENT_OPTIONS.map((color) => {
                      const isActive = accentSelection === color;
                      return (
                        <Pressable
                          key={color}
                          style={[styles.accentSwatch, { backgroundColor: color }, isActive && styles.accentSwatchActive]}
                          onPress={() => handleSelectAccent(color)}
                          accessibilityLabel={`Select accent color ${color}`}
                          accessibilityState={{ selected: isActive }}
                        >
                          {isActive ? <Text style={styles.accentSwatchCheck}>✓</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.backgroundSection}>
                    <Text style={styles.backgroundTitle}>Garden background</Text>
                    <Text style={styles.backgroundCopy}>Set the color that surrounds your garden canvas.</Text>
                    <View style={styles.backgroundWheelContainer}>
                      <View style={styles.backgroundWheel}>
                        {backgroundWheelPositions.map(({ color, left, top }) => {
                          const isActive = gardenBackgroundColor === color;
                          return (
                            <Pressable
                              key={color}
                              style={[
                                styles.backgroundWheelSwatch,
                                { backgroundColor: color, left, top },
                                isActive && styles.backgroundWheelSwatchActive,
                              ]}
                              onPress={() => handleSelectBackgroundColor(color)}
                              accessibilityLabel={`Set garden background to ${color}`}
                              accessibilityState={{ selected: isActive }}
                            />
                          );
                        })}
                        <View style={[styles.backgroundWheelCenter, { backgroundColor: gardenBackgroundColor }]} />
                      </View>
                    </View>
                    <Pressable
                      style={styles.backgroundResetButton}
                      onPress={handleResetBackground}
                      accessibilityLabel="Reset background color"
                    >
                      <Text style={styles.backgroundResetText}>Reset to original</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.upgradeCopy}>Pick the emoji that appears on the home canvas and menu.</Text>
                  {emojiOptions.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
                      {emojiOptions.map((option) => {
                        const isSelected = option.emoji === customClickEmoji;
                        return (
                          <Pressable
                            key={option.id}
                            style={[styles.emojiChoice, isSelected && styles.emojiChoiceActive]}
                            onPress={() => handleChooseEmoji(option.emoji)}
                            accessibilityLabel={`Use ${option.emoji} as your click emoji`}
                            accessibilityState={{ selected: isSelected }}
                          >
                            <View style={[styles.emojiChoiceHalo, isSelected && styles.emojiChoiceHaloActive]} />
                            <View style={[styles.emojiChoiceInner, isSelected && styles.emojiChoiceInnerActive]}>
                              <Text style={[styles.emojiChoiceGlyph, isSelected && styles.emojiChoiceGlyphActive]}>
                                {option.emoji}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emojiEmptyText}>Purchase garden decorations to see suggested emoji.</Text>
                  )}
                  <Pressable
                    style={styles.emojiInputContainer}
                    onPress={() => emojiInputRef.current?.focus()}
                    accessible={false}
                  >
                    <TextInput
                      ref={emojiInputRef}
                      value={emojiInput}
                      onChangeText={handleEmojiInputChange}
                      placeholder="Type any emoji"
                      style={styles.emojiInputField}
                      maxLength={6}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="done"
                    />
                  </Pressable>
                  <Text style={styles.emojiNote}>
                    Tip: tap a suggestion or type an emoji to update your click button and menu instantly.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.upgradeCopy}>
                    Upgrade for $2.99 to unlock custom emoji choices, accent colors, and garden backgrounds for your clicker.
                  </Text>
                  <Pressable style={styles.upgradeButton} onPress={handleUpgrade} accessibilityLabel="Upgrade to Garden Plus">
                    <Text style={styles.upgradeButtonText}>Upgrade for $2.99</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Continue to the main screen render below

// ...existing code...

    <SafeAreaView style={containerStyle}>
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={handleClose}
            style={closeButtonStyle}
            accessibilityLabel={closeAccessibilityLabel}
          >
            <Text style={closeTextStyle}>{closeLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            style={styles.input}
            returnKeyType="done"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="@lettuce-lover"
            style={styles.input}
            returnKeyType="done"
          />
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Lifetime harvest</Text>
          <Text style={styles.statsValue}>{profileLifetimeTotal.toLocaleString()}</Text>
          <Text style={styles.statsCopy}>
            This is the sum of every harvest you’ve collected across all sessions. Keep playing to grow
            your lifetime score.
          </Text>
        </View>

        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>Garden Plus customization</Text>
          {hasPremiumUpgrade ? (
            <>
              <Text style={styles.upgradeCopy}>Choose an accent color for your click target.</Text>
              <View style={styles.accentRow}>
                {PREMIUM_ACCENT_OPTIONS.map((color) => {
                  const isActive = accentSelection === color;
                  return (
                    <Pressable
                      key={color}
                      style={[styles.accentSwatch, { backgroundColor: color }, isActive && styles.accentSwatchActive]}
                      onPress={() => handleSelectAccent(color)}
                      accessibilityLabel={`Select accent color ${color}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      {isActive ? <Text style={styles.accentSwatchCheck}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.backgroundSection}>
                <Text style={styles.backgroundTitle}>Garden background</Text>
                <Text style={styles.backgroundCopy}>Set the color that surrounds your garden canvas.</Text>
                <View style={styles.backgroundWheelContainer}>
                  <View style={styles.backgroundWheel}>
                    {backgroundWheelPositions.map(({ color, left, top }) => {
                      const isActive = gardenBackgroundColor === color;
                      return (
                        <Pressable
                          key={color}
                          style={[
                            styles.backgroundWheelSwatch,
                            { backgroundColor: color, left, top },
                            isActive && styles.backgroundWheelSwatchActive,
                          ]}
                          onPress={() => handleSelectBackgroundColor(color)}
                          accessibilityLabel={`Set garden background to ${color}`}
                          accessibilityState={{ selected: isActive }}
                        />
                      );
                    })}
                    <View style={[styles.backgroundWheelCenter, { backgroundColor: gardenBackgroundColor }]} />
                  </View>
                </View>
                <Pressable
                  style={styles.backgroundResetButton}
                  onPress={handleResetBackground}
                  accessibilityLabel="Reset background color"
                >
                  <Text style={styles.backgroundResetText}>Reset to original</Text>
                </Pressable>
              </View>
              <Text style={styles.upgradeCopy}>Pick the emoji that appears on the home canvas and menu.</Text>
              {emojiOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
                  {emojiOptions.map((option) => {
                    const isSelected = option.emoji === customClickEmoji;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.emojiChoice, isSelected && styles.emojiChoiceActive]}
                        onPress={() => handleChooseEmoji(option.emoji)}
                        accessibilityLabel={`Use ${option.emoji} as your click emoji`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={[styles.emojiChoiceHalo, isSelected && styles.emojiChoiceHaloActive]} />
                        <View style={[styles.emojiChoiceInner, isSelected && styles.emojiChoiceInnerActive]}>
                          <Text style={[styles.emojiChoiceGlyph, isSelected && styles.emojiChoiceGlyphActive]}>
                            {option.emoji}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.emojiEmptyText}>Purchase garden decorations to see suggested emoji.</Text>
              )}
              <Pressable
                style={styles.emojiInputContainer}
                onPress={() => emojiInputRef.current?.focus()}
                accessible={false}
              >
                <TextInput
                  ref={emojiInputRef}
                  value={emojiInput}
                  onChangeText={handleEmojiInputChange}
                  placeholder="Type any emoji"
                  style={styles.emojiInputField}
                  maxLength={6}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                />
              </Pressable>
              <Text style={styles.emojiNote}>
                Tip: tap a suggestion or type an emoji to update your click button and menu instantly.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.upgradeCopy}>
                Upgrade for $2.99 to unlock custom emoji choices, accent colors, and garden backgrounds for your clicker.
              </Text>
              <Pressable style={styles.upgradeButton} onPress={handleUpgrade} accessibilityLabel="Upgrade to Garden Plus">
                <Text style={styles.upgradeButtonText}>Upgrade for $2.99</Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
        <Pressable
          style={styles.resetButton}
          onPress={() => {
            Alert.alert('Reset game', 'Reset all game data and simulate a fresh install?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => resetGame() },
            ]);
          }}
        >
          <Text style={styles.resetButtonText}>Reset to new user</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
}

export default function ProfileScreen() {
  const router = useRouter();
  return <ProfileContent mode="screen" onRequestClose={() => router.back()} />;
}

const createResponsiveStyles = (isLandscape: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: isLandscape ? 20 : 24,
  },
  topBar: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 16,
    color: '#22543d',
    fontWeight: '600',
  },
  modalBackButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 101, 52, 0.14)',
  },
  modalBackLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532d',
  },
  headerCard: {
    backgroundColor: '#22543d',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  avatarButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    fontSize: 48,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f0fff4',
  },
  headerSubtitle: {
    color: '#c6f6d5',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  removePhotoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  removePhotoText: {
    color: '#f0fff4',
    fontWeight: '600',
  },
  widgetCard: {
    width: '100%',
    backgroundColor: 'rgba(240, 255, 244, 0.9)',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.65)',
    shadowColor: '#0f5132',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  widgetHeaderText: {
    flex: 1,
    gap: 4,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f5132',
  },
  widgetCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: '#14532d',
  },
  widgetPreviewFrame: {
    width: '100%',
    height: 164,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  widgetPreviewPlaceholder: {
    fontSize: 13,
    color: '#1f6f4a',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  widgetPreviewEmpty: {
    backgroundColor: '#ecfdf3',
    borderStyle: 'dashed',
    borderColor: '#86efac',
  },
  widgetChangeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#0f5132',
  },
  widgetChangeButtonText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 13,
  },
  formSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22543d',
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#22543d',
    borderWidth: 1,
    borderColor: '#bee3f8',
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22543d',
  },
  statsValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2f855a',
  },
  statsCopy: {
    fontSize: 14,
    color: '#2d3748',
    lineHeight: 20,
  },
  upgradeCard: {
    backgroundColor: '#f0fff4',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#0f766e',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#14532d',
  },
  upgradeCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
  },
  accentRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  accentSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  accentSwatchActive: {
    borderColor: '#22543d',
    shadowColor: '#22543d',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  accentSwatchCheck: {
    color: '#f0fff4',
    fontWeight: '800',
  },
  backgroundSection: {
    marginTop: 12,
    gap: 10,
  },
  backgroundTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14532d',
  },
  backgroundCopy: {
    fontSize: 13,
    color: '#22543d',
    lineHeight: 18,
  },
  backgroundWheelContainer: {
    gap: 12,
    alignItems: 'center',
  },
  backgroundWheel: {
    width: BACKGROUND_WHEEL_DIAMETER,
    height: BACKGROUND_WHEEL_DIAMETER,
    borderRadius: BACKGROUND_WHEEL_DIAMETER / 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  backgroundWheelSwatch: {
    position: 'absolute',
    width: BACKGROUND_WHEEL_SWATCH_SIZE,
    height: BACKGROUND_WHEEL_SWATCH_SIZE,
    borderRadius: BACKGROUND_WHEEL_SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(15, 83, 45, 0.2)',
  },
  backgroundWheelSwatchActive: {
    borderColor: '#1f6f4a',
    shadowColor: '#0f5132',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  backgroundWheelCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  backgroundResetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#bbf7d0',
  },
  backgroundResetText: {
    color: '#0f5132',
    fontWeight: '700',
    fontSize: 13,
  },
  emojiRow: {
    gap: 14,
    paddingVertical: 6,
  },
  emojiChoice: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  emojiChoiceActive: {
    transform: [{ scale: 1.03 }],
  },
  emojiChoiceHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  emojiChoiceHaloActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  emojiChoiceInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.25)',
    shadowColor: '#0f766e',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emojiChoiceInnerActive: {
    backgroundColor: '#ecfdf3',
    borderColor: 'rgba(22, 101, 52, 0.45)',
  },
  emojiChoiceGlyph: {
    fontSize: 30,
  },
  emojiChoiceGlyphActive: {
    transform: [{ scale: 1.05 }],
  },
  emojiEmptyText: {
    fontSize: 13,
    color: '#2d3748',
  },
  emojiInputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emojiInputField: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#22543d',
  },
  emojiNote: {
    fontSize: 12,
    color: '#1f6f4a',
    lineHeight: 18,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#047857',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    color: '#f0fff4',
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#22543d',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#f0fff4',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  resetButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resetButtonText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  modalCard: {
    backgroundColor: '#f0fff4',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    shadowColor: '#0f2e20',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    height: '90%',
    alignSelf: 'center',
    width: '100%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#bbf7d0',
    marginBottom: 16,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    gap: 20,
    paddingBottom: 40,
  },
  widgetToggleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  widgetToggleTextContainer: {
    flex: 1,
    gap: 4,
  },
  widgetToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22543d',
  },
  widgetToggleCopy: {
    fontSize: 14,
    color: '#2d3748',
    lineHeight: 20,
  },
  backgroundResetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22543d',
  },
  rssFeedsToggleButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  rssFeedsToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22543d',
  },
  rssFeedsToggleIcon: {
    fontSize: 14,
    color: '#22543d',
  },
  rssFeedsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  rssFeedsScrollView: {
    maxHeight: 200,
  },
  rssFeedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rssFeedInfo: {
    flex: 1,
  },
  rssFeedName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  rssFeedCategory: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rssFeedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rssFeedSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  rssFeedRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rssFeedRemoveText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  addFeedSection: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addFeedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  addFeedInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    color: '#1f2937',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  categoryOptionSelected: {
    backgroundColor: '#dcfce7',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: '#16a34a',
  },
  addFeedButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addFeedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

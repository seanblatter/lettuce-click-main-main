import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions, Image, TextInput, SafeAreaView, Animated as ReactAnimated, Alert, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { MusicContent } from '@/app/music';
import { GamesHub } from '@/components/GamesHub';

export default function LettuceScreen() {
  const insets = useSafeAreaInsets();
  const dimensions = Dimensions.get('window');

  // Daily Bonus constants
  const BONUS_REWARD_OPTIONS = [75, 125, 200, 325, 500, 650];
  const DAILY_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const DAILY_BONUS_LAST_CLAIM_KEY = 'lettuce-click:daily-bonus-last-claim';

  const {
    customClickEmoji,
    profileName,
    widgetPromenade,
    hasPremiumUpgrade,
    purchasePremiumUpgrade,
    removeWidgetPromenadePhoto,
    updateWidgetPromenadeTitle,
    emojiInventory,
    emojiCatalog,
    customEmojiNames,
    gardenBackgroundColor,
    addHarvestAmount,
    grantEmojiUnlock,
  } = useGame();

  const [showMusicQuickAction, setShowMusicQuickAction] = useState(false);
  const [showWidgetPromenade, setShowWidgetPromenade] = useState(false);
  const [showGamesHub, setShowGamesHub] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumTriggerSource, setPremiumTriggerSource] = useState<'profile' | 'upgrade' | null>(null);
  const [selectedPremiumPlan, setSelectedPremiumPlan] = useState<'monthly' | 'yearly' | 'lifetime' | null>(null);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // Daily Bonus spin state
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastBonusReward, setLastBonusReward] = useState<number | null>(null);
  const [lastUnlockedEmoji, setLastUnlockedEmoji] = useState<any>(null);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [showBonusReward, setShowBonusReward] = useState(false);
  const [availableBonusSpins, setAvailableBonusSpins] = useState(1);
  const [dailyCountdown, setDailyCountdown] = useState<string | null>(null);
  const spinAnimation = useRef(new Animated.Value(0)).current;

  const friendlyName = useMemo(() => {
    const trimmed = profileName.trim();
    return trimmed.length > 0 ? trimmed : 'Gardener';
  }, [profileName]);

  const lockedShopEmojis = useMemo(() => {
    return emojiCatalog.filter((emoji) => !emojiInventory[emoji.id]);
  }, [emojiCatalog, emojiInventory]);

  const isLandscape = useMemo(() => dimensions.width > dimensions.height, [dimensions]);

  const widgetPromenadeSorted = useMemo(
    () => [...widgetPromenade].sort((a, b) => b.savedAt - a.savedAt),
    [widgetPromenade]
  );

  const widgetPromenadeStatus = useMemo(
    () => (widgetPromenade.length ? `${widgetPromenade.length} saved` : 'Start a gallery'),
    [widgetPromenade.length]
  );

  // Load daily bonus state from storage
  useEffect(() => {
    const loadDailyBonusState = async () => {
      try {
        const lastClaimTime = await AsyncStorage.getItem(DAILY_BONUS_LAST_CLAIM_KEY);
        
        if (lastClaimTime) {
          const lastClaimMs = parseInt(lastClaimTime, 10);
          const now = Date.now();
          const elapsedMs = now - lastClaimMs;
          
          if (elapsedMs >= DAILY_BONUS_INTERVAL_MS) {
            // 24 hours have passed, reset to 1 available spin
            setAvailableBonusSpins(1);
            setDailyCountdown(null);
          } else {
            // Still waiting, set spins to 0 and start countdown
            setAvailableBonusSpins(0);
            const remainingMs = DAILY_BONUS_INTERVAL_MS - elapsedMs;
            const formatted = formatDuration(remainingMs);
            setDailyCountdown(formatted);
          }
        } else {
          // First time, 1 spin available
          setAvailableBonusSpins(1);
        }
      } catch (error) {
        console.warn('Failed to load daily bonus state:', error);
        setAvailableBonusSpins(1);
      }
    };

    loadDailyBonusState();
  }, []);

  // Format duration for countdown display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (availableBonusSpins > 0 || !showDailyBonus) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const lastClaimTime = await AsyncStorage.getItem(DAILY_BONUS_LAST_CLAIM_KEY);
        if (lastClaimTime) {
          const lastClaimMs = parseInt(lastClaimTime, 10);
          const now = Date.now();
          const elapsedMs = now - lastClaimMs;
          const remainingMs = Math.max(DAILY_BONUS_INTERVAL_MS - elapsedMs, 0);
          
          if (remainingMs === 0) {
            // Countdown complete, reset spin
            setAvailableBonusSpins(1);
            setDailyCountdown(null);
            clearInterval(interval);
          } else {
            const formatted = formatDuration(remainingMs);
            setDailyCountdown(formatted);
          }
        }
      } catch (error) {
        console.warn('Failed to update countdown:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [availableBonusSpins, showDailyBonus]);

  const handleOpenProfile = useCallback(() => {
    router.push('/profile');
  }, []);

  const handleOpenMusic = useCallback(() => {
    if (isLandscape) {
      router.push('/music');
    } else {
      setShowMusicQuickAction(true);
    }
  }, [isLandscape]);

  const handleCloseMusicQuickAction = useCallback(() => {
    setShowMusicQuickAction(false);
  }, []);

  const handleOpenWidgetPromenade = useCallback(() => {
    setShowWidgetPromenade(true);
  }, []);

  const handleCloseWidgetPromenade = useCallback(() => {
    setShowWidgetPromenade(false);
  }, []);

  const handleOpenGamesHub = useCallback(() => {
    setShowGamesHub(true);
  }, []);

  const handleCloseGamesHub = useCallback(() => {
    setShowGamesHub(false);
  }, []);

  const handleOpenPremium = useCallback(() => {
    setPremiumTriggerSource('upgrade');
    setShowPremiumModal(true);
  }, []);

  const handleOpenPremiumFromProfile = useCallback(() => {
    setPremiumTriggerSource('profile');
    setShowPremiumModal(true);
  }, []);

  const handleClosePremium = useCallback(() => {
    setShowPremiumModal(false);
    setPremiumTriggerSource(null);
  }, []);

  const handlePurchasePremium = useCallback(() => {
    purchasePremiumUpgrade();
    setShowPremiumModal(false);
    setPremiumTriggerSource(null);
  }, [purchasePremiumUpgrade]);

  const handleOpenDailyBonus = useCallback(() => {
    setShowDailyBonus(true);
  }, []);

  const handleCloseDailyBonus = useCallback(() => {
    setShowDailyBonus(false);
    setShowBonusReward(false);
    setLastBonusReward(null);
    setLastUnlockedEmoji(null);
    setBonusMessage(null);
  }, []);

  const handleSpinNow = useCallback(() => {
    if (isSpinning || availableBonusSpins <= 0) return;

    setIsSpinning(true);
    setShowBonusReward(false);
    setBonusMessage('Spinning…');
    
    // Reset and start animation
    spinAnimation.stopAnimation();
    spinAnimation.setValue(0);
    
    Animated.timing(spinAnimation, {
      toValue: 1,
      duration: 1500, // 4 full rotations in 1.5 seconds
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      spinAnimation.setValue(0);
    });

    // Determine reward
    const reward = BONUS_REWARD_OPTIONS[Math.floor(Math.random() * BONUS_REWARD_OPTIONS.length)];
    
    setTimeout(async () => {
      try {
        // Grant the harvest reward
        addHarvestAmount(reward);
        setLastBonusReward(reward);

        // Decrement available spins
        setAvailableBonusSpins(0);

        // Save claim time to storage
        const now = Date.now();
        await AsyncStorage.setItem(DAILY_BONUS_LAST_CLAIM_KEY, now.toString());

        // Calculate and set next available time
        const nextAvailableTime = now + DAILY_BONUS_INTERVAL_MS;
        const remainingMs = nextAvailableTime - now;
        const formatted = formatDuration(remainingMs);
        setDailyCountdown(formatted);

        // 50% chance to win an emoji if there are locked emojis available
        let unlockedEmoji: any = null;
        if (lockedShopEmojis.length > 0 && Math.random() < 0.5) {
          const randomIndex = Math.floor(Math.random() * lockedShopEmojis.length);
          unlockedEmoji = lockedShopEmojis[randomIndex];
          
          if (unlockedEmoji) {
            grantEmojiUnlock(unlockedEmoji.id);
            setLastUnlockedEmoji(unlockedEmoji);
          }
        }

        // Set message
        if (unlockedEmoji) {
          setBonusMessage(`You won ${unlockedEmoji.name}!`);
        } else {
          setBonusMessage(
            lockedShopEmojis.length > 0 
              ? 'Spin again for a chance to win emojis!' 
              : 'All emojis unlocked!'
          );
        }

        setShowBonusReward(true);
        setIsSpinning(false);
      } catch (error) {
        console.warn('Failed to save spin state:', error);
        setIsSpinning(false);
      }
    }, 1500);
  }, [isSpinning, availableBonusSpins, spinAnimation, addHarvestAmount, grantEmojiUnlock, lockedShopEmojis, formatDuration]);

  const handleRemovePromenadePhoto = useCallback(
    (entryId: string) => {
      removeWidgetPromenadePhoto(entryId);
    },
    [removeWidgetPromenadePhoto]
  );

  const handleSavePhotoToDevice = useCallback(
    async (uri: string, title: string | undefined) => {
      try {
        // Request media library permissions
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please allow access to your camera roll to save images.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Save the image to camera roll
        await MediaLibrary.saveToLibraryAsync(uri);
        
        // Show success message
        Alert.alert(
          'Saved!',
          `"${title || 'Snapshot'}" has been saved to your camera roll.`,
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error('Error saving photo:', error);
        Alert.alert(
          'Error',
          'Failed to save image to camera roll. Please try again.',
          [{ text: 'OK' }]
        );
      }
    },
    []
  );

  const handleStartEditTitle = useCallback((entryId: string, currentTitle: string | undefined) => {
    setEditingTitleId(entryId);
    setEditingTitleText(currentTitle || '');
  }, []);

  const handleSaveTitle = useCallback(() => {
    if (editingTitleId) {
      updateWidgetPromenadeTitle(editingTitleId, editingTitleText);
      setEditingTitleId(null);
      setEditingTitleText('');
    }
  }, [editingTitleId, editingTitleText, updateWidgetPromenadeTitle]);

  const handleCancelEditTitle = useCallback(() => {
    setEditingTitleId(null);
    setEditingTitleText('');
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: gardenBackgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Profile Hero */}
        <View style={styles.heroSection}>
          <Pressable
            style={styles.menuHero}
            onPress={hasPremiumUpgrade ? handleOpenProfile : handleOpenPremiumFromProfile}
          >
            <View style={styles.menuHeroBadge}>
              <Text style={styles.menuHeroEmoji}>{customClickEmoji}</Text>
            </View>
            <View style={styles.menuHeroTextBlock}>
              <Text style={styles.menuHeroTitle}>Garden Profile</Text>
              <Text style={styles.menuHeroCopy}>
                {hasPremiumUpgrade 
                  ? `Welcome back, ${friendlyName}! View your profile and achievements.`
                  : 'Upgrade to Premium to unlock your garden profile'
                }
              </Text>
            </View>
          </Pressable>
          {!hasPremiumUpgrade && (
            <Pressable
              style={styles.premiumButton}
              onPress={handleOpenPremium}
            >
              <Text style={styles.premiumButtonIcon}>⭐</Text>
              <Text style={styles.premiumButtonText}>Upgrade</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.menuSheetContent}>
          <Text style={styles.menuSectionTitle}>Quick actions</Text>

          {/* Music Lounge */}
          <Pressable
            style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemCardPressed]}
            onPress={handleOpenMusic}
          >
            <View style={styles.menuItemIconWrap}>
              <Text style={styles.menuItemIcon}>🎧</Text>
            </View>
            <View style={styles.menuItemBody}>
              <Text style={styles.menuItemTitle}>Music Lounge</Text>
              <Text style={styles.menuItemSubtitle}>Curated ambience for focus &amp; rest</Text>
            </View>
            <Text style={styles.menuItemChevron}>›</Text>
          </Pressable>

          {/* Promenade Gallery */}
          <Pressable
            style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemCardPressed]}
            onPress={handleOpenWidgetPromenade}
          >
            <View style={styles.menuItemIconWrap}>
              <Text style={styles.menuItemIcon}>🖼️</Text>
            </View>
            <View style={styles.menuItemBody}>
              <Text style={styles.menuItemTitle}>Promenade Gallery</Text>
              <Text style={styles.menuItemSubtitle}>Showcase saved garden photos</Text>
            </View>
            <Text style={styles.menuItemChevron}>›</Text>
          </Pressable>

          {/* Daily Bonus */}
          <Pressable
            style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemCardPressed]}
            onPress={handleOpenDailyBonus}
          >
            <View style={styles.menuItemIconWrap}>
              <Text style={styles.menuItemIcon}>🎁</Text>
            </View>
            <View style={styles.menuItemBody}>
              <Text style={styles.menuItemTitle}>Daily Bonus</Text>
              <Text style={styles.menuItemSubtitle}>Spin for surprise clicks</Text>
            </View>
            <View style={styles.menuPill}>
              <Text style={styles.menuPillText}>Ready</Text>
            </View>
          </Pressable>

          {/* Games Arcade */}
          <Pressable
            style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemCardPressed]}
            onPress={handleOpenGamesHub}
          >
            <View style={styles.menuItemIconWrap}>
              <Text style={styles.menuItemIcon}>🎮</Text>
            </View>
            <View style={styles.menuItemBody}>
              <Text style={styles.menuItemTitle}>Games Arcade</Text>
              <Text style={styles.menuItemSubtitle}>Play with your emoji collection</Text>
            </View>
            <Text style={styles.menuItemChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Music Lounge Modal */}
      <Modal
        visible={showMusicQuickAction}
        animationType="slide"
        onRequestClose={handleCloseMusicQuickAction}
      >
        <MusicContent mode="modal" onRequestClose={handleCloseMusicQuickAction} hasPremiumUpgrade={hasPremiumUpgrade} onPurchasePremium={() => {
          handleCloseMusicQuickAction();
          handleOpenPremium();
        }} />
      </Modal>

      {/* Promenade Gallery Modal */}
      <Modal
        visible={showWidgetPromenade}
        animationType="slide"
        onRequestClose={handleCloseWidgetPromenade}
      >
        <SafeAreaView style={[styles.promenadeSafeArea, { backgroundColor: gardenBackgroundColor }]}>
          <View style={[styles.promenadeContainer, { paddingTop: 0 }]}>
            <View style={styles.promenadeHeader}>
              <Text style={styles.promenadeTitle}>Promenade Gallery</Text>
              <Pressable
                style={styles.promenadeCloseButton}
                onPress={handleCloseWidgetPromenade}
              >
                <Text style={styles.promenadeCloseText}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.promenadeSubtitle}>
              Saved snapshots appear in your promenade gallery for your roaming enjoyment!
            </Text>
            {widgetPromenadeSorted.length === 0 ? (
              <View style={styles.promenadeEmptyState}>
                <Text style={styles.promenadeEmptyTitle}>No snapshots yet</Text>
                <Text style={styles.promenadeEmptyCopy}>
                  Save a garden photo and choose "Add to Promenade" to build your widget gallery.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.promenadeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {widgetPromenadeSorted.map((entry) => (
                  <View key={entry.id} style={styles.promenadeItem}>
                    <Image source={{ uri: entry.uri }} style={styles.promenadeImage} />
                    <View style={styles.promenadeMetaRow}>
                      {editingTitleId === entry.id ? (
                        <TextInput
                          style={styles.promenadeTitleInput}
                          placeholder="Add a title..."
                          value={editingTitleText}
                          onChangeText={setEditingTitleText}
                          placeholderTextColor="#999"
                          autoFocus
                          maxLength={50}
                        />
                      ) : (
                        <Pressable
                          onPress={() => handleStartEditTitle(entry.id, entry.title)}
                          style={styles.promenadeTitlePressable}
                        >
                          <Text style={styles.promenadeItemTitle}>
                            {entry.title || 'Untitled snapshot'}
                          </Text>
                        </Pressable>
                      )}
                      {editingTitleId === entry.id ? (
                        <>
                          <Pressable
                            style={styles.promenadeSaveButton}
                            onPress={handleSaveTitle}
                          >
                            <Text style={styles.promenadeSaveButtonText}>✓</Text>
                          </Pressable>
                          <Pressable
                            style={styles.promenadeCancelButton}
                            onPress={handleCancelEditTitle}
                          >
                            <Text style={styles.promenadeCancelButtonText}>✕</Text>
                          </Pressable>
                        </>
                      ) : (
                        <View style={styles.promenadeActionButtons}>
                          <Pressable
                            style={styles.promenadeSaveToDeviceButton}
                            onPress={() => handleSavePhotoToDevice(entry.uri, entry.title)}
                          >
                            <Text style={styles.promenadeSaveToDeviceButtonText}>✓</Text>
                          </Pressable>
                          <Pressable
                            style={styles.promenadeDeleteButton}
                            onPress={() => handleRemovePromenadePhoto(entry.id)}
                          >
                            <Text style={styles.promenadeDeleteButtonText}>−</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Games Hub Modal */}
      <GamesHub
        visible={showGamesHub}
        onRequestClose={handleCloseGamesHub}
        emojiInventory={emojiInventory}
        emojiCatalog={emojiCatalog}
        customEmojiNames={customEmojiNames}
        hasPremiumUpgrade={hasPremiumUpgrade}
        backgroundColor={gardenBackgroundColor}
        onPurchasePremium={() => {
          setShowGamesHub(false);
          handleOpenPremium();
        }}
      />

      {/* Premium Upgrade Modal */}
      <Modal
        visible={showPremiumModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePremium}
      >
        <SafeAreaView style={styles.premiumModalSafeArea}>
          <View style={styles.premiumModalContainer}>
            <View style={styles.premiumModalHeader}>
              <Text style={styles.premiumModalTitle}>Upgrade to Premium</Text>
              <Pressable
                style={styles.premiumModalCloseButton}
                onPress={handleClosePremium}
              >
                <Text style={styles.premiumModalCloseText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.premiumModalContent}
              contentContainerStyle={styles.premiumModalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero Banner */}
              <View style={styles.premiumHeroBanner}>
                <Text style={styles.premiumHeroIcon}>⭐</Text>
                <Text style={styles.premiumHeroTitle}>
                  {premiumTriggerSource === 'profile' ? 'Unlock Your Garden Profile' : 'Become a Premium Member'}
                </Text>
                <Text style={styles.premiumHeroSubtitle}>
                  {premiumTriggerSource === 'profile'
                    ? 'Upgrade to access your personalized garden profile and view your achievements'
                    : 'Unlock all features and enjoy an enhanced experience'
                  }
                </Text>
              </View>

              {/* Benefits List */}
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🎮</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>Unlock All Games</Text>
                    <Text style={styles.benefitDescription}>
                      Play Lettuce Hop, Checkers, and all exclusive games
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🎨</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>Customize Backgrounds</Text>
                    <Text style={styles.benefitDescription}>
                      Choose from beautiful garden backgrounds
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>✨</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>100,000+ Emojis</Text>
                    <Text style={styles.benefitDescription}>
                      Access our complete emoji collection and blends
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🚀</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>Ad-Free Experience</Text>
                    <Text style={styles.benefitDescription}>
                      Enjoy uninterrupted gameplay and browsing
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🎁</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>Exclusive Rewards</Text>
                    <Text style={styles.benefitDescription}>
                      Get bonus spins and special daily bonuses
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>👑</Text>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>Premium Support</Text>
                    <Text style={styles.benefitDescription}>
                      Priority access to new features and updates
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pricing Tiers */}
              <View style={styles.pricingSection}>
                <Text style={styles.pricingSectionTitle}>Choose Your Plan</Text>
                <View style={styles.pricingCardsContainer}>
                  {/* Monthly Plan */}
                  <Pressable 
                    style={[
                      styles.pricingCard,
                      { marginTop: 12 },
                      selectedPremiumPlan === 'monthly' && styles.pricingCardSelected
                    ]}
                    onPress={() => setSelectedPremiumPlan('monthly')}
                  >
                    <Text style={styles.pricingPlanName}>Monthly</Text>
                    <Text style={[
                      styles.pricingPrice,
                      selectedPremiumPlan === 'monthly' && styles.pricingPriceSelected
                    ]}>$2.99</Text>
                    <Text style={styles.pricingPeriod}>Per Month</Text>
                  </Pressable>

                  {/* Yearly Plan */}
                  <Pressable 
                    style={[
                      styles.pricingCard,
                      { marginTop: 12 },
                      selectedPremiumPlan === 'yearly' && styles.pricingCardSelected
                    ]}
                    onPress={() => setSelectedPremiumPlan('yearly')}
                  >
                    <Text style={styles.pricingPlanName}>Yearly</Text>
                    <Text style={[
                      styles.pricingPrice,
                      selectedPremiumPlan === 'yearly' && styles.pricingPriceSelected
                    ]}>$17.99</Text>
                    <Text style={styles.pricingPeriod}>Per Year</Text>
                  </Pressable>

                  {/* Lifetime Plan */}
                  <View style={{ position: 'relative', marginTop: 12 }}>
                    <Pressable 
                      style={[
                        styles.pricingCard,
                        selectedPremiumPlan === 'lifetime' && styles.pricingCardSelected
                      ]}
                      onPress={() => setSelectedPremiumPlan('lifetime')}
                    >
                      <Text style={styles.pricingPlanName}>Lifetime</Text>
                      <Text style={[
                        styles.pricingPrice,
                        selectedPremiumPlan === 'lifetime' && styles.pricingPriceSelected
                      ]}>$39.99</Text>
                      <Text style={styles.pricingPeriod}>One-Time</Text>
                    </Pressable>
                    <View style={styles.pricingBadgeOverlay}>
                      <Text style={styles.pricingPopularBadge}>Best Value</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Purchase Button */}
            <View style={styles.premiumButtonContainer}>
              <Pressable
                style={[
                  styles.premiumPurchaseButton,
                  !selectedPremiumPlan && styles.premiumPurchaseButtonDisabled
                ]}
                onPress={handlePurchasePremium}
                disabled={!selectedPremiumPlan}
              >
                <Text style={styles.premiumPurchaseButtonText}>
                  {selectedPremiumPlan ? 'Upgrade Now' : 'Select a Plan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Daily Bonus Modal */}
      <Modal
        visible={showDailyBonus}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDailyBonus}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: gardenBackgroundColor }]}>
          <View style={styles.dailyBonusModalContent}>
            {/* Header */}
            <View style={styles.dailyBonusHeader}>
              <Pressable onPress={handleCloseDailyBonus} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
              <Text style={styles.dailyBonusTitle}>Daily Bonus</Text>
              <View style={{ width: 44 }} />
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.dailyBonusScroll}
              contentContainerStyle={styles.dailyBonusScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Spinning Ferris Wheel */}
              <View style={styles.spinningWheelContainer}>
                <Animated.Text
                  style={[
                    styles.spinningWheelEmoji,
                    {
                      transform: [
                        {
                          rotate: spinAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '1440deg'], // 4 full rotations
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  🎡
                </Animated.Text>
              </View>

              {/* Info Section */}
              <View style={styles.bonusInfoCard}>
                <Text style={styles.bonusInfoTitle}>Spin the Wheel Daily!</Text>
                
                {showBonusReward ? (
                  <>
                    {lastUnlockedEmoji && (
                      <View style={styles.cardEmojiSection}>
                        <Text style={styles.cardEmojiDisplay}>
                          {lastUnlockedEmoji.emoji}
                        </Text>
                        <Text style={styles.cardEmojiName}>{lastUnlockedEmoji.name}</Text>
                      </View>
                    )}

                    {lastBonusReward && (
                      <View style={styles.cardRewardSection}>
                        <Text style={styles.cardRewardLabel}>You Earned</Text>
                        <Text style={styles.cardRewardAmount}>
                          {lastBonusReward.toLocaleString()} Clicks
                        </Text>
                      </View>
                    )}

                    <Text style={styles.cardMessageText}>{bonusMessage}</Text>
                  </>
                ) : (
                  <Text style={styles.bonusInfoSubtitle}>
                    Unlock rewards and emojis every day
                  </Text>
                )}
              </View>

              {/* Stats */}
              <View style={styles.bonusStatsContainer}>
                <View style={styles.bonusStatItem}>
                  <Text style={styles.bonusStatValue}>🎁</Text>
                  <Text style={styles.bonusStatLabel}>Available Spins</Text>
                  <Text style={styles.bonusStatCount}>{availableBonusSpins}</Text>
                </View>
                <View style={styles.bonusStatItem}>
                  <Text style={styles.bonusStatValue}>⏰</Text>
                  <Text style={styles.bonusStatLabel}>Next Free Spin</Text>
                  <Text style={styles.bonusStatCount}>
                    {availableBonusSpins > 0 ? 'Ready!' : (dailyCountdown || 'Loading...')}
                  </Text>
                </View>
              </View>

              {/* Spin Button */}
              <Pressable 
                style={[
                  styles.spinButton, 
                  (isSpinning || availableBonusSpins === 0) && styles.spinButtonDisabled
                ]}
                onPress={handleSpinNow}
                disabled={isSpinning || availableBonusSpins === 0}
              >
                <Text style={styles.spinButtonText}>
                  {availableBonusSpins === 0 
                    ? 'Come Back Tomorrow' 
                    : isSpinning 
                      ? 'Spinning...' 
                      : 'Spin Now 🎰'
                  }
                </Text>
              </Pressable>

              {/* Ad Alternative */}
              <Pressable style={styles.adButton}>
                <Text style={styles.adButtonText}>Watch Ad for Extra Spin 📺</Text>
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fff4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 20,
  },
  menuHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    gap: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.18)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  menuHeroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  menuHeroEmoji: {
    fontSize: 42,
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
  menuSheetContent: {
    gap: 12,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#134e32',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  menuItemCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  menuItemIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIcon: {
    fontSize: 28,
  },
  menuItemBody: {
    flex: 1,
    gap: 3,
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
  menuItemChevron: {
    fontSize: 18,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  menuPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
  },
  menuPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },

  // Promenade styles
  promenadeSafeArea: {
    flex: 1,
    backgroundColor: '#f0fff4',
  },
  promenadeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  promenadeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 12,
  },
  promenadeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#134e32',
  },
  promenadeCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(31, 111, 74, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(31, 111, 74, 0.18)',
  },
  promenadeCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f6f4a',
  },
  promenadeSubtitle: {
    fontSize: 13,
    color: '#2d3748',
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  promenadeEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  promenadeEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134e32',
  },
  promenadeEmptyCopy: {
    fontSize: 13,
    color: '#2d3748',
    textAlign: 'center',
    maxWidth: 280,
  },
  promenadeScrollContent: {
    gap: 16,
    paddingBottom: 24,
  },
  promenadeItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  promenadeImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#e2e8f0',
  },
  promenadeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  promenadeTitleInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#134e32',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#2dd78f',
  },
  promenadeTitlePressable: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  promenadeItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#134e32',
  },
  promenadeSaveButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2dd78f',
  },
  promenadeSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2dd78f',
  },
  promenadeCancelButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  promenadeCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  promenadeDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  promenadeDeleteButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e11d48',
  },
  promenadeActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  promenadeSaveToDeviceButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  promenadeSaveToDeviceButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
  },
  // Hero Section
  heroSection: {
    position: 'relative',
    marginBottom: 4,
  },
  premiumButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: -2,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  premiumButtonIcon: {
    fontSize: 22,
    lineHeight: 22,
  },
  premiumButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: -1,
    letterSpacing: -0.2,
  },
  // Premium Modal
  premiumModalSafeArea: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  premiumModalContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  premiumModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  premiumModalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  premiumModalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  premiumModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065f46',
  },
  premiumModalContent: {
    flex: 1,
  },
  premiumModalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  premiumHeroBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumHeroIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  premiumHeroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 12,
  },
  premiumHeroSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  benefitsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  benefitIcon: {
    fontSize: 32,
    marginRight: 16,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
    lineHeight: 20,
  },
  premiumButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  premiumPurchaseButton: {
    backgroundColor: '#1f6f4a',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f6f4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#0d4d2c',
  },
  premiumPurchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Daily Bonus Modal Styles
  dailyBonusModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dailyBonusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
  dailyBonusTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
  },
  dailyBonusScroll: {
    flex: 1,
  },
  dailyBonusScrollContent: {
    paddingBottom: 24,
    gap: 20,
  },
  bonusWheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    marginTop: 12,
  },
  bonusWheelEmoji: {
    fontSize: 80,
  },
  bonusInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
  },
  bonusInfoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  bonusInfoSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  bonusStatsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  bonusStatItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.12)',
  },
  bonusStatValue: {
    fontSize: 28,
  },
  bonusStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  bonusStatCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f6f4a',
  },
  spinButton: {
    backgroundColor: '#1f6f4a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  spinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  adButton: {
    backgroundColor: 'rgba(31, 111, 74, 0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1f6f4a',
  },
  adButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f6f4a',
  },
  spinningWheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    marginTop: 12,
    height: 200,
  },
  spinningWheelEmoji: {
    fontSize: 100,
  },
  spinButtonDisabled: {
    opacity: 0.6,
  },
  rewardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 24,
    borderWidth: 2,
    borderColor: '#1f6f4a',
    marginTop: 20,
  },
  rewardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 28,
  },
  unlockedEmojiSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  unlockedEmojiDisplay: {
    fontSize: 80,
  },
  unlockedEmojiName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6f4a',
    textAlign: 'center',
  },
  bonusRewardSection: {
    alignItems: 'center',
    gap: 8,
  },
  bonusRewardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  bonusRewardAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f6f4a',
  },
  bonusMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
  },
  continueButton: {
    backgroundColor: '#1f6f4a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardEmojiSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  cardEmojiDisplay: {
    fontSize: 64,
  },
  cardEmojiName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f6f4a',
    textAlign: 'center',
  },
  cardRewardSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  cardRewardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  cardRewardAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f6f4a',
  },
  cardMessageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  pricingSection: {
    marginTop: 24,
    gap: 12,
    paddingHorizontal: 4,
  },
  pricingSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  pricingCardsContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    minHeight: 140,
    position: 'relative',
  },
  pricingCardSelected: {
    borderColor: '#1f6f4a',
    backgroundColor: '#f0fdf4',
  },
  pricingPopularBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: '#1f6f4a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pricingBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pricingPlanName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  pricingPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f6f4a',
  },
  pricingPriceSelected: {
    // Keep size consistent, no change on selection
  },
  pricingPeriod: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  premiumPurchaseButtonDisabled: {
    opacity: 0.5,
  },
  pricingButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(31, 111, 74, 0.1)',
    alignItems: 'center',
    marginTop: 8,
  },
  pricingButtonPopular: {
    backgroundColor: '#1f6f4a',
  },
  pricingButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f6f4a',
  },
  pricingButtonTextPopular: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

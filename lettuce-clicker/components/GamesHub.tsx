import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
// Use explicit extension to help TS resolver
import FlappyLettuceGame from './FlappyLettuceGame.tsx';
import LettuceSlicerGame from './LettuceSlicerGame';
import { LettuceHopGame } from './LettuceHopGame';
import type { EmojiDefinition } from '@/context/GameContext';

interface GamesHubProps {
  visible: boolean;
  onRequestClose: () => void;
  emojiInventory: Record<string, boolean>;
  emojiCatalog: EmojiDefinition[];
  customEmojiNames: Record<string, string>;
  hasPremiumUpgrade?: boolean;
  onPurchasePremium?: () => void;
}

type GameScreen = 'hub' | 'flappy-lettuce' | 'lettuce-slicer' | 'lettuce-hop';

interface EmojiItem {
  id?: string;
  emoji: string;
  imageUrl?: string;
  name?: string;
}

export function GamesHub({ visible, onRequestClose, emojiInventory, emojiCatalog, customEmojiNames, hasPremiumUpgrade = false, onPurchasePremium }: GamesHubProps) {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('hub');
  const [selectedEmoji, setSelectedEmoji] = useState<EmojiItem>({ emoji: '🥬' });

  // Get list of owned emoji objects (with imageUrl for blended emojis)
  const ownedEmojiObjects = useMemo(() => {
    const owned = Object.keys(emojiInventory).filter(id => emojiInventory[id]);
    const emojis: EmojiItem[] = owned.map(id => {
      const def = emojiCatalog.find(e => e.id === id);
      if (!def) return null;
      return {
        id: def.id,
        emoji: def.emoji,
        imageUrl: def.imageUrl,
        name: customEmojiNames[id] || def.name,
      };
    }).filter(Boolean) as EmojiItem[];
    
    // If no emojis owned, use 9 most recent from catalog + lettuce
    if (emojis.length === 0) {
      const recentEmojis: EmojiItem[] = emojiCatalog
        .slice(0, 9)
        .map(e => ({
          id: e.id,
          emoji: e.emoji,
          imageUrl: e.imageUrl,
          name: e.name,
        }));
      return [{ id: 'lettuce', emoji: '🥬' }, ...recentEmojis];
    }
    
    if (!emojis.find(e => e.emoji === '🥬')) {
      emojis.unshift({ id: 'lettuce', emoji: '🥬' });
    }
    
    return emojis;
  }, [emojiInventory, emojiCatalog, customEmojiNames]);

  // Create a mapping from emoji string to custom name
  const emojiStringToName = useMemo(() => {
    const mapping: Record<string, string> = {};
    Object.keys(emojiInventory).forEach(id => {
      if (emojiInventory[id]) {
        const def = emojiCatalog.find(e => e.id === id);
        if (def?.emoji && customEmojiNames[id]) {
          mapping[def.emoji] = customEmojiNames[id];
        }
      }
    });
    return mapping;
  }, [emojiInventory, emojiCatalog, customEmojiNames]);

  // Create a mapping from emoji string to ID for consistent stats tracking
  const emojiStringToId = useMemo(() => {
    const mapping: Record<string, string> = {};
    emojiCatalog.forEach(def => {
      mapping[def.emoji] = def.id;
    });
    // Add lettuce explicitly
    mapping['🥬'] = 'lettuce';
    return mapping;
  }, [emojiCatalog]);

  const handleBackToHub = () => {
    setCurrentScreen('hub');
  };

  const handleOpenFlappyLettuce = () => {
    setCurrentScreen('flappy-lettuce');
  };

  const handleOpenLettuceSlicer = () => {
    setCurrentScreen('lettuce-slicer');
  };

  const handleOpenLettuceHop = () => {
    setCurrentScreen('lettuce-hop');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {currentScreen === 'hub' ? (
          <View style={styles.hubContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Games Arcade</Text>
              <Pressable
                style={styles.closeButton}
                onPress={onRequestClose}
                accessibilityLabel="Close Games Arcade"
              >
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Play with your emoji collection
            </Text>
            <ScrollView 
              style={styles.gamesList}
              contentContainerStyle={styles.gamesListContent}
              showsVerticalScrollIndicator
            >
              <Pressable
                style={({ pressed }) => [
                  styles.gameCard,
                  pressed && styles.gameCardPressed,
                ]}
                onPress={handleOpenFlappyLettuce}
                accessibilityRole="button"
                accessibilityLabel="Play Flappy Lettuce"
              >
                <View style={styles.gameIconContainer}>
                  <Text style={styles.gameIcon}>🥬</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>Flappy Lettuce</Text>
                  <Text style={styles.gameDescription}>
                    Tap to flap through pipes. Use any emoji from your collection!
                  </Text>
                </View>
                <Text style={styles.gameChevron}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.gameCard,
                  !hasPremiumUpgrade && styles.gameCardLocked,
                  pressed && hasPremiumUpgrade && styles.gameCardPressed,
                ]}
                onPress={hasPremiumUpgrade ? handleOpenLettuceSlicer : onPurchasePremium}
                accessibilityRole="button"
                accessibilityLabel={hasPremiumUpgrade ? "Play Lettuce Slicer" : "Unlock Lettuce Slicer with Premium"}
              >
                {!hasPremiumUpgrade && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                )}
                <View style={[styles.gameIconContainer, !hasPremiumUpgrade && styles.gameIconLocked]}>
                  <Text style={styles.gameIcon}>🔪</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameTitle, !hasPremiumUpgrade && styles.gameTitleLocked]}>
                    Lettuce Slicer {!hasPremiumUpgrade && '🔒'}
                  </Text>
                  <Text style={[styles.gameDescription, !hasPremiumUpgrade && styles.gameDescriptionLocked]}>
                    {hasPremiumUpgrade 
                      ? 'Slice emojis mid-air. Avoid bombs and ghosts!'
                      : 'Upgrade to Premium to unlock'}
                  </Text>
                </View>
                <Text style={styles.gameChevron}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.gameCard,
                  !hasPremiumUpgrade && styles.gameCardLocked,
                  pressed && hasPremiumUpgrade && styles.gameCardPressed,
                ]}
                onPress={hasPremiumUpgrade ? handleOpenLettuceHop : onPurchasePremium}
                accessibilityRole="button"
                accessibilityLabel={hasPremiumUpgrade ? "Play Lettuce Hop" : "Unlock Lettuce Hop with Premium"}
              >
                {!hasPremiumUpgrade && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                )}
                <View style={[styles.gameIconContainer, !hasPremiumUpgrade && styles.gameIconLocked]}>
                  <Text style={styles.gameIcon}>🦘</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameTitle, !hasPremiumUpgrade && styles.gameTitleLocked]}>
                    Lettuce Hop {!hasPremiumUpgrade && '🔒'}
                  </Text>
                  <Text style={[styles.gameDescription, !hasPremiumUpgrade && styles.gameDescriptionLocked]}>
                    {hasPremiumUpgrade
                      ? 'Hop up platforms and reach new heights! Avoid bombs and use rockets.'
                      : 'Upgrade to Premium to unlock'}
                  </Text>
                </View>
                <Text style={styles.gameChevron}>›</Text>
              </Pressable>

              {/* Premium Paywall Card */}
              {!hasPremiumUpgrade && (
                <View style={styles.premiumPaywallCard}>
                  <Text style={styles.paywallCardIcon}>⭐</Text>
                  <Text style={styles.paywallCardTitle}>Upgrade to Premium</Text>
                  <Text style={styles.paywallCardDescription}>
                    Unlock all games in the arcade and enjoy unlimited fun!
                  </Text>
                  <Pressable 
                    style={styles.upgradePremiumButton}
                    onPress={onPurchasePremium}
                  >
                    <Text style={styles.upgradePremiumText}>Upgrade Now</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        ) : currentScreen === 'flappy-lettuce' ? (
          <FlappyLettuceGame
            onBack={handleBackToHub}
            emojiInventory={ownedEmojiObjects}
            customEmojiNames={emojiStringToName}
            selectedEmoji={selectedEmoji}
            onEmojiChange={setSelectedEmoji}
          />
        ) : currentScreen === 'lettuce-slicer' ? (
          <LettuceSlicerGame
            onBack={handleBackToHub}
            ownedEmojis={ownedEmojiObjects}
            emojiStringToId={emojiStringToId}
          />
        ) : currentScreen === 'lettuce-hop' ? (
          <LettuceHopGame
            onBack={handleBackToHub}
            emojiInventory={ownedEmojiObjects}
            customEmojiNames={emojiStringToName}
            selectedEmoji={selectedEmoji}
            onEmojiChange={setSelectedEmoji}
            hasPremiumUpgrade={hasPremiumUpgrade}
            onPurchasePremium={onPurchasePremium}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Coming Soon!</Text>
            <Pressable style={styles.backButton} onPress={handleBackToHub}>
              <Text style={styles.backButtonText}>← Back to Games</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  hubContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#065f46',
    letterSpacing: -0.5,
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  subtitle: {
    fontSize: 16,
    color: '#047857',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  gamesList: {
    flex: 1,
  },
  gamesListContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#86efac',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gameCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameCardLocked: {
    opacity: 0.7,
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  lockIcon: {
    fontSize: 40,
  },
  gameIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  gameIconLocked: {
    opacity: 0.5,
  },
  gameIcon: {
    fontSize: 36,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  gameTitleLocked: {
    color: '#9ca3af',
  },
  gameDescription: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  gameDescriptionLocked: {
    color: '#9ca3af',
  },
  gameChevron: {
    fontSize: 28,
    color: '#86efac',
    marginLeft: 8,
  },
  comingSoonBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 30,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#86efac',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  // Premium Paywall Card
  premiumPaywallCard: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  paywallCardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  paywallCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 12,
  },
  paywallCardDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  upgradePremiumButton: {
    backgroundColor: '#fbbf24',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  upgradePremiumText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
});

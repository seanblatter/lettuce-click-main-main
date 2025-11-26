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
import type { EmojiDefinition } from '@/context/GameContext';

interface GamesHubProps {
  visible: boolean;
  onRequestClose: () => void;
  emojiInventory: Record<string, boolean>;
  emojiCatalog: EmojiDefinition[];
  customEmojiNames: Record<string, string>;
}

type GameScreen = 'hub' | 'flappy-lettuce' | 'lettuce-slicer' | 'lettuce-dash';

interface EmojiItem {
  emoji: string;
  imageUrl?: string;
  name?: string;
}

export function GamesHub({ visible, onRequestClose, emojiInventory, emojiCatalog, customEmojiNames }: GamesHubProps) {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('hub');
  const [selectedEmoji, setSelectedEmoji] = useState<EmojiItem>({ emoji: '🥬' });

  // Get list of owned emoji objects (with imageUrl for blended emojis)
  const ownedEmojiObjects = useMemo(() => {
    const owned = Object.keys(emojiInventory).filter(id => emojiInventory[id]);
    const emojis: EmojiItem[] = owned.map(id => {
      const def = emojiCatalog.find(e => e.id === id);
      if (!def) return null;
      return {
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
          emoji: e.emoji,
          imageUrl: e.imageUrl,
          name: e.name,
        }));
      return [{ emoji: '🥬' }, ...recentEmojis];
    }
    
    if (!emojis.find(e => e.emoji === '🥬')) {
      emojis.unshift({ emoji: '🥬' });
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

  const handleBackToHub = () => {
    setCurrentScreen('hub');
  };

  const handleOpenFlappyLettuce = () => {
    setCurrentScreen('flappy-lettuce');
  };

  const handleOpenLettuceSlicer = () => {
    setCurrentScreen('lettuce-slicer');
  };

  const handleOpenLettuceDash = () => {
    // Placeholder for future game
    setCurrentScreen('lettuce-dash');
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
                  pressed && styles.gameCardPressed,
                ]}
                onPress={handleOpenLettuceSlicer}
                accessibilityRole="button"
                accessibilityLabel="Play Lettuce Slicer"
              >
                <View style={styles.gameIconContainer}>
                  <Text style={styles.gameIcon}>🔪</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>Lettuce Slicer</Text>
                  <Text style={styles.gameDescription}>
                    Slice emojis mid-air. Avoid bombs and ghosts!
                  </Text>
                </View>
                <Text style={styles.gameChevron}>›</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.gameCard,
                  styles.gameCardDisabled,
                  pressed && styles.gameCardPressed,
                ]}
                onPress={handleOpenLettuceDash}
                accessibilityRole="button"
                accessibilityLabel="Lettuce Dash (Coming Soon)"
              >
                <View style={styles.gameIconContainer}>
                  <Text style={styles.gameIcon}>🏃</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>Lettuce Dash</Text>
                  <Text style={styles.gameDescription}>
                    Coming soon! An endless runner adventure.
                  </Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Soon</Text>
                </View>
              </Pressable>
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
  gameIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
  gameDescription: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
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
});

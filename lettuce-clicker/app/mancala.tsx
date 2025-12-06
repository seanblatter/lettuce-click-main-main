import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import MancalaGame from '@/components/MancalaGame';
import { useGame } from '@/context/GameContext';

export default function MancalaScreen() {
  const router = useRouter();
  const gameContext = useGame();
  
  if (!gameContext) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.debug}>
          <ThemedText type="title">Error</ThemedText>
          <ThemedText>Game context not available</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const { emojiInventory, emojiCatalog, customEmojiNames } = gameContext;
  
  const wallet = React.useMemo(() => {
    if (!emojiInventory || !emojiCatalog) return [];
    
    const owned = Object.keys(emojiInventory).filter(id => emojiInventory[id]);
    const items = owned.map(id => {
      const def = emojiCatalog.find(e => e.id === id);
      if (!def) return null;
      return { id: def.id, emoji: def.emoji, name: customEmojiNames?.[id] || def.name };
    }).filter(Boolean) as { id?: string; emoji: string; name?: string }[];

    if (items.length === 0) {
      return [
        { id: 'lettuce', emoji: '🥬', name: 'Lettuce' },
        { id: 'sprout', emoji: '🌱', name: 'Sprout' },
        { id: 'drop', emoji: '💧', name: 'Drop' },
        { id: 'clover', emoji: '🍀', name: 'Clover' },
        { id: 'herb', emoji: '🌿', name: 'Herb' },
      ];
    }

    if (!items.find(e => e.emoji === '🥬')) {
      items.unshift({ id: 'lettuce', emoji: '🥬', name: 'Lettuce' });
    }
    return items;
  }, [emojiInventory, emojiCatalog, customEmojiNames]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <MancalaGame wallet={wallet} onBack={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0fdf4' },
  container: { padding: 16, paddingBottom: 100 },
  debug: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});

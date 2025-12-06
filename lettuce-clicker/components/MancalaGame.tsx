import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Pressable, Image, Animated } from 'react-native';
import { fetchEmojiKitchenMash } from '@/lib/emojiKitchenService';
import { useGame } from '@/context/GameContext';

type EmojiItem = { id?: string; emoji: string; name?: string; imageUrl?: string };
type Seed = { id: string; emoji?: string; imageUrl?: string; position: Animated.ValueXY };

const initialSeedsPerPit = 4;

function createInitialBoard(): number[] {
  const b = new Array(14).fill(0);
  for (let i = 0; i < 6; i++) b[i] = initialSeedsPerPit;
  for (let i = 7; i < 13; i++) b[i] = initialSeedsPerPit;
  return b;
}

function isPlayerPit(index: number, player: 1|2) { return player === 1 ? index >= 0 && index <= 5 : index >= 7 && index <= 12; }
function storeIndex(player: 1|2) { return player === 1 ? 6 : 13; }
function nextIndex(i: number): number { return (i + 1) % 14; }
function otherPlayer(p: 1|2): 2|1 { return p === 1 ? 2 : 1; }

function cpuChooseMove(board: number[]): number | null {
  let bestPit: number | null = null;
  let bestSeeds = -1;
  for (let i = 7; i <= 12; i++) {
    if (board[i] > 0) { if (board[i] > bestSeeds) { bestSeeds = board[i]; bestPit = i; } }
  }
  return bestPit;
}

type MancalaGameProps = { onBack?: () => void; wallet: EmojiItem[] };

export const MancalaGame: React.FC<MancalaGameProps> = ({ onBack, wallet }) => {
  const gameContext = useGame();
  const [board, setBoard] = useState<number[]>(createInitialBoard());
  const [turn, setTurn] = useState<1|2>(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [marbles, setMarbles] = useState<EmojiItem[]>([{ emoji: '🥬' }, { emoji: '🌱' }, { emoji: '💧' }]);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);
  const [blendedEmojis, setBlendedEmojis] = useState<EmojiItem[]>([]);
  const [isBlendingLoading, setIsBlendingLoading] = useState(false);
  const [playerMarbles, setPlayerMarbles] = useState<EmojiItem[]>([]);

  // Generate blended emojis only when picker is opened
  useEffect(() => {
    if (selectingSlot === null) return;
    if (blendedEmojis.length > 0) return; // Already loaded
    
    const generateBlended = async () => {
      if (wallet.length < 2) return;
      setIsBlendingLoading(true);
      try {
        const blended: EmojiItem[] = [];
        // Generate a few blended combinations
        for (let i = 0; i < Math.min(3, wallet.length - 1); i++) {
          const e1 = wallet[i];
          const e2 = wallet[(i + 1) % wallet.length];
          if (e1.emoji && e2.emoji) {
            const mash = await fetchEmojiKitchenMash(e1.emoji, e2.emoji);
            blended.push({
              emoji: e1.emoji,
              imageUrl: mash.imageUrl,
              name: `${e1.name || e1.emoji} + ${e2.name || e2.emoji}`,
            });
          }
        }
        setBlendedEmojis(blended);
      } catch (err) {
        // Silently fail if blending doesn't work
      } finally {
        setIsBlendingLoading(false);
      }
    };
    generateBlended();
  }, [selectingSlot, wallet, blendedEmojis]);

  const allEmpty = (start: number, end: number, b: number[]) => { for (let i = start; i <= end; i++) if (b[i] !== 0) return false; return true; };

  const checkGameOver = (b: number[]) => {
    const p1Empty = allEmpty(0,5,b);
    const p2Empty = allEmpty(7,12,b);
    if (p1Empty || p2Empty) {
      let sumP1 = 0, sumP2 = 0;
      for (let i = 0; i <= 5; i++) { sumP1 += b[i]; b[i] = 0; }
      for (let i = 7; i <= 12; i++) { sumP2 += b[i]; b[i] = 0; }
      b[6] += sumP1; b[13] += sumP2;
      setGameOver(true);
      setBoard([...b]);
      const playerWon = b[6] > b[13];
      const result = b[6] === b[13] ? 'Draw!' : (playerWon ? 'You win!' : 'CPU wins');
      
      // Update stats for all player marbles if they won
      if (playerWon && gameContext?.updateCheckersEmojiStats) {
        playerMarbles.forEach(marble => {
          if (marble.id) {
            gameContext.updateCheckersEmojiStats(marble.id, true);
          }
        });
      }
      
      Alert.alert('Game Over', `${result}\nYou: ${b[6]} • CPU: ${b[13]}`);
      return true;
    }
    return false;
  };

  const sowFromPit = (startPit: number, player: 1|2) => {
    const b = [...board];
    let seeds = b[startPit];
    if (!isPlayerPit(startPit, player) || seeds === 0) return false;
    b[startPit] = 0;
    let idx = startPit;
    while (seeds > 0) {
      idx = nextIndex(idx);
      if (idx === storeIndex(otherPlayer(player))) continue;
      b[idx] += 1; seeds -= 1;
    }
    if (isPlayerPit(idx, player) && b[idx] === 1) {
      const opposite = 12 - idx;
      const captured = b[opposite];
      if (captured > 0) { b[opposite] = 0; b[idx] = 0; b[storeIndex(player)] += captured + 1; }
    }
    setBoard(b);
    if (idx === storeIndex(player)) { setTurn(player); } else { if (!checkGameOver(b)) setTurn(otherPlayer(player)); }
    return true;
  };

  const onPlayerPitPress = (pit: number) => {
    if (gameOver || turn !== 1) return;
    const moved = sowFromPit(pit, 1);
    if (moved) {
      setTimeout(() => {
        const currentBoardState = board;
        const cpuPit = cpuChooseMove(currentBoardState);
        if (cpuPit !== null && !gameOver) sowFromPit(cpuPit, 2);
      }, 350);
    }
  };

  const openEmojiPicker = (slot: number) => { setSelectingSlot(slot); };
  const chooseEmoji = (emoji: EmojiItem) => {
    if (selectingSlot === null) return;
    const next = [...marbles];
    next[selectingSlot] = emoji;
    setMarbles(next);
    setSelectingSlot(null);
  };

  const renderSeed = (count: number) => {
    // Randomly shuffle which marble to use
    const items: React.ReactNode[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const randomIdx = Math.floor(Math.random() * marbles.length);
      const choice = marbles[randomIdx];
      const content = choice.imageUrl ? (
        <Image key={`${i}-${randomIdx}`} source={{ uri: choice.imageUrl }} style={styles.seedImage} />
      ) : (
        <Text key={`${i}-${randomIdx}`} style={styles.seed}>{choice.emoji}</Text>
      );
      items.push(content);
    }
    if (count > 5) items.push(<Text key={'+'} style={styles.seed}>+{count-5}</Text>);
    return <View style={styles.seedRow}>{items}</View>;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Lettuce Mancala</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {!started ? (
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Text style={styles.setupTitle}>Pick Your Marbles</Text>
          <Text style={styles.setupSubtitle}>Choose 3 emojis from your wallet</Text>

          {/* Character vs Display */}
          <View style={styles.characterVsContainer}>
            <View style={styles.characterBox}>
              <Text style={styles.characterLabel}>Your Marbles</Text>
              <View style={styles.marbleRow}>
                {marbles.map((m, idx) => (
                  <Text key={idx} style={styles.marbleDisplay}>{m.emoji}</Text>
                ))}
              </View>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.characterBox}>
              <Text style={styles.characterLabel}>CPU Marbles</Text>
              <View style={styles.marbleRow}>
                {marbles.map((m, idx) => (
                  <Text key={`cpu-${idx}`} style={styles.marbleDisplay}>{m.emoji}</Text>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.choicesRow}>
            {marbles.map((c, i) => (
              <TouchableOpacity key={i} style={styles.choiceBtn} onPress={() => openEmojiPicker(i)}>
                <Text style={styles.choiceText}>{c.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectingSlot !== null && (
            <View style={styles.pickerPanel}>
              <Text style={styles.pickerTitle}>Pick an emoji</Text>
              <View style={styles.walletGrid}>
                {wallet.map((e, idx) => (
                  <TouchableOpacity key={`wallet-${idx}`} style={styles.walletItem} onPress={() => chooseEmoji(e)}>
                    {e.imageUrl ? (
                      <Image source={{ uri: e.imageUrl }} style={styles.walletImage} />
                    ) : (
                      <Text style={styles.walletEmoji}>{e.emoji}</Text>
                    )}
                    <Text style={styles.walletName}>{e.name || ''}</Text>
                  </TouchableOpacity>
                ))}
                {blendedEmojis.map((e, idx) => (
                  <TouchableOpacity key={`blended-${idx}`} style={styles.walletItem} onPress={() => chooseEmoji(e)}>
                    {e.imageUrl ? (
                      <Image source={{ uri: e.imageUrl }} style={styles.walletImage} />
                    ) : (
                      <Text style={styles.walletEmoji}>{e.emoji}</Text>
                    )}
                    <Text style={[styles.walletName, { fontSize: 9 }]}>Blended</Text>
                  </TouchableOpacity>
                ))}
                {isBlendingLoading && (
                  <View style={styles.walletItem}>
                    <Text style={styles.walletEmoji}>✨</Text>
                    <Text style={[styles.walletName, { fontSize: 9 }]}>Loading...</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.startButton} onPress={() => { setPlayerMarbles(marbles); setStarted(true); setBoard(createInitialBoard()); setTurn(1); setGameOver(false); }}>
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.gameContainer}>
          <View style={styles.board}>
            <View style={styles.row}>
              {Array.from({ length: 6 }).map((_, idx) => {
                const pit = 12 - idx;
                return (
                  <View key={pit} style={styles.pit}>
                    {renderSeed(board[pit])}
                  </View>
                );
              })}
            </View>

            <View style={styles.middleRow}>
              <View style={styles.store}>{renderSeed(board[13])}</View>
              <View style={{ flex: 1 }} />
              <View style={styles.store}>{renderSeed(board[6])}</View>
            </View>

            <View style={styles.row}>
              {Array.from({ length: 6 }).map((_, idx) => {
                const pit = idx;
                return (
                  <TouchableOpacity key={pit} style={styles.pit} onPress={() => onPlayerPitPress(pit)}>
                    {renderSeed(board[pit])}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.gameFooter}>
            <Text style={styles.turnText}>Turn: {turn === 1 ? 'You' : 'CPU'}</Text>
            <View style={styles.footerButtons}>
              <TouchableOpacity style={styles.button} onPress={() => { setBoard(createInitialBoard()); setTurn(1); setGameOver(false); }}>
                <Text style={styles.buttonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => { setStarted(false); }}>
                <Text style={styles.buttonText}>End</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0fdf4' },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#065f46' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#065f46' },
  headerSpacer: { width: 60 },
  setupContainer: { padding: 16, gap: 16 },
  setupTitle: { fontSize: 28, fontWeight: '700', color: '#065f46', textAlign: 'center' },
  setupSubtitle: { fontSize: 16, color: '#047857', textAlign: 'center' },
  characterVsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 16, paddingHorizontal: 12, paddingVertical: 16, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#86efac' },
  characterBox: { flex: 1, alignItems: 'center', gap: 8 },
  characterLabel: { fontSize: 12, fontWeight: '600', color: '#065f46' },
  marbleRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  marbleDisplay: { fontSize: 24 },
  vsText: { fontSize: 20, fontWeight: '700', color: '#065f46' },
  choicesRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  choiceBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#86efac' },
  choiceText: { fontSize: 20 },
  pickerPanel: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: '#065f46', marginBottom: 8 },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  walletItem: { flex: 1, minWidth: 80, padding: 8, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac' },
  walletEmoji: { fontSize: 24, marginBottom: 4 },
  walletName: { fontSize: 11, color: '#047857', textAlign: 'center' },
  startButton: { marginTop: 12, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#86efac', borderWidth: 2, borderColor: '#22c55e' },
  startButtonText: { fontWeight: '700', fontSize: 16, color: '#065f46' },
  gameContainer: { flex: 1, padding: 12 },
  board: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#86efac' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pit: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#86efac', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' },
  middleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  store: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#22c55e', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5' },
  seedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  seed: { fontSize: 14 },
  seedImage: { width: 14, height: 14, marginHorizontal: 1 },
  walletImage: { width: 28, height: 28, marginBottom: 4 },
  gameFooter: { paddingVertical: 12, gap: 8 },
  turnText: { fontSize: 14, fontWeight: '600', color: '#065f46', textAlign: 'center' },
  footerButtons: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  buttonText: { fontWeight: '600', color: '#065f46' },
});

export default MancalaGame;

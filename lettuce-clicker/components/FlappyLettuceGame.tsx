import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { fetchEmojiKitchenMash } from '@/lib/emojiKitchenService';

interface EmojiItem {
  id?: string;
  emoji: string;
  imageUrl?: string;
  name?: string;
}

interface FlappyLettuceGameProps {
  onBack: () => void;
  emojiInventory: EmojiItem[];
  customEmojiNames: Record<string, string>;
  selectedEmoji: EmojiItem;
  onEmojiChange: (emoji: EmojiItem) => void;
}

interface Pipe {
  id: number;
  x: number;
  gapY: number;
  scored?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BIRD_SIZE = 50;
const PIPE_WIDTH = 60;
const PIPE_GAP = 250; // Increased from 200 to make it easier
const GRAVITY = 0.5; // Reduced from 0.6 for slower fall
const JUMP_VELOCITY = -10; // Less negative (weaker jump) from -12
const PIPE_SPEED = 2.5; // Slower from 3
const GAME_HEIGHT = SCREEN_HEIGHT - 200; // Leave room for UI

export function FlappyLettuceGame({
  onBack,
  emojiInventory,
  customEmojiNames,
  selectedEmoji,
  onEmojiChange,
}: FlappyLettuceGameProps) {
  const { updateFlappyEmojiStats, registerCustomEmoji, grantEmojiUnlock, emojiCatalog } = useGame();
  const [gameState, setGameState] = useState<'select' | 'ready' | 'playing' | 'gameOver'>('select');
  const [score, setScore] = useState(0);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [bonusPosition, setBonusPosition] = useState<{ x: number; y: number } | null>(null);
  const bonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(true);
  const milestonePreviewedRef = useRef<Set<number>>(new Set());
  
  // Flappy Lettuce reward state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardEmoji, setRewardEmoji] = useState<{ emoji: string; name: string; imageUrl?: string } | null>(null);
  const [rewardEmojiId, setRewardEmojiId] = useState<string | null>(null);
  const [rewardGrantedForGame, setRewardGrantedForGame] = useState(false);

  // Bird physics
  const birdY = useRef(GAME_HEIGHT / 2 - BIRD_SIZE / 2);
  const [birdYPosition, setBirdYPosition] = useState(GAME_HEIGHT / 2 - BIRD_SIZE / 2);
  const birdVelocity = useRef(0);
  const birdRotation = useRef(new Animated.Value(0)).current;

  // Pipes
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const pipeIdCounter = useRef(0);

  // Game loop
  const gameLoopRef = useRef<any>(null);
  const lastPipeX = useRef(SCREEN_WIDTH);
  const scoredPipes = useRef<Set<number>>(new Set());

  // Animation refs
  const backgroundScroll = useRef(new Animated.Value(0)).current;

  const resetGame = useCallback(() => {
    birdY.current = GAME_HEIGHT / 2 - BIRD_SIZE / 2;
    setBirdYPosition(GAME_HEIGHT / 2 - BIRD_SIZE / 2);
    birdVelocity.current = 0;
    birdRotation.setValue(0);
    setPipes([]);
    setScore(0);
    pipeIdCounter.current = 0;
    lastPipeX.current = SCREEN_WIDTH;
    scoredPipes.current.clear();
    setRewardGrantedForGame(false);
    // Clear reward states so we can generate new ones on next win
    setRewardEmoji(null);
    setRewardEmojiId(null);
    setShowRewardModal(false);
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, [birdRotation]);

  const jump = useCallback(() => {
    if (gameState === 'ready') {
      setGameState('playing');
    }
    if (gameState === 'playing' || gameState === 'ready') {
      birdVelocity.current = JUMP_VELOCITY;
      
      // Animate bird rotation
      Animated.sequence([
        Animated.timing(birdRotation, {
          toValue: -20,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(birdRotation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [gameState, birdRotation]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('ready');
  }, [resetGame]);

  const handleEmojiSelect = useCallback((emojiItem: EmojiItem) => {
    onEmojiChange(emojiItem);
    // Don't close picker or start game yet - wait for Start button
  }, [onEmojiChange]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    gameLoopRef.current = setInterval(() => {
      // Update bird position
      birdVelocity.current += GRAVITY;
      const currentY = birdY.current;
      const newY = currentY + birdVelocity.current;

      birdY.current = newY;
      setBirdYPosition(newY);

      // Check ground and ceiling collision
      if (newY <= 0 || newY >= GAME_HEIGHT - BIRD_SIZE) {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
          gameLoopRef.current = null;
        }
        setGameState('gameOver');
        return;
      }

      // Update pipes
      setPipes((prevPipes) => {
        const updatedPipes = prevPipes
          .map((pipe) => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
          .filter((pipe) => pipe.x > -PIPE_WIDTH);

        // Check collision with pipes
        const birdX = 80;
        const birdBottom = newY + BIRD_SIZE;
        const birdTop = newY;

        for (const pipe of updatedPipes) {
          // Show upcoming milestone bonus ahead of the player
          // If next point will reach a multiple of 10, preview on this next pipe before passing
          if (
            !scoredPipes.current.has(pipe.id) &&
            !milestonePreviewedRef.current.has(pipe.id) &&
            score % 10 === 9 &&
            pipe.x + PIPE_WIDTH > birdX && // pipe is ahead
            pipe.x < SCREEN_WIDTH // within viewport
          ) {
            const centerX = pipe.x + PIPE_WIDTH / 2;
            const centerY = pipe.gapY + PIPE_GAP / 2;
            setBonusMessage(`+${Math.floor(Math.random() * 4) + 2}`);
            setBonusPosition({ x: centerX, y: centerY });
            milestonePreviewedRef.current.add(pipe.id);
          }

          // Check if passed pipe for scoring (bird has passed the pipe)
          if (birdX > pipe.x + PIPE_WIDTH && !scoredPipes.current.has(pipe.id)) {
            scoredPipes.current.add(pipe.id);
            setScore((prev) => {
              const next = prev + 1;
              if (next > 0 && next % 10 === 0) {
                const bonus = parseInt((bonusMessage || '').replace('+', ''), 10) || (Math.floor(Math.random() * 4) + 2); // use previewed bonus if available
                const total = next + bonus;
                // Show bonus message centered on current pipe gap
                // Keep existing preview position/message; just ensure timer cleanup
                if (bonusTimerRef.current) {
                  clearTimeout(bonusTimerRef.current);
                }
                bonusTimerRef.current = setTimeout(() => {
                  setBonusMessage(null);
                  setBonusPosition(null);
                }, 1500);
                return total;
              }
              return next;
            });
          }

          // Check collision while bird is overlapping with pipe
          if (
            birdX + BIRD_SIZE > pipe.x &&
            birdX < pipe.x + PIPE_WIDTH
          ) {
            const pipeTopBottom = pipe.gapY;
            const pipeBottomTop = pipe.gapY + PIPE_GAP;

            if (birdTop < pipeTopBottom || birdBottom > pipeBottomTop) {
              if (gameLoopRef.current) {
                clearInterval(gameLoopRef.current);
                gameLoopRef.current = null;
              }
              setGameState('gameOver');
              return prevPipes;
            }
          }
        }

        return updatedPipes;
      });

      // Add new pipes
      lastPipeX.current -= PIPE_SPEED;
      if (lastPipeX.current < SCREEN_WIDTH - 250) {
        const minGapY = 100;
        const maxGapY = GAME_HEIGHT - PIPE_GAP - 100;
        const gapY = Math.random() * (maxGapY - minGapY) + minGapY;

        setPipes((prev) => [
          ...prev,
          {
            id: pipeIdCounter.current++,
            x: SCREEN_WIDTH,
            gapY,
          },
        ]);
        lastPipeX.current = SCREEN_WIDTH;
      }
    }, 1000 / 60); // 60 FPS

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState]);

  // Load high score on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('flappy_lettuce_high_score');
        if (stored) setHighScore(parseInt(stored, 10) || 0);
      } catch {}
    })();
  }, []);

  // Update and persist high score
  useEffect(() => {
    if (gameState === 'gameOver' && score > 0) {
      // Update emoji-specific stats
      const emojiId = selectedEmoji.id || selectedEmoji.emoji;
      updateFlappyEmojiStats(emojiId, score, true);
      
      // Update global high score
      if (score > highScore) {
        setHighScore(score);
        AsyncStorage.setItem('flappy_lettuce_high_score', String(score)).catch(() => {});
      }
    }
  }, [gameState, score, highScore, selectedEmoji, updateFlappyEmojiStats]);

  // Handle reward modal - guaranteed blended emoji at 5+ points (testing)
  useEffect(() => {
    console.log('[Flappy Reward] Effect conditions:', {
      gameState,
      score,
      rewardGrantedForGame,
      shouldTrigger: gameState === 'gameOver' && score >= 5 && !rewardGrantedForGame,
    });
    
    if (gameState !== 'gameOver' || score < 5 || rewardGrantedForGame) {
      return;
    }

    console.log('[Flappy Reward] Game over with score', score, '- triggering reward');

    const grantReward = async () => {
      const baseEmojis = emojiCatalog.filter(e => !e.id.startsWith('custom-'));
      if (baseEmojis.length < 2) {
        console.warn('[Flappy Reward] Not enough base emojis');
        setRewardGrantedForGame(true);
        return;
      }

      let foundBlend = false;
      let attemptCount = 0;
      const maxAttempts = 50;

      while (!foundBlend && attemptCount < maxAttempts) {
        try {
          const emoji1 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
          let emoji2 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
          
          let diffAttempts = 0;
          while (emoji2.id === emoji1.id && diffAttempts < 3) {
            emoji2 = baseEmojis[Math.floor(Math.random() * baseEmojis.length)];
            diffAttempts++;
          }

          console.log(`[Flappy Reward] Attempt ${attemptCount + 1}: Blending ${emoji1.emoji} + ${emoji2.emoji}`);
          const result = await fetchEmojiKitchenMash(emoji1.emoji, emoji2.emoji);
          const compositeEmoji = `${emoji1.emoji}${emoji2.emoji}`;
          
          console.log(`[Flappy Reward] ✅ Got blend! Image URL:`, result.imageUrl);
          console.log(`[Flappy Reward] URL type:`, typeof result.imageUrl, 'is string:', typeof result.imageUrl === 'string');
          
          // Validate the URL before using it
          if (!result.imageUrl || typeof result.imageUrl !== 'string' || result.imageUrl.trim() === '') {
            console.error(`[Flappy Reward] ❌ Invalid image URL from blend:`, result.imageUrl);
            attemptCount++;
            continue;
          }
          
          const blendedDef = registerCustomEmoji(compositeEmoji, {
            name: `${emoji1.name} & ${emoji2.name}`,
            costOverride: 0,
            imageUrl: result.imageUrl,
            tags: ['flappy lettuce reward', 'blend'],
          });
          
          if (blendedDef && blendedDef.imageUrl) {
            console.log(`[Flappy Reward] Blended definition created:`, blendedDef.id);
            console.log(`[Flappy Reward] Setting reward state with image URL:`, blendedDef.imageUrl);
            setRewardEmoji({ 
              emoji: compositeEmoji, 
              name: blendedDef.name,
              imageUrl: blendedDef.imageUrl,
            });
            setRewardEmojiId(blendedDef.id);
            console.log(`[Flappy Reward] About to set showRewardModal to true`);
            setShowRewardModal(true);
            foundBlend = true;
          }
        } catch (error) {
          console.warn(`[Flappy Reward] Blend attempt ${attemptCount + 1} failed:`, error);
          attemptCount++;
        }
      }

      setRewardGrantedForGame(true);
    };

    grantReward();
  }, [gameState, score, emojiCatalog, registerCustomEmoji, rewardGrantedForGame]);

  // Background scroll animation
  useEffect(() => {
    let scrollAnimation: Animated.CompositeAnimation | null = null;
    
    if (gameState === 'playing') {
      scrollAnimation = Animated.loop(
        Animated.timing(backgroundScroll, {
          toValue: -SCREEN_WIDTH,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      scrollAnimation.start();
    } else {
      backgroundScroll.setValue(0);
    }
    
    return () => {
      if (scrollAnimation) {
        scrollAnimation.stop();
      }
    };
  }, [gameState, backgroundScroll]);

  const birdRotationStyle = birdRotation.interpolate({
    inputRange: [-20, 0, 20],
    outputRange: ['-20deg', '0deg', '20deg'],
  });

  // Get available emojis
  const availableEmojis: EmojiItem[] = emojiInventory && emojiInventory.length > 0 
    ? emojiInventory
    : [{ emoji: '🥬' }];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Flappy Lettuce</Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreText}>{score}</Text>
          {/* Keep header static; no bonus badge here to avoid layout shift */}
        </View>
      </View>

      {/* Game Canvas */}
      <View style={styles.gameContainer}>
        <Pressable style={styles.gameCanvas} onPress={jump}>
          {/* Background - sky with clouds and buildings */}
          <View style={styles.background}>
            {/* Clouds */}
            <View style={[styles.cloud, { top: 40, left: 50 }]}>
              <Text style={styles.cloudEmoji}>☁️</Text>
            </View>
            <View style={[styles.cloud, { top: 100, left: 200 }]}>
              <Text style={styles.cloudEmoji}>☁️</Text>
            </View>
            <View style={[styles.cloud, { top: 60, right: 80 }]}>
              <Text style={styles.cloudEmoji}>☁️</Text>
            </View>
            
            {/* Buildings at bottom */}
            <View style={styles.buildingsContainer}>
              <View style={[styles.building, { height: 100, backgroundColor: '#DED895' }]} />
              <View style={[styles.building, { height: 140, backgroundColor: '#E8C170' }]} />
              <View style={[styles.building, { height: 120, backgroundColor: '#DED895' }]} />
              <View style={[styles.building, { height: 160, backgroundColor: '#E8C170' }]} />
              <View style={[styles.building, { height: 110, backgroundColor: '#DED895' }]} />
              <View style={[styles.building, { height: 130, backgroundColor: '#E8C170' }]} />
              <View style={[styles.building, { height: 115, backgroundColor: '#DED895' }]} />
            </View>
          </View>

          {/* Pipes */}
          {pipes.map((pipe) => (
            <View key={pipe.id}>
              {/* Top pipe */}
              <View
                style={[
                  styles.pipe,
                  styles.pipeTop,
                  {
                    left: pipe.x,
                    height: pipe.gapY,
                  },
                ]}
              />
              {/* Bottom pipe */}
              <View
                style={[
                  styles.pipe,
                  styles.pipeBottom,
                  {
                    left: pipe.x,
                    top: pipe.gapY + PIPE_GAP,
                    height: GAME_HEIGHT - pipe.gapY - PIPE_GAP,
                  },
                ]}
              />
            </View>
          ))}

          {/* Milestone bonus badge at pipe gap center */}
          {bonusMessage && bonusPosition && (
            <View
              style={[
                styles.bonusBadge,
                {
                  left: bonusPosition.x - 30,
                  top: bonusPosition.y - 16,
                },
              ]}
            >
              <Text style={styles.bonusText}>{bonusMessage}</Text>
            </View>
          )}

          {/* Bird */}
          {gameState !== 'select' && (
            <Animated.View
              style={[
                styles.bird,
                {
                  top: birdYPosition,
                  transform: [{ rotate: birdRotationStyle }],
                },
              ]}
            >
              {selectedEmoji.imageUrl ? (
                <ExpoImage
                  source={{ uri: selectedEmoji.imageUrl }}
                  style={styles.birdImage}
                  contentFit="contain"
                />
              ) : (
                <Text style={styles.birdEmoji}>{selectedEmoji.emoji}</Text>
              )}
            </Animated.View>
          )}

          {/* Overlays */}
          {gameState === 'select' && !showEmojiPicker && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>Choose Your Character</Text>
              <Pressable
                style={styles.selectEmojiButton}
                onPress={() => setShowEmojiPicker(true)}
              >
                {selectedEmoji.imageUrl ? (
                  <ExpoImage
                    source={{ uri: selectedEmoji.imageUrl }}
                    style={{ width: 50, height: 50 }}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.selectEmojiEmoji}>{selectedEmoji.emoji}</Text>
                )}
                <Text style={styles.selectEmojiText}>Tap to Choose</Text>
              </Pressable>
            </View>
          )}

          {gameState === 'ready' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>Tap to Start!</Text>
              <Text style={styles.overlaySubtitle}>Tap anywhere to flap</Text>
            </View>
          )}

          {gameState === 'gameOver' && (
            <View style={styles.overlay}>
              <Text style={styles.gameOverTitle}>Game Over</Text>
              
              <View style={styles.scoreCard}>
                <View style={styles.scoreCardHeader}>
                  <View style={styles.medalSection}>
                    <View style={styles.medalCircle}>
                      {selectedEmoji.imageUrl ? (
                        <ExpoImage
                          source={{ uri: selectedEmoji.imageUrl }}
                          style={styles.medalEmoji}
                          contentFit="contain"
                        />
                      ) : (
                        <Text style={styles.medalEmojiText}>{selectedEmoji.emoji}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.scoresSection}>
                    <View style={styles.scoreCardRow}>
                      <Text style={styles.scoreCardLabel}>SCORE</Text>
                      <Text style={styles.scoreCardValue}>{score}</Text>
                    </View>
                    <View style={styles.scoreCardDivider} />
                    <View style={styles.scoreCardRow}>
                      <Text style={styles.scoreCardLabel}>BEST</Text>
                      <Text style={styles.scoreCardValue}>{highScore}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable style={styles.playAgainButton} onPress={startGame}>
                <Text style={styles.playAgainText}>Play Again</Text>
              </Pressable>
              <Pressable
                style={styles.changeEmojiButton}
                onPress={() => {
                  setGameState('select');
                  setShowEmojiPicker(true);
                }}
              >
                <Text style={styles.changeEmojiText}>Change Character</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </View>

      {/* Emoji Picker - Wallet Style */}
      {showEmojiPicker && (
        <View style={styles.walletContainer}>
          <View style={styles.walletHeader}>
            <Text style={styles.walletTitle}>Select Your Character</Text>
            <Pressable
              style={styles.walletCloseButton}
              onPress={() => {
                setShowEmojiPicker(false);
                startGame();
              }}
            >
              <Text style={styles.walletCloseText}>Start Game</Text>
            </Pressable>
          </View>
          <View style={styles.walletGrid}>
            {availableEmojis.map((emojiItem, index) => {
              const isSelected = emojiItem.emoji === selectedEmoji.emoji;
              const emojiName = customEmojiNames[emojiItem.emoji];
              return (
                <Pressable
                  key={`${emojiItem.emoji}-${index}`}
                  style={[
                    styles.walletSlot,
                    isSelected && styles.walletSlotActive,
                  ]}
                  onPress={() => handleEmojiSelect(emojiItem)}
                >
                  {emojiItem.imageUrl ? (
                    <ExpoImage
                      source={{ uri: emojiItem.imageUrl }}
                      style={styles.walletEmojiImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Text style={styles.walletEmoji}>{emojiItem.emoji}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      
      {/* Flappy Lettuce Reward Modal */}
      <Modal
        visible={showRewardModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRewardModal(false)}
      >
        <View style={styles.rewardModalOverlay}>
          <View style={styles.rewardModalCard}>
            <View style={styles.rewardModalHeader}>
              <Text style={styles.rewardModalIcon}>🎉</Text>
            </View>
            <Text style={styles.rewardModalTitle}>Nice Work!</Text>
            <Text style={styles.rewardModalSubtitle}>You earned a special blended emoji!</Text>
            
            {rewardEmoji && rewardEmoji.imageUrl ? (
              <View style={styles.rewardEmojiContainer}>
                <ExpoImage
                  source={{ uri: rewardEmoji.imageUrl }}
                  style={styles.rewardEmojiImage}
                  contentFit="contain"
                />
                <Text style={styles.rewardEmojiName}>{rewardEmoji.name}</Text>
              </View>
            ) : null}
            
            <View style={{ gap: 12 }}>
              <Pressable
                style={styles.rewardAcceptButton}
                onPress={() => {
                  if (rewardEmojiId) {
                    console.log('[Flappy Reward] Claiming reward emoji:', rewardEmojiId);
                    const granted = grantEmojiUnlock(rewardEmojiId);
                    console.log('[Flappy Reward] Grant result:', granted);
                  } else {
                    console.warn('[Flappy Reward] No reward emoji ID to grant');
                  }
                  setShowRewardModal(false);
                }}
              >
                <Text style={styles.rewardAcceptButtonText}>Claim Emoji</Text>
              </Pressable>
              <Pressable
                style={styles.rewardDeclineButton}
                onPress={() => {
                  console.log('[Flappy Reward] User dismissed reward modal');
                  setShowRewardModal(false);
                }}
              >
                <Text style={styles.rewardDeclineButtonText}>Maybe Later</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default FlappyLettuceGame;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#dcfce7',
    borderBottomWidth: 2,
    borderBottomColor: '#86efac',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#065f46',
  },
  gameContainer: {
    flex: 1,
    padding: 20,
  },
  gameCanvas: {
    flex: 1,
    backgroundColor: '#4ec0ca',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#2d8a8f',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4ec0ca',
  },
  cloud: {
    position: 'absolute',
  },
  cloudEmoji: {
    fontSize: 40,
    opacity: 0.7,
  },
  buildingsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  building: {
    flex: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#C4A66B',
  },
  bird: {
    position: 'absolute',
    left: 80,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birdEmoji: {
    fontSize: 40,
  },
  birdImage: {
    width: 40,
    height: 40,
  },
  pipe: {
    position: 'absolute',
    width: PIPE_WIDTH,
    backgroundColor: '#5BBF40',
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: '#2F6D22',
  },
  pipeTop: {
    top: 0,
  },
  pipeBottom: {
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  overlayTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  gameOverTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  scoreCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
    width: 280,
    borderWidth: 3,
    borderColor: '#8B7355',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    gap: 15,
  },
  medalSection: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F4B41A',
    borderWidth: 3,
    borderColor: '#D89B00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  medalEmoji: {
    width: 40,
    height: 40,
  },
  medalEmojiText: {
    fontSize: 35,
  },
  scoresSection: {
    flex: 1,
  },
  scoreCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreCardLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8B7355',
  },
  scoreCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2F6D22',
  },
  scoreCardDivider: {
    height: 2,
    backgroundColor: '#E5E5E5',
    marginVertical: 12,
  },
  overlaySubtitle: {
    fontSize: 18,
    color: '#d1fae5',
    textAlign: 'center',
  },
  selectEmojiButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    borderWidth: 3,
    borderColor: '#86efac',
  },
  selectEmojiEmoji: {
    fontSize: 80,
    marginBottom: 12,
  },
  selectEmojiText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#065f46',
  },
  finalScore: {
    fontSize: 28,
    fontWeight: '600',
    color: '#d1fae5',
    marginBottom: 8,
  },
  highScoreText: {
    fontSize: 18,
    color: '#a7f3d0',
    marginBottom: 30,
  },
  playAgainButton: {
    backgroundColor: '#F4B41A',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#D89B00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playAgainText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  changeEmojiButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  changeEmojiText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1fae5',
    textDecorationLine: 'underline',
  },
  bonusBadge: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#10b981',
    zIndex: 10,
  },
  bonusHeaderBadge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignSelf: 'flex-end',
  },
  bonusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emojiPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  walletContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  walletCloseButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  walletCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  walletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletSlot: {
    width: 60,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletSlotActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  walletEmoji: {
    fontSize: 32,
  },
  walletEmojiImage: {
    width: 36,
    height: 36,
  },
  rewardModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  rewardModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  rewardModalHeader: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardModalIcon: {
    fontSize: 40,
  },
  rewardModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 8,
    textAlign: 'center',
  },
  rewardModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  rewardEmojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#86efac',
  },
  rewardEmojiDisplay: {
    fontSize: 64,
    marginBottom: 8,
  },
  rewardEmojiImage: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  rewardEmojiTextFallback: {
    fontSize: 80,
    marginBottom: 8,
  },
  rewardLoadingOverlay: {
    position: 'absolute',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
  },
  rewardLoadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
    textAlign: 'center',
  },
  rewardEmojiName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'center',
  },
  rewardAcceptButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  rewardAcceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  rewardDeclineButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  rewardDeclineButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
});

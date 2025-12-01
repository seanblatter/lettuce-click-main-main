import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface EmojiItem {
  id?: string;
  emoji: string;
  imageUrl?: string;
  name?: string;
}

interface LettuceHopGameProps {
  onBack: () => void;
  emojiInventory: EmojiItem[];
  customEmojiNames: Record<string, string>;
  selectedEmoji: EmojiItem;
  onEmojiChange: (emoji: EmojiItem) => void;
  hasPremiumUpgrade?: boolean;
  onPurchasePremium?: () => void;
}

type PlatformType = 'normal' | 'moving-horizontal' | 'moving-vertical' | 'cloud' | 'rocket' | 'bomb';

interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  type: PlatformType;
  direction?: number; // For moving platforms: 1 or -1
  moveSpeed?: number;
  emoji: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_SIZE = 60;
const GRAVITY = 0.4; // Even lighter gravity for more arc
const JUMP_VELOCITY = -16; // Higher jump for better arc
const HORIZONTAL_MOVE_SPEED = 12; // Smoother movement
const PLATFORM_HEIGHT = 50; // Taller for emoji platforms
const PLATFORM_WIDTH = 140; // Standard width for platforms
const INITIAL_PLATFORM_SPACING = 120; // Balanced spacing - challenging but reachable
const CAMERA_FOLLOW_THRESHOLD = SCREEN_HEIGHT * 0.4;
const MAX_HORIZONTAL_GAP = 140; // Balanced horizontal gap - challenging but reachable

export function LettuceHopGame({
  onBack,
  emojiInventory,
  customEmojiNames,
  selectedEmoji,
  onEmojiChange,
  hasPremiumUpgrade = false,
  onPurchasePremium,
}: LettuceHopGameProps) {
  const { updateHopEmojiStats } = useGame();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<'select' | 'ready' | 'playing' | 'gameOver'>('select');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(true);

  // Player physics
  const playerX = useRef(SCREEN_WIDTH / 2 - PLAYER_SIZE / 2);
  const playerY = useRef(SCREEN_HEIGHT - 200);
  const [playerXPosition, setPlayerXPosition] = useState(SCREEN_WIDTH / 2 - PLAYER_SIZE / 2);
  const [playerYPosition, setPlayerYPosition] = useState(SCREEN_HEIGHT - 200);
  const playerVelocityY = useRef(0);
  const playerRotation = useRef(new Animated.Value(0)).current;
  const isOnPlatform = useRef(false);
  const isOnCloud = useRef(false);
  const cloudFallSpeed = useRef(0);
  const cloudBounceCount = useRef(0); // Track bounces on cloud
  const rocketBoostActive = useRef(false);
  const rocketTrailOpacity = useRef(new Animated.Value(0)).current;
  const rocketTrailScale = useRef(new Animated.Value(1)).current;
  const lastPlatformGenerated = useRef<Platform | null>(null);

  // Camera
  const cameraY = useRef(0);
  const [cameraYPosition, setCameraYPosition] = useState(0);
  const maxHeightReached = useRef(0);

  // Platforms
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const platformIdCounter = useRef(0);

  // Game loop
  const gameLoopRef = useRef<any>(null);
  const lastPlatformY = useRef(SCREEN_HEIGHT - 100);

  // Load high score
  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const saved = await AsyncStorage.getItem('lettuceHopHighScore');
        if (saved) {
          setHighScore(parseInt(saved, 10));
        }
      } catch (error) {
        console.warn('Failed to load high score:', error);
      }
    };
    loadHighScore();
  }, []);

  // Generate platform based on difficulty - ensure reachable path
  const generatePlatform = useCallback((y: number): Platform => {
    const id = platformIdCounter.current++;
    const difficulty = Math.max(0, Math.min(1, y / -10000)); // Increase difficulty with height
    
    // Determine horizontal position relative to last platform
    let x: number;
    if (lastPlatformGenerated.current) {
      const lastPlatform = lastPlatformGenerated.current;
      // Generate platform within reachable horizontal distance
      const maxLeftX = Math.max(10, lastPlatform.x - MAX_HORIZONTAL_GAP);
      const maxRightX = Math.min(SCREEN_WIDTH - PLATFORM_WIDTH - 10, lastPlatform.x + lastPlatform.width + MAX_HORIZONTAL_GAP);
      x = maxLeftX + Math.random() * (maxRightX - maxLeftX);
    } else {
      // First platform - random position
      const maxX = SCREEN_WIDTH - PLATFORM_WIDTH - 10;
      x = Math.max(10, Math.random() * maxX);
    }
    
    // Platform type distribution - more bombs, clouds, and gaps for difficulty
    const rand = Math.random();
    let type: PlatformType = 'normal';
    let emoji = '🟩';
    let width = PLATFORM_WIDTH;
    
    if (rand < 0.05 + difficulty * 0.05) { // Increased bomb chance
      type = 'bomb';
      emoji = '💣 💣 💣'; // Spaced bombs
      width = 150;
    } else if (rand < 0.08 + difficulty * 0.05) { // Increased rocket chance
      type = 'rocket';
      emoji = '🚀 🚀 🚀'; // Spaced rockets
      width = 150;
    } else if (rand < 0.20 + difficulty * 0.12) { // Increased cloud chance
      type = 'cloud';
      emoji = '☁️  ☁️  ☁️'; // Spaced clouds
      width = 170;
    } else if (rand < 0.40 + difficulty * 0.12) { // Increased moving platform chance
      type = 'moving-horizontal';
      emoji = '🔵 🔵 🔵'; // Blue circles
      width = 140;
    } else if (rand < 0.52 + difficulty * 0.12) { // Increased moving platform chance
      type = 'moving-vertical';
      emoji = '🟠 🟠 🟠'; // Orange circles
      width = 140;
    } else {
      emoji = '🟩 🟩 🟩'; // Green squares with spacing
      width = 150;
    }
    
    // Ensure platform fits on screen
    x = Math.max(10, Math.min(SCREEN_WIDTH - width - 10, x));
    
    // Add Y variation to avoid ladder effect
    const yVariation = Math.random() * 30 - 15; // +/- 15px
    
    const platform = {
      id,
      x,
      y: y + yVariation,
      width,
      type,
      emoji,
      direction: Math.random() > 0.5 ? 1 : -1,
      moveSpeed: 1.2 + Math.random() * 1.2,
    };
    
    lastPlatformGenerated.current = platform;
    return platform;
  }, []);

  const resetGame = useCallback(() => {
    // Starting platform position
    const startingPlatformY = SCREEN_HEIGHT - 150;
    const startingPlayerY = startingPlatformY - PLAYER_SIZE; // Place player directly on platform
    
    playerX.current = SCREEN_WIDTH / 2 - PLAYER_SIZE / 2;
    playerY.current = startingPlayerY;
    setPlayerXPosition(SCREEN_WIDTH / 2 - PLAYER_SIZE / 2);
    setPlayerYPosition(startingPlayerY);
    playerVelocityY.current = 0;
    playerRotation.setValue(0);
    cameraY.current = 0;
    setCameraYPosition(0);
    maxHeightReached.current = 0;
    isOnPlatform.current = true; // Start on platform
    isOnCloud.current = false;
    cloudFallSpeed.current = 0;
    cloudBounceCount.current = 0;
    rocketBoostActive.current = false;
    rocketTrailOpacity.setValue(0);
    rocketTrailScale.setValue(1);
    lastPlatformGenerated.current = null;
    
    // Generate initial platforms
    const initialPlatforms: Platform[] = [];
    lastPlatformY.current = startingPlatformY;
    
    // Starting platform - centered below player
    const startPlatform = {
      id: platformIdCounter.current++,
      x: SCREEN_WIDTH / 2 - PLATFORM_WIDTH / 2,
      y: startingPlatformY,
      width: PLATFORM_WIDTH,
      type: 'normal' as PlatformType,
      emoji: '🟩 🟩 🟩',
    };
    initialPlatforms.push(startPlatform);
    lastPlatformGenerated.current = startPlatform;
    
    // Generate more platforms upward with guaranteed reachable spacing
    for (let i = 0; i < 25; i++) {
      const spacing = INITIAL_PLATFORM_SPACING + Math.random() * 40; // Balanced variation
      lastPlatformY.current -= spacing;
      const platform = generatePlatform(lastPlatformY.current);
      
      // Ensure early platforms are safe and reachable
      if (i < 3) { // Reduced safe platforms from 5 to 3
        platform.type = platform.type === 'bomb' ? 'normal' : platform.type;
        if (platform.type === 'normal') {
          platform.emoji = '🟩 🟩 🟩';
        }
      }
      
      initialPlatforms.push(platform);
    }
    
    setPlatforms(initialPlatforms);
    setScore(0);
    platformIdCounter.current = initialPlatforms.length;
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, [generatePlatform, playerRotation, rocketTrailOpacity, rocketTrailScale]);

  const movePlayer = useCallback((direction: 'left' | 'right') => {
    if (gameState !== 'playing') return;
    
    // Smoother, more fluid movement with screen wrapping
    const moveAmount = HORIZONTAL_MOVE_SPEED * 2.5;
    let newX = direction === 'left' 
      ? playerX.current - moveAmount
      : playerX.current + moveAmount;
    
    // Screen wrapping: if player goes off one edge, wrap to the other side
    if (newX < -PLAYER_SIZE) {
      newX = SCREEN_WIDTH; // Wrap from left to right
    } else if (newX > SCREEN_WIDTH) {
      newX = -PLAYER_SIZE; // Wrap from right to left
    }
    
    playerX.current = newX;
    setPlayerXPosition(newX);
    
    // Add subtle upward velocity for arc-like movement
    if (Math.abs(playerVelocityY.current) < 5) {
      playerVelocityY.current -= 0.5; // Small upward boost for arc
    }
    
    // Subtle rotation for fluid motion
    Animated.timing(playerRotation, {
      toValue: direction === 'left' ? -8 : 8,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    setTimeout(() => {
      Animated.timing(playerRotation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }, 100);
  }, [gameState, playerRotation]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('ready');
  }, [resetGame]);

  const handleEmojiSelect = useCallback((emojiItem: EmojiItem) => {
    onEmojiChange(emojiItem);
  }, [onEmojiChange]);

  const handleGameOver = useCallback(async () => {
    setGameState('gameOver');
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // Update stats - isGameEnd should always be true when game is over
    const emojiId = selectedEmoji.id || selectedEmoji.emoji;
    updateHopEmojiStats(emojiId, score, true);

    // Save high score
    if (score > highScore) {
      setHighScore(score);
      try {
        await AsyncStorage.setItem('lettuceHopHighScore', score.toString());
      } catch (error) {
        console.warn('Failed to save high score:', error);
      }
    }
  }, [score, highScore, selectedEmoji, updateHopEmojiStats]);

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
      // Apply gravity or cloud fall
      if (isOnCloud.current) {
        cloudFallSpeed.current = Math.min(cloudFallSpeed.current + 0.08, 1.5);
        playerVelocityY.current = cloudFallSpeed.current;
      } else if (rocketBoostActive.current) {
        playerVelocityY.current = -69; // MEGA BOOST!
      } else {
        playerVelocityY.current += GRAVITY;
      }
      
      // Update player position
      const newY = playerY.current + playerVelocityY.current;
      playerY.current = newY;
      setPlayerYPosition(newY);

      // Handle screen wrapping for horizontal position
      let currentX = playerX.current;
      if (currentX < -PLAYER_SIZE) {
        currentX = SCREEN_WIDTH;
        playerX.current = currentX;
        setPlayerXPosition(currentX);
      } else if (currentX > SCREEN_WIDTH) {
        currentX = -PLAYER_SIZE;
        playerX.current = currentX;
        setPlayerXPosition(currentX);
      }

      // Update camera to follow player
      const playerScreenY = newY - cameraY.current;
      if (playerScreenY < CAMERA_FOLLOW_THRESHOLD) {
        const newCameraY = newY - CAMERA_FOLLOW_THRESHOLD;
        cameraY.current = newCameraY;
        setCameraYPosition(newCameraY);
      }

      // Update max height and score
      const currentHeight = -newY;
      if (currentHeight > maxHeightReached.current) {
        maxHeightReached.current = currentHeight;
        const newScore = Math.floor(currentHeight / 10);
        setScore(newScore);
      }

      // Check if player fell off screen
      if (newY > cameraY.current + SCREEN_HEIGHT + 100) {
        handleGameOver();
        return;
      }

      // Generate new platforms as player climbs
      const lowestPlatformY = lastPlatformY.current;
      if (lowestPlatformY > cameraY.current - SCREEN_HEIGHT) {
        const spacing = INITIAL_PLATFORM_SPACING + Math.random() * 40; // Balanced variation
        const newY = lowestPlatformY - spacing;
        lastPlatformY.current = newY;
        
        setPlatforms(prev => {
          const newPlatform = generatePlatform(newY);
          // Remove platforms that are too far below camera
          const filtered = prev.filter(p => p.y < cameraY.current + SCREEN_HEIGHT + 300);
          return [...filtered, newPlatform];
        });
      }

      // Update moving platforms
      setPlatforms(prev => prev.map(platform => {
        if (platform.type === 'moving-horizontal') {
          let newX = platform.x + (platform.direction || 1) * (platform.moveSpeed || 2);
          let newDirection = platform.direction;
          
          if (newX <= 0 || newX + platform.width >= SCREEN_WIDTH) {
            newDirection = -(platform.direction || 1);
            newX = Math.max(0, Math.min(SCREEN_WIDTH - platform.width, newX));
          }
          
          return { ...platform, x: newX, direction: newDirection };
        } else if (platform.type === 'moving-vertical') {
          let newY = platform.y + (platform.direction || 1) * (platform.moveSpeed || 1.5);
          let newDirection = platform.direction;
          
          const range = 80;
          const originalY = platform.y;
          if (Math.abs(newY - originalY) > range) {
            newDirection = -(platform.direction || 1);
          }
          
          return { ...platform, y: newY, direction: newDirection };
        }
        return platform;
      }));

      // Check platform collisions
      isOnPlatform.current = false;
      isOnCloud.current = false;
      rocketBoostActive.current = false;
      
      const playerBottom = newY + PLAYER_SIZE;
      const playerLeft = currentX;
      const playerRight = currentX + PLAYER_SIZE;
      
      for (const platform of platforms) {
        const platformTop = platform.y;
        const platformBottom = platform.y + PLATFORM_HEIGHT;
        const platformLeft = platform.x;
        const platformRight = platform.x + platform.width;
        
        // Check if player is above platform and falling
        const isAbove = playerBottom >= platformTop - 5 && playerBottom <= platformBottom + 15;
        
        // Check horizontal alignment with screen wrapping
        // Player might be wrapping around screen edges, so check both positions
        let isHorizontallyAligned = playerRight > platformLeft + 10 && playerLeft < platformRight - 10;
        
        // Check if player is wrapping from left edge
        if (playerLeft < 0) {
          const wrappedLeft = playerLeft + SCREEN_WIDTH + PLAYER_SIZE;
          const wrappedRight = wrappedLeft + PLAYER_SIZE;
          isHorizontallyAligned = isHorizontallyAligned || 
            (wrappedRight > platformLeft + 10 && wrappedLeft < platformRight - 10);
        }
        
        // Check if player is wrapping from right edge
        if (playerRight > SCREEN_WIDTH) {
          const wrappedRight = playerRight - SCREEN_WIDTH - PLAYER_SIZE;
          const wrappedLeft = wrappedRight - PLAYER_SIZE;
          isHorizontallyAligned = isHorizontallyAligned || 
            (wrappedRight > platformLeft + 10 && wrappedLeft < platformRight - 10);
        }
        
        const isFalling = playerVelocityY.current >= 0;
        
        if (isAbove && isHorizontallyAligned && isFalling) {
          if (platform.type === 'bomb') {
            // Hit a bomb - game over
            handleGameOver();
            return;
          } else if (platform.type === 'cloud') {
            // Landing on cloud - allow one bounce, then disappear
            cloudBounceCount.current += 1;
            
            if (cloudBounceCount.current === 1) {
              // First bounce - allow normal jump
              isOnPlatform.current = true;
              playerY.current = platformTop - PLAYER_SIZE;
              playerVelocityY.current = JUMP_VELOCITY;
            } else if (cloudBounceCount.current >= 2) {
              // Second bounce - cloud disappears, player falls
              setPlatforms(prev => prev.filter(p => p.id !== platform.id));
              cloudBounceCount.current = 0;
              // Player continues falling through
            }
          } else if (platform.type === 'rocket') {
            // Landing on rocket - MEGA BOOST up!
            rocketBoostActive.current = true;
            playerVelocityY.current = -69; // MEGA BOOST! 🚀
            
            // Animate rocket trail with scaling effect - SHORTENED
            Animated.parallel([
              Animated.timing(rocketTrailOpacity, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(rocketTrailScale, {
                  toValue: 1.5,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(rocketTrailScale, {
                  toValue: 0.5,
                  duration: 600, // Shortened from 1000ms
                  useNativeDriver: true,
                }),
              ]),
            ]).start(() => {
              rocketTrailOpacity.setValue(0);
              rocketTrailScale.setValue(1);
            });
            
            // Shortened boost duration
            setTimeout(() => {
              rocketBoostActive.current = false;
            }, 400); // Shortened from 600ms
          } else {
            // Normal platform - bounce
            isOnPlatform.current = true;
            playerY.current = platformTop - PLAYER_SIZE;
            playerVelocityY.current = JUMP_VELOCITY;
            
            // Bounce animation
            Animated.sequence([
              Animated.timing(playerRotation, {
                toValue: 360,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(playerRotation, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]).start();
          }
          break;
        }
      }
    }, 1000 / 60); // 60 FPS

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState, platforms, handleGameOver, generatePlatform, playerRotation, rocketTrailOpacity]);

  // Start game when ready
  useEffect(() => {
    if (gameState === 'ready') {
      const timer = setTimeout(() => {
        setGameState('playing');
        // Give player an initial jump to start bouncing
        playerVelocityY.current = JUMP_VELOCITY;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const renderEmojiImage = (item: EmojiItem, size: number) => {
    if (item.imageUrl) {
      return (
        <ExpoImage
          source={{ uri: item.imageUrl }}
          style={{ width: size, height: size }}
          contentFit="contain"
        />
      );
    }
    return <Text style={{ fontSize: size * 0.8 }}>{item.emoji}</Text>;
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Main Game Card */}
      <View style={styles.gameCard}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Lettuce Hop</Text>
          <View style={styles.headerScoreContainer}>
            <Text style={styles.scoreLabel}>Best</Text>
            <Text style={styles.highScoreValue}>{highScore}</Text>
          </View>
        </View>

        {/* Game Canvas */}
        <View style={styles.gameContainer}>
          <View style={styles.gameCanvas}>
            {(gameState === 'ready' || gameState === 'playing') && (
              <>
                {/* Score Display */}
                <View style={[styles.scoreContainer, { paddingTop: insets.top }]}>
                  <Text style={styles.scoreText}>Height: {score}</Text>
                  <Text style={styles.highScoreText}>Best: {highScore}</Text>
                </View>

            {/* Game Area */}
            <View style={styles.gameArea}>
            {/* Platforms */}
            {platforms.map(platform => {
              const screenY = platform.y - cameraYPosition;
              if (screenY < -100 || screenY > SCREEN_HEIGHT + 100) return null;
              
              const isRocket = platform.type === 'rocket';
              
              return (
                <View
                  key={platform.id}
                  style={[
                    styles.platform,
                    {
                      left: platform.x,
                      top: screenY,
                      width: platform.width,
                      height: PLATFORM_HEIGHT,
                      backgroundColor: 'transparent',
                    },
                    isRocket && styles.rocketPlatform,
                  ]}
                >
                  <Text style={[
                    styles.platformEmoji,
                    isRocket && styles.rocketEmoji
                  ]}>{platform.emoji}</Text>
                </View>
              );
            })}

            {/* Player */}
            <Animated.View
              style={[
                styles.player,
                {
                  left: playerXPosition,
                  top: playerYPosition - cameraYPosition,
                  transform: [
                    { rotate: playerRotation.interpolate({
                      inputRange: [-20, 0, 20, 360],
                      outputRange: ['-20deg', '0deg', '20deg', '360deg'],
                    })},
                  ],
                },
              ]}
            >
              {renderEmojiImage(selectedEmoji, PLAYER_SIZE)}
            </Animated.View>

            {/* Rocket Trail - Cool streak effect */}
            <Animated.View
              style={[
                styles.rocketTrail,
                {
                  left: playerXPosition + PLAYER_SIZE / 2 - 25,
                  top: playerYPosition - cameraYPosition + PLAYER_SIZE - 10,
                  opacity: rocketTrailOpacity,
                  transform: [{ scaleY: rocketTrailScale }],
                },
              ]}
            >
              <View style={styles.trailGradient}>
                <View style={[styles.trailSegment, { backgroundColor: '#ff6b6b', opacity: 0.9 }]} />
                <View style={[styles.trailSegment, { backgroundColor: '#ffd93d', opacity: 0.7 }]} />
                <View style={[styles.trailSegment, { backgroundColor: '#6bcf7f', opacity: 0.5 }]} />
                <View style={[styles.trailSegment, { backgroundColor: '#4d96ff', opacity: 0.3 }]} />
                <View style={[styles.trailSegment, { backgroundColor: '#9d4edd', opacity: 0.2 }]} />
              </View>
            </Animated.View>
          </View>

          {/* Controls - Always visible for crisp gameplay */}
          <View style={[styles.controls, { paddingBottom: insets.bottom }]}>
            <Pressable
              style={styles.controlButton}
              onPress={() => movePlayer('left')}
            >
              <Text style={styles.controlButtonText}>←</Text>
            </Pressable>
            <Pressable
              style={styles.controlButton}
              onPress={() => movePlayer('right')}
            >
              <Text style={styles.controlButtonText}>→</Text>
            </Pressable>
          </View>

          {gameState === 'ready' && (
            <View style={styles.readyOverlay}>
              <Text style={styles.readyText}>Tap left or right to hop!</Text>
            </View>
          )}
          </>
        )}

        {/* Game Over Screen */}
        {gameState === 'gameOver' && (
          <View style={styles.gameOverOverlay}>
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
                    <Text style={styles.scoreCardLabel}>HEIGHT</Text>
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
              onPress={() => setGameState('select')}
            >
              <Text style={styles.changeEmojiText}>Change Character</Text>
            </Pressable>

            {/* Locked Games (always visible for non-premium) */}
            {!hasPremiumUpgrade && (
              <>
                <Text style={styles.moreGamesTitle}>🎮 More Games</Text>
                <View style={styles.lockedGamesGrid}>
                  <View style={styles.lockedGameCard}>
                    <View style={styles.lockOverlay}>
                      <Text style={styles.lockIcon}>🔒</Text>
                    </View>
                    <Text style={styles.lockedGameIcon}>🔪</Text>
                    <Text style={styles.lockedGameTitle}>Lettuce Slicer</Text>
                  </View>
                  <View style={styles.lockedGameCard}>
                    <View style={styles.lockOverlay}>
                      <Text style={styles.lockIcon}>🔒</Text>
                    </View>
                    <Text style={styles.lockedGameIcon}>🎯</Text>
                    <Text style={styles.lockedGameTitle}>Lettuce Hop</Text>
                  </View>
                </View>

                {/* Premium Paywall Card */}
                <View style={styles.premiumPaywallCard}>
                  <Text style={styles.paywallCardTitle}>⭐ Upgrade to Premium</Text>
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
              </>
            )}
          </View>
        )}
        </View>
      </View>

      {/* Emoji Picker - Wallet Style at bottom */}
      {(gameState === 'select' || gameState === 'gameOver') && (
        <View style={styles.walletContainer}>
          <View style={styles.walletHeader}>
            <Text style={styles.walletTitle}>Select Your Character</Text>
            <Pressable
              style={styles.walletCloseButton}
              onPress={() => {
                setGameState('ready');
                startGame();
              }}
            >
              <Text style={styles.walletCloseText}>Start Game</Text>
            </Pressable>
          </View>
          <ScrollView 
            contentContainerStyle={styles.walletGrid}
            showsVerticalScrollIndicator={false}
            horizontal={false}
          >
            {emojiInventory.map((item, index) => {
              const isSelected = item.emoji === selectedEmoji.emoji;
              return (
                <Pressable
                  key={item.id || index}
                  style={[
                    styles.walletSlot,
                    isSelected && styles.walletSlotActive,
                  ]}
                  onPress={() => handleEmojiSelect(item)}
                >
                  {item.imageUrl ? (
                    <ExpoImage
                      source={{ uri: item.imageUrl }}
                      style={styles.walletEmojiImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Text style={styles.walletEmoji}>{item.emoji}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  gameCard: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#065f46',
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
    color: '#059669',
    fontWeight: '600',
  },
  headerScoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  highScoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
  },
  gameContainer: {
    flex: 1,
    padding: 20,
  },
  gameCanvas: {
    flex: 1,
    backgroundColor: '#7dd3fc',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  walletContainer: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '40%',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    gap: 10,
    paddingBottom: 20,
  },
  walletSlot: {
    width: 80,
    height: 74,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletSlotActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 3,
  },
  walletEmoji: {
    fontSize: 42,
  },
  walletEmojiImage: {
    width: 48,
    height: 48,
  },
  scoreContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    paddingTop: 10,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  highScoreText: {
    fontSize: 18,
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  platform: {
    position: 'absolute',
    height: PLATFORM_HEIGHT,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  platformEmoji: {
    fontSize: 28,
    textAlign: 'center',
    lineHeight: PLATFORM_HEIGHT,
    letterSpacing: 2,
  },
  rocketPlatform: {
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  rocketEmoji: {
    fontSize: 32,
    textShadowColor: '#fbbf24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  player: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  rocketTrail: {
    position: 'absolute',
    width: 50,
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 5,
  },
  trailGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  trailSegment: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginVertical: -10,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    zIndex: 100,
  },
  controlButton: {
    width: 90,
    height: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlButtonText: {
    fontSize: 42,
    color: '#10b981',
    fontWeight: 'bold',
  },
  readyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  readyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 50,
  },
  gameOverTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    width: '90%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
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
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
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
    marginBottom: 24,
  },
  changeEmojiText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1fae5',
    textDecorationLine: 'underline',
  },
  // More Games Section
  moreGamesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  lockedGamesGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
    width: '90%',
    maxWidth: 360,
  },
  lockedGameCard: {
    flex: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#4b5563',
    minHeight: 120,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  lockIcon: {
    fontSize: 36,
  },
  lockedGameIcon: {
    fontSize: 48,
    marginBottom: 8,
    opacity: 0.4,
  },
  lockedGameTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Premium Paywall Card
  premiumPaywallCard: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 360,
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  paywallCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 12,
  },
  paywallCardDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  upgradePremiumButton: {
    backgroundColor: '#fbbf24',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  upgradePremiumText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAME_HEIGHT = SCREEN_HEIGHT - 200;
const EMOJI_SIZE = 70;

const TRAIL_COLORS = [
  { color: '#FFFFFF', sparkle: false },   // White
  { color: '#FF1744', sparkle: false },  // Red
  { color: '#00E5FF', sparkle: false },   // Cyan
  { color: '#FFD600', sparkle: false },   // Gold
  { color: '#76FF03', sparkle: false },  // Lime
  { color: '#FF6B9D', sparkle: true },  // Pink - sparkle
  { color: '#9D4EFF', sparkle: true },   // Purple - sparkle
  { color: '#FF9100', sparkle: true },  // Orange - sparkle
  { color: '#00BFA5', sparkle: true },  // Teal - sparkle
  { color: '#FFEA00', sparkle: true },   // Yellow - sparkle
];

const FRUIT_POOL = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🥝', '🍍'];

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  color: string;
}

interface Entity {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sliced: boolean;
  sliceAngle?: number;
  sliceTime?: number;
}

interface LettuceSlicerGameProps {
  onBack: () => void;
  ownedEmojis: Array<{ emoji: string; imageUrl?: string; name?: string }>;
  emojiStringToId: Record<string, string>;
}

export default function LettuceSlicerGame({ onBack, ownedEmojis, emojiStringToId }: LettuceSlicerGameProps) {
  const { updateSlicerEmojiStats, updateSlicerGameStats } = useGame();
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [trailColor, setTrailColor] = useState(TRAIL_COLORS[5].color);
  const [trailSparkle, setTrailSparkle] = useState(true);
  const [lastEmojiEnded, setLastEmojiEnded] = useState('');
  const [showPicker, setShowPicker] = useState(true);
  const [combo, setCombo] = useState(0);
  const [sparklePoints, setSparklePoints] = useState<Array<{ x: number; y: number; timestamp: number }>>([]);

  const nextId = useRef(1);
  const tickRef = useRef<any>(null);
  const droppedIds = useRef(new Set<number>());
  const startedRef = useRef(started);
  const gameOverRef = useRef(gameOver);
  const trailColorRef = useRef(trailColor);
  const trailSparkleRef = useRef(trailSparkle);
  const gameAreaRef = useRef<View>(null);
  const gameAreaLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const comboTimeoutRef = useRef<any>(null);
  const slicedEmojisThisGame = useRef(new Set<string>());
  
  // Keep refs in sync
  useEffect(() => {
    startedRef.current = started;
  }, [started]);
  
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  
  useEffect(() => {
    trailColorRef.current = trailColor;
  }, [trailColor]);
  
  useEffect(() => {
    trailSparkleRef.current = trailSparkle;
  }, [trailSparkle]);

  // Load best score
  useEffect(() => {
    AsyncStorage.getItem('slicer_best').then((val) => {
      if (val) setBest(parseInt(val, 10));
    });
  }, []);

  // Get emoji pool
  const emojiPool = React.useMemo(() => {
    const owned = new Set<string>();
    owned.add('🥬');
    ownedEmojis.forEach(e => owned.add(e.emoji));
    const ownedList = Array.from(owned);
    const hasAtLeast12 = ownedList.length >= 12 && ownedList.includes('🥬');
    if (hasAtLeast12) return ownedList;
    return ['🥬', ...FRUIT_POOL];
  }, [ownedEmojis]);

  // Spawn emoji
  const spawnEmoji = () => {
    const isBomb = Math.random() < 0.15;
    const isGhost = !isBomb && Math.random() < 0.1;
    let emoji = '';
    if (isBomb) emoji = '💣';
    else if (isGhost) emoji = '👻';
    else emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];

    const ent: Entity = {
      id: nextId.current++,
      emoji,
      x: 50 + Math.random() * (SCREEN_WIDTH - 100),
      y: GAME_HEIGHT + 50,
      vx: (Math.random() - 0.5) * 4,
      vy: -(15 + Math.random() * 8),
      radius: EMOJI_SIZE / 2,
      sliced: false,
    };
    setEntities((prev) => [...prev, ent]);
  };

  // Start game
  const handleStart = () => {
    setStarted(true);
    setShowPicker(false);
    setGameOver(false);
    setScore(0);
    setLives(3);
    setEntities([]);
    setTrailPoints([]);
    setLastEmojiEnded('');
    setCombo(0);
    setSparklePoints([]);
    droppedIds.current = new Set();
    slicedEmojisThisGame.current = new Set();
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
  };

  // Reset to picker
  const handleReset = () => {
    setGameOver(false);
    setStarted(false);
    setShowPicker(true);
    setScore(0);
    setLives(3);
    setEntities([]);
    setTrailPoints([]);
    setLastEmojiEnded('');
    setCombo(0);
    setSparklePoints([]);
    droppedIds.current = new Set();
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
  };

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;

    tickRef.current = setInterval(() => {
      const now = Date.now();
      
      // Update entities
      setEntities((prev) => {
        const updated = prev.map((e) => ({
          ...e,
          x: e.x + e.vx,
          y: e.y + e.vy,
          vy: e.vy + 0.5, // gravity
        }));

        // Check for dropped emojis (only count fruit, not bombs/ghosts)
        const justDropped = updated.filter((e) => 
          !e.sliced && 
          e.y > GAME_HEIGHT + 50 && 
          e.emoji !== '💣' && 
          e.emoji !== '👻' &&
          !droppedIds.current.has(e.id)
        );
        
        if (justDropped.length > 0) {
          // Mark all as dropped
          justDropped.forEach(e => droppedIds.current.add(e.id));
          
          // Only lose ONE life for this drop
          setLives((l) => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setLastEmojiEnded(justDropped[0].emoji);
              setGameOver(true);
            }
            return newLives;
          });
        }

        return updated.filter((e) => e.y < GAME_HEIGHT + 100);
      });

      // Spawn new emoji randomly
      if (Math.random() < 0.02) spawnEmoji();

      // Fade trails and sparkles with timestamp check
      setTrailPoints((prev) => prev.filter((p) => now - p.timestamp < 500));
      setSparklePoints((prev) => prev.filter((p) => now - p.timestamp < 800));
    }, 16); // ~60fps

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [started, gameOver, emojiPool]);

  // Update best score
  useEffect(() => {
    if (gameOver && score > best) {
      setBest(score);
      AsyncStorage.setItem('slicer_best', score.toString());
    }
  }, [gameOver, score, best]);

  // Update game stats when game ends
  useEffect(() => {
    if (gameOver && slicedEmojisThisGame.current.size > 0) {
      const emojis = Array.from(slicedEmojisThisGame.current);
      updateSlicerGameStats(emojis);
    }
  }, [gameOver, updateSlicerGameStats]);

  // PanResponder for slicing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!startedRef.current || gameOverRef.current) return;
        
        // Use pageX/pageY for mobile compatibility
        const touch = e.nativeEvent;
        let x = touch.locationX ?? (touch.pageX - gameAreaLayout.current.x);
        let y = touch.locationY ?? (touch.pageY - gameAreaLayout.current.y);
        
        // Clamp to game area bounds
        const layout = gameAreaLayout.current;
        x = Math.max(0, Math.min(x, layout.width));
        y = Math.max(0, Math.min(y, layout.height));
        
        lastTouchPos.current = { x, y };
        
        console.log('🎯 Touch start:', { 
          x, 
          y, 
          pageX: touch.pageX, 
          pageY: touch.pageY,
          locationX: touch.locationX,
          locationY: touch.locationY,
          started: startedRef.current 
        });
        
        setTrailPoints((prev) => [...prev, { x, y, timestamp: Date.now(), color: trailColorRef.current }]);
        checkSlice(x, y);
      },
      onPanResponderMove: (e) => {
        if (!startedRef.current || gameOverRef.current) return;
        
        // Use pageX/pageY for mobile compatibility
        const touch = e.nativeEvent;
        let x = touch.locationX ?? (touch.pageX - gameAreaLayout.current.x);
        let y = touch.locationY ?? (touch.pageY - gameAreaLayout.current.y);
        
        // Clamp to game area bounds
        const layout = gameAreaLayout.current;
        x = Math.max(0, Math.min(x, layout.width));
        y = Math.max(0, Math.min(y, layout.height));
        
        // Add interpolated points for smoother trail
        const lastX = lastTouchPos.current.x;
        const lastY = lastTouchPos.current.y;
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 5)); // Point every 5 pixels
        
        const newPoints: TrailPoint[] = [];
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const px = lastX + dx * t;
          const py = lastY + dy * t;
          // Clamp each interpolated point
          newPoints.push({
            x: Math.max(0, Math.min(px, layout.width)),
            y: Math.max(0, Math.min(py, layout.height)),
            timestamp: Date.now(),
            color: trailColorRef.current,
          });
        }
        
        setTrailPoints((prev) => [...prev, ...newPoints]);
        
        // Add sparkles if color has sparkle effect
        if (trailSparkleRef.current && Math.random() < 0.3) {
          const sparkleX = x + (Math.random() - 0.5) * 20;
          const sparkleY = y + (Math.random() - 0.5) * 20;
          setSparklePoints((prev) => [...prev, { 
            x: Math.max(0, Math.min(sparkleX, layout.width)), 
            y: Math.max(0, Math.min(sparkleY, layout.height)), 
            timestamp: Date.now() 
          }]);
        }
        lastTouchPos.current = { x, y };
        checkSlice(x, y, dx, dy);
      },
      onPanResponderRelease: () => {
        console.log('🔚 Touch end');
      },
    })
  ).current;

  // Check if touch slices any emoji
  const checkSlice = (touchX: number, touchY: number, swipeDx: number = 0, swipeDy: number = 0) => {
    const slicedEmojis: string[] = [];
    
    setEntities((prev) => {
      console.log('🔍 Checking slice at', { touchX, touchY }, 'against', prev.length, 'entities');
      
      let slicedAny = false;
      const updated = prev.map((e) => {
        if (e.sliced) return e;
        
        const dx = touchX - e.x;
        const dy = touchY - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        console.log('  📏 Entity', e.emoji, 'at', { x: e.x, y: e.y }, 'distance:', dist.toFixed(1), 'threshold:', e.radius + 30);
        
        if (dist < e.radius + 30) {
          // Calculate slice angle from swipe direction
          const sliceAngle = Math.atan2(swipeDy, swipeDx);
          console.log('💥 SLICED:', e.emoji, 'at', { x: e.x, y: e.y }, 'angle:', (sliceAngle * 180 / Math.PI).toFixed(0), '°');
          slicedAny = true;
          
          if (e.emoji === '💣' || e.emoji === '👻') {
            setLives((l) => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setLastEmojiEnded(e.emoji);
                setGameOver(true);
              }
              return newLives;
            });
          } else {
            // Collect sliced emoji for stats tracking - convert to ID
            const emojiId = emojiStringToId[e.emoji] || e.emoji;
            slicedEmojis.push(emojiId);
            slicedEmojisThisGame.current.add(emojiId);
            
            // Increase combo and calculate points
            setCombo((c) => {
              const newCombo = c + 1;
              let points = 1;
              if (newCombo >= 5) points = 3; // 3x for 5+ combo
              else if (newCombo >= 3) points = 2; // 2x for 3+ combo
              
              setScore((s) => s + points);
              console.log('🔥 Combo:', newCombo, 'Points:', points);
              return newCombo;
            });
            
            // Reset combo after 1 second of no slicing
            if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = setTimeout(() => {
              setCombo(0);
            }, 1000);
          }
          return { ...e, sliced: true, sliceAngle, sliceTime: Date.now() };
        }
        return e;
      });
      
      if (slicedAny) {
        console.log('🔪 Slice detected!');
      }
      return updated;
    });
    
    // Update stats after state update completes
    slicedEmojis.forEach(emoji => {
      updateSlicerEmojiStats(emoji);
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lettuce Slicer</Text>
        <View style={styles.headerRight}>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Game Area */}
      <View 
        ref={gameAreaRef}
        style={styles.gameArea} 
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          gameAreaLayout.current = { x, y, width, height };
          console.log('📐 Game area layout:', { x, y, width, height });
        }}
      >
        {/* Background */}
        <View style={styles.background}>
          <View style={styles.sky} />
          <View style={styles.sun} />
          <View style={styles.cloud1} />
          <View style={styles.cloud2} />
          <View style={styles.hills} />
        </View>

        {/* HUD */}
        {started && !gameOver && (
          <>
            <View style={styles.hudLeft}>
              {[...Array(lives)].map((_, i) => (
                <Text key={i} style={styles.heart}>
                  ❤️
                </Text>
              ))}
            </View>
            
            {/* Combo Display */}
            {combo >= 3 && (
              <View style={styles.comboDisplay}>
                <Text style={styles.comboText}>
                  {combo >= 5 ? '🔥 TRIPLE! 3X' : '⚡ DOUBLE! 2X'}
                </Text>
                <Text style={styles.comboCount}>{combo} COMBO</Text>
              </View>
            )}
          </>
        )}

        {/* Entities */}
        {entities.map((e) => {
          if (e.sliced && e.sliceAngle !== undefined && e.sliceTime) {
            // Calculate animation progress
            const elapsed = Date.now() - e.sliceTime;
            const animProgress = Math.min(elapsed / 300, 1); // 300ms animation
            const splitDist = animProgress * 30; // Move 30px apart
            
            // Calculate perpendicular direction to slice angle
            const perpAngle = e.sliceAngle + Math.PI / 2;
            const offsetX = Math.cos(perpAngle) * splitDist;
            const offsetY = Math.sin(perpAngle) * splitDist;
            
            const rotationDeg = e.sliceAngle * (180 / Math.PI);
            const fadeOut = 1 - animProgress;
            
            return (
              <React.Fragment key={e.id}>
                {/* Top/Left half */}
                <View
                  style={[
                    styles.entity,
                    {
                      left: e.x - e.radius - offsetX,
                      top: e.y - e.radius - offsetY,
                      width: e.radius * 2,
                      height: e.radius * 2,
                      opacity: fadeOut,
                      transform: [
                        { rotate: `${rotationDeg - 10}deg` },
                        { scale: 1 - animProgress * 0.2 },
                      ],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={styles.entityEmoji}>{e.emoji}</Text>
                </View>
                {/* Bottom/Right half */}
                <View
                  style={[
                    styles.entity,
                    {
                      left: e.x - e.radius + offsetX,
                      top: e.y - e.radius + offsetY,
                      width: e.radius * 2,
                      height: e.radius * 2,
                      opacity: fadeOut,
                      transform: [
                        { rotate: `${rotationDeg + 10}deg` },
                        { scale: 1 - animProgress * 0.2 },
                      ],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={styles.entityEmoji}>{e.emoji}</Text>
                </View>
              </React.Fragment>
            );
          }
          
          return (
            <View
              key={e.id}
              style={[
                styles.entity,
                {
                  left: e.x - e.radius,
                  top: e.y - e.radius,
                  width: e.radius * 2,
                  height: e.radius * 2,
                  opacity: e.sliced ? 0 : 1,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.entityEmoji}>{e.emoji}</Text>
            </View>
          );
        })}

        {/* Trail points */}
        {trailPoints.map((p, i) => {
          const age = Date.now() - p.timestamp;
          const opacity = Math.max(0, 1 - age / 500);
          const size = 15 - (age / 500) * 5; // Larger, more consistent size
          
          return (
            <View
              key={`${p.timestamp}-${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: p.x - size / 2,
                top: p.y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: p.color,
                opacity,
                shadowColor: p.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 6,
                zIndex: 1000,
              }}
            />
          );
        })}
        
        {/* Sparkle effects */}
        {sparklePoints.map((sp, i) => {
          const age = Date.now() - sp.timestamp;
          const opacity = Math.max(0, 1 - age / 800);
          const scale = 0.5 + (age / 800) * 0.8;
          
          return (
            <View
              key={`sparkle-${sp.timestamp}-${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: sp.x - 8,
                top: sp.y - 8,
                opacity,
                transform: [{ scale }],
                zIndex: 1001,
              }}
            >
              <Text style={{ fontSize: 16 }}>✨</Text>
            </View>
          );
        })}

        {/* Game Over Overlay */}
        {gameOver && (
          <View style={styles.overlay}>
            <View style={styles.endCard}>
              {lastEmojiEnded && <Text style={styles.endEmoji}>{lastEmojiEnded}</Text>}
              <Text style={styles.endScore}>Score</Text>
              <Text style={styles.endScoreValue}>{score}</Text>
              <Text style={styles.endBest}>Best: {best}</Text>
              <TouchableOpacity style={styles.playAgain} onPress={handleStart}>
                <Text style={styles.playAgainText}>Play Again</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.changeColorLink}>Change Swipe Color</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Color Picker */}
      {!started && !gameOver && showPicker && (
        <View style={styles.controls}>
          <View style={styles.colorCard}>
            <View style={styles.colorHeader}>
              <Text style={styles.colorTitle}>Select Your Slice Color</Text>
              <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.colorGrid}>
              <View style={styles.colorRow}>
                {TRAIL_COLORS.slice(0, 5).map((c) => (
                  <TouchableOpacity
                    key={c.color}
                    style={[
                      styles.colorCell,
                      { backgroundColor: c.color },
                      trailColor === c.color && styles.colorCellSelected,
                    ]}
                    onPress={() => {
                      if (trailColor === c.color) {
                        // Toggle sparkle if clicking same color
                        setTrailSparkle(!trailSparkle);
                      } else {
                        // First click - set color with default sparkle state
                        setTrailColor(c.color);
                        setTrailSparkle(c.sparkle);
                      }
                    }}
                  >
                    {trailColor === c.color && trailSparkle && (
                      <Text style={styles.sparkleIcon}>✨</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.colorRow}>
                {TRAIL_COLORS.slice(5, 10).map((c) => (
                  <TouchableOpacity
                    key={c.color}
                    style={[
                      styles.colorCell,
                      { backgroundColor: c.color },
                      trailColor === c.color && styles.colorCellSelected,
                    ]}
                    onPress={() => {
                      if (trailColor === c.color) {
                        // Toggle sparkle if clicking same color
                        setTrailSparkle(!trailSparkle);
                      } else {
                        // First click - set color with default sparkle state
                        setTrailColor(c.color);
                        setTrailSparkle(c.sparkle);
                      }
                    }}
                  >
                    {/* Show sparkle if selected with sparkle, or if unselected bottom row */}
                    {((trailColor === c.color && trailSparkle) || (trailColor !== c.color && c.sparkle)) && (
                      <Text style={styles.sparkleIcon}>✨</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

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
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#9bd3ff',
  },
  sun: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fde047',
    opacity: 0.9,
  },
  cloud1: {
    position: 'absolute',
    width: 120,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    top: 80,
    left: 40,
    opacity: 0.8,
  },
  cloud2: {
    position: 'absolute',
    width: 100,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    top: 140,
    right: 60,
    opacity: 0.8,
  },
  hills: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    right: -40,
    height: 140,
    backgroundColor: '#86efac',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
  },
  hudLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    zIndex: 10,
  },
  heart: {
    fontSize: 24,
    marginRight: 4,
  },
  entity: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  entityEmoji: {
    fontSize: EMOJI_SIZE,
    lineHeight: EMOJI_SIZE,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  endCard: {
    width: 260,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#86efac',
    alignItems: 'center',
  },
  endEmoji: {
    fontSize: 64,
    lineHeight: 64,
    marginBottom: 8,
  },
  endScore: {
    fontSize: 14,
    color: '#065f46',
  },
  endScoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 12,
  },
  endBest: {
    fontSize: 14,
    color: '#065f46',
    marginBottom: 12,
  },
  playAgain: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  playAgainText: {
    color: '#fff',
    fontWeight: '700',
  },
  changeColorLink: {
    color: '#0ea5e9',
    fontWeight: '600',
    fontSize: 14,
  },
  controls: {
    padding: 12,
  },
  colorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: '#86efac',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  colorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  startButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  colorGrid: {
    gap: 8,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  colorCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  colorCellSelected: {
    borderColor: '#0ea5e9',
    borderWidth: 3,
  },
  sparkleIcon: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  comboDisplay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 50,
  },
  comboText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFD600',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  comboCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 4,
  },
});

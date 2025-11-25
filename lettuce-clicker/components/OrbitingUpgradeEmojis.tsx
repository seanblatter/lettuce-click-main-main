import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import type { HomeEmojiTheme, OrbitingEmoji } from '@/context/GameContext';

const FULL_ROTATION_RADIANS = Math.PI * 2;
const WINDOW = Dimensions.get('window');
const WINDOW_WIDTH = WINDOW.width;
const WINDOW_HEIGHT = WINDOW.height;
const DEFAULT_RADIUS = Math.min(WINDOW_WIDTH, WINDOW_HEIGHT) * 0.38;

const MATRIX_EXTRA_SPREAD = 220;
const MATRIX_WIDTH = WINDOW_WIDTH + MATRIX_EXTRA_SPREAD;
const MATRIX_HEIGHT = WINDOW_HEIGHT * 1.6;
const MATRIX_START_Y = -WINDOW_HEIGHT * 0.6;
const MATRIX_END_Y = WINDOW_HEIGHT + 160;
const MATRIX_EMOJI_SIZE = 26;
const MATRIX_PADDING = 32;
const MATRIX_COLUMNS = 7;
const MATRIX_DURATION_BASE = 2800;
const MATRIX_DURATION_VARIATION = 1200;
const MATRIX_DELAY_STEP = 90;

const CONFETTI_DURATION_BASE = 1800;
const CONFETTI_DURATION_VARIATION = 900;
const CONFETTI_DELAY_STEP = 60;

const FIRELY_ALPHA_BASE = 1600;
const FIRELY_ALPHA_VARIATION = 2200;

const SUPER_NOVA_DURATION = 3600;

const SPIRAL_STEP = 10;
const SPIRAL_BASE_RADIUS_RATIO = 0.36;
const SPIRAL_DEFAULT_ARMS = 4;
const SPIRAL_MAX_ARMS = 6;
const SPIRAL_ANGLE_STEP = Math.PI / 28;
const SPIRAL_TWIST = Math.PI / 36;
const SPIRAL_DRIFT_RANGE = 64;
const SPIRAL_DRIFT_DURATION = 20000;

const WAVE_DURATION = 16000;
const WAVE_AMPLITUDE_RATIO = 0.32;

const LAKE_DROP_DURATION_BASE = 2400;
const LAKE_DROP_VARIATION = 1600;
const LAKE_FLOAT_DURATION_BASE = 3400;
const LAKE_FLOAT_VARIATION = 1600;
const LAKE_SWAY_DURATION_BASE = 4200;
const LAKE_SWAY_VARIATION = 2200;
const LAKE_HORIZONTAL_SPAN = 1.1;
const LAKE_DEPTH_MIN_RATIO = 0.95;
const LAKE_DEPTH_VARIATION_RATIO = 0.55;
const LAKE_FLOAT_AMPLITUDE_BASE = 4;
const LAKE_FLOAT_AMPLITUDE_VARIATION = 6;
const LAKE_SWAY_RANGE_RATIO = 0.04;

const AURORA_DURATION = 12000;
const AURORA_SHIFT = 42;

const NEBULA_DURATION = 28000;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 1664525 + value.charCodeAt(index) + 1013904223) & 0xffffffff;
  }

  return hash >>> 0;
}

function randomForKey(key: string, offset = 0) {
  const hash = hashString(`${key}:${offset}`);
  return (hash % 10000) / 10000;
}

type OrbitingUpgradeEmojisProps = {
  emojis: OrbitingEmoji[];
  radius?: number;
  theme?: HomeEmojiTheme;
};

const DEFAULT_EMOJI_COLOR = '#14532d';
const THEME_EMOJI_COLORS: Partial<Record<HomeEmojiTheme, string>> = {
  matrix: '#bbf7d0',
  confetti: '#fb923c',
  laser: '#f5d0fe',
  aurora: '#c4b5fd',
  firefly: '#fef08a',
  starlight: '#ede9fe',
  nebula: '#dbeafe',
  supernova: '#fecdd3',
};

function getEmojiColorForTheme(theme: HomeEmojiTheme) {
  return THEME_EMOJI_COLORS[theme] ?? DEFAULT_EMOJI_COLOR;
}

export function OrbitingUpgradeEmojis({
  emojis,
  radius = DEFAULT_RADIUS,
  theme = 'circle',
}: OrbitingUpgradeEmojisProps) {
  const limited = useMemo(() => emojis.slice(0, 96), [emojis]);
  const emojiColor = useMemo(() => getEmojiColorForTheme(theme), [theme]);
  const emojiStyle = useMemo<StyleProp<TextStyle>>(() => ({ color: emojiColor }), [emojiColor]);

  if (limited.length === 0 || theme === 'clear') {
    return null;
  }

  switch (theme) {
    case 'circle':
      return <CircleOrbit emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'spiral':
      return <SpiralOrbit emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'matrix':
      return <MatrixEmojiRain emojis={limited} radius={radius} variant="matrix" />;
    case 'bubble':
      return <BubbleSwirl emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'bubble-pop':
      return <BubblePopBurst emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'wave':
      return <WaveRibbon emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'lake':
      return <LakePool emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'echo':
      return <EchoPulse emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'confetti':
      return <ConfettiStream emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'laser':
      return <LaserSweep emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'aurora':
      return <AuroraVeil emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'firefly':
      return <FireflyField emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'starlight':
      return <StarlightHalo emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'nebula':
      return <NebulaSwirl emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    case 'supernova':
      return <SupernovaBurst emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
    default:
      return <CircleOrbit emojis={limited} radius={radius} emojiStyle={emojiStyle} />;
  }
}

type BasePatternProps = {
  emojis: OrbitingEmoji[];
  radius: number;
  emojiStyle: StyleProp<TextStyle>;
};

function useLoopingValue(duration: number, delay = 0, easing: (value: number) => number = Easing.linear) {
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animated.stopAnimation();
    animated.setValue(0);

    const sequence = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(animated, {
        toValue: 1,
        duration,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(animated, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(sequence);
    loop.start();

    return () => {
      loop.stop();
    };
  }, [animated, delay, duration, easing]);

  return animated;
}

function CircleOrbit({ emojis, radius, emojiStyle }: BasePatternProps) {
  const rotation = useLoopingValue(12000);
  const rotate = useMemo(
    () =>
      rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
      }),
    [rotation]
  );

  const positioned = useMemo(() => {
    const limit = emojis.slice(0, 48);
    return limit.map((item, index) => {
      const angle = (FULL_ROTATION_RADIANS * index) / Math.max(1, limit.length);
      return { ...item, angle, distance: radius };
    });
  }, [emojis, radius]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.container, { transform: [{ rotate }] }]}>{
        positioned.map(({ id, emoji, angle, distance }) => (
          <View
            key={id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { rotate: `${angle}rad` },
                  { translateX: distance },
                  { rotate: `${-angle}rad` },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle]}>{emoji}</Text>
          </View>
        ))
      }</Animated.View>
    </View>
  );
}

type SpiralPlacement = OrbitingEmoji & {
  angle: number;
  distance: number;
  armIndex: number;
  stepIndex: number;
};

function SpiralOrbit({ emojis, radius, emojiStyle }: BasePatternProps) {
  const rotation = useLoopingValue(16000);

  const rotate = useMemo(
    () =>
      rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
      }),
    [rotation]
  );

  const { placements, arms } = useMemo(() => {
    const limit = emojis.slice(0, 72);
    if (limit.length === 0) {
      return { placements: [] as SpiralPlacement[], arms: 1 };
    }

    const maxPossibleArms = Math.max(1, Math.min(limit.length, SPIRAL_MAX_ARMS));
    const desiredArms = Math.max(SPIRAL_DEFAULT_ARMS, Math.ceil(limit.length / 6));
    const armCount = Math.max(1, Math.min(maxPossibleArms, desiredArms));

    const placementsList = limit.map((item, index) => {
      const armIndex = index % armCount;
      const stepIndex = Math.floor(index / armCount);
      const baseDistance = radius * SPIRAL_BASE_RADIUS_RATIO + stepIndex * SPIRAL_STEP;
      const armOffset = armIndex * (SPIRAL_STEP * 0.4);
      const distance = baseDistance + armOffset;
      const angle = (FULL_ROTATION_RADIANS / armCount) * armIndex + stepIndex * SPIRAL_ANGLE_STEP;
      return { ...item, angle, distance, armIndex, stepIndex };
    });

    return { placements: placementsList, arms: armCount };
  }, [emojis, radius]);

  const driftValues = useMemo(() => placements.map(() => new Animated.Value(0)), [placements]);
  const driftLoops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    driftLoops.current.forEach((loop) => loop.stop());
    driftLoops.current = [];

    placements.forEach((placement, index) => {
      const value = driftValues[index];
      if (!value) {
        return;
      }

      value.setValue(0);
      const delay = placement.stepIndex * 180 + placement.armIndex * 120;
      const duration = SPIRAL_DRIFT_DURATION / Math.max(1, arms) + placement.stepIndex * 220;

      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();
      driftLoops.current.push(loop);
    });

    return () => {
      driftLoops.current.forEach((loop) => loop.stop());
      driftLoops.current = [];
    };
  }, [arms, driftValues, placements]);

  if (placements.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.container, { transform: [{ rotate }] }]}>
        {placements.map(({ id, emoji, angle, distance }, index) => {
          const drift = driftValues[index];
          const translateX = drift
            ? drift.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [distance * 0.92, distance + SPIRAL_DRIFT_RANGE, distance * 0.92],
              })
            : distance;
          const rotateOut = drift
            ? drift.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [`${angle - SPIRAL_TWIST}rad`, `${angle + SPIRAL_TWIST}rad`, `${angle - SPIRAL_TWIST}rad`],
              })
            : `${angle}rad`;
          const rotateBack = drift
            ? drift.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [`${-(angle - SPIRAL_TWIST)}rad`, `${-(angle + SPIRAL_TWIST)}rad`, `${-(angle - SPIRAL_TWIST)}rad`],
              })
            : `${-angle}rad`;
          const scale = drift
            ? drift.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.88, 1.08, 0.92],
              })
            : 1;

          return (
            <Animated.View
              key={id}
              style={[
                styles.emojiWrapper,
                {
                  transform: [
                    { rotate: rotateOut },
                    { translateX },
                    { rotate: rotateBack },
                    { scale },
                  ],
                },
              ]}
            >
            <Text style={[styles.emoji, emojiStyle, styles.emojiSpiral]}>{emoji}</Text>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

type LakeParticle = {
  id: string;
  emoji: string;
  drop: Animated.Value;
  bob: Animated.Value;
  sway: Animated.Value;
  startX: number;
  depth: number;
  dropDelay: number;
  dropDuration: number;
  bobDuration: number;
  swayDuration: number;
  bobAmplitude: number;
  swayRange: number;
};

function LakePool({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 50), [emojis]);
  const particles = useMemo<LakeParticle[]>(
    () =>
      limit.map((item, index) => {
        const drop = new Animated.Value(0);
        const bob = new Animated.Value(0);
        const sway = new Animated.Value(0);
        const dropDelay = Math.floor(randomForKey(item.id, index + 26) * 1400);
        const dropDuration =
          LAKE_DROP_DURATION_BASE + Math.floor(randomForKey(item.id, index + 27) * LAKE_DROP_VARIATION);
        const bobDuration =
          LAKE_FLOAT_DURATION_BASE + Math.floor(randomForKey(item.id, index + 28) * LAKE_FLOAT_VARIATION);
        const swayDuration =
          LAKE_SWAY_DURATION_BASE + Math.floor(randomForKey(item.id, index + 29) * LAKE_SWAY_VARIATION);
        const startX =
          radius * (randomForKey(item.id, index + 30) * LAKE_HORIZONTAL_SPAN - LAKE_HORIZONTAL_SPAN / 2);
        const depth =
          radius * (LAKE_DEPTH_MIN_RATIO + randomForKey(item.id, index + 31) * LAKE_DEPTH_VARIATION_RATIO);
        const bobAmplitude =
          LAKE_FLOAT_AMPLITUDE_BASE + randomForKey(item.id, index + 32) * LAKE_FLOAT_AMPLITUDE_VARIATION;
        const swayRange = radius * (LAKE_SWAY_RANGE_RATIO + randomForKey(item.id, index + 33) * 0.06);

        return {
          id: item.id,
          emoji: item.emoji,
          drop,
          bob,
          sway,
          startX,
          depth,
          dropDelay,
          dropDuration,
          bobDuration,
          swayDuration,
          bobAmplitude,
          swayRange,
        };
      }),
    [limit, radius]
  );

  const dropRefs = useRef<Animated.CompositeAnimation[]>([]);
  const loopRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    dropRefs.current.forEach((anim) => anim.stop());
    loopRefs.current.forEach((loop) => loop.stop());
    dropRefs.current = [];
    loopRefs.current = [];

    let cancelled = false;

    particles.forEach((particle) => {
      particle.drop.setValue(0);
      particle.bob.setValue(0);
      particle.sway.setValue(0);

      const dropAnim = Animated.sequence([
        Animated.delay(particle.dropDelay),
        Animated.timing(particle.drop, {
          toValue: 1,
          duration: particle.dropDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      dropRefs.current.push(dropAnim);
      dropAnim.start(() => {
        if (cancelled) {
          return;
        }

        const bobLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(particle.bob, {
              toValue: 1,
              duration: particle.bobDuration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(particle.bob, {
              toValue: -1,
              duration: particle.bobDuration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );

        const swayLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(particle.sway, {
              toValue: 1,
              duration: particle.swayDuration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(particle.sway, {
              toValue: -1,
              duration: particle.swayDuration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );

        bobLoop.start();
        swayLoop.start();
        loopRefs.current.push(bobLoop, swayLoop);
      });
    });

    return () => {
      cancelled = true;
      dropRefs.current.forEach((anim) => anim.stop());
      loopRefs.current.forEach((loop) => loop.stop());
      dropRefs.current = [];
      loopRefs.current = [];
    };
  }, [particles]);

  const sortedParticles = useMemo(
    () => [...particles].sort((a, b) => a.depth - b.depth),
    [particles]
  );

  if (sortedParticles.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {sortedParticles.map((particle) => {
        const dropTranslate = particle.drop.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [-radius * 1.3, radius * 0.35, particle.depth],
        });
        const bobTranslate = particle.bob.interpolate({
          inputRange: [-1, 1],
          outputRange: [-particle.bobAmplitude, particle.bobAmplitude],
        });
        const swayTranslate = particle.sway.interpolate({
          inputRange: [-1, 1],
          outputRange: [-particle.swayRange, particle.swayRange],
        });
        const scale = particle.bob.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.96, 1, 0.96],
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { translateX: particle.startX },
                  { translateX: swayTranslate },
                  { translateY: dropTranslate },
                  { translateY: bobTranslate },
                  { scale },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiLake]}>{particle.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

type MatrixDrop = {
  id: string;
  animated: Animated.Value;
  translateY: Animated.AnimatedInterpolation<string | number>;
  loop: Animated.CompositeAnimation;
  left: number;
  column: number;
  variant: HomeEmojiTheme;
};

type MatrixEmojiRainProps = {
  emojis: OrbitingEmoji[];
  radius: number;
  variant: HomeEmojiTheme;
};

function MatrixEmojiRain({ emojis, radius, variant }: MatrixEmojiRainProps) {
  const [drops, setDrops] = useState<MatrixDrop[]>([]);
  const dropsRef = useRef<MatrixDrop[]>([]);

  useEffect(() => () => {
    dropsRef.current.forEach((drop) => drop.loop.stop());
  }, []);

  useEffect(() => {
    setDrops((prev) => {
      const limited = emojis.slice(0, Math.min(28, emojis.length));
      const next: MatrixDrop[] = [];
      const retained = new Set<string>();

      limited.forEach((emoji) => {
        const column = getMatrixColumn(emoji.id);
        const targetLeft = getMatrixLeft(column);
        const existing = prev.find((drop) => drop.id === emoji.id);

        if (existing) {
          retained.add(existing.id);
          const needsRefresh =
            existing.left !== targetLeft || existing.column !== column || existing.variant !== variant;
          if (needsRefresh) {
            existing.loop.stop();
            next.push(createMatrixDrop(emoji.id, column, targetLeft, variant));
          } else {
            next.push(existing);
          }
        } else {
          next.push(createMatrixDrop(emoji.id, column, targetLeft, variant));
        }
      });

      prev.forEach((drop) => {
        if (!retained.has(drop.id)) {
          drop.loop.stop();
        }
      });

      dropsRef.current = next;
      return next;
    });
  }, [emojis, variant]);

  if (drops.length === 0) {
    return null;
  }

  const horizontalOffset = -(MATRIX_WIDTH - radius * 2) / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.matrixWrapper,
        {
          width: MATRIX_WIDTH,
          height: MATRIX_HEIGHT,
          top: 0,
          left: horizontalOffset,
        },
      ]}
    >
      {drops.map((drop) => {
        const emoji = emojis.find((item) => item.id === drop.id);
        if (!emoji) {
          return null;
        }

        return (
          <Animated.Text
            key={drop.id}
            style={[
              styles.matrixEmoji,
              { transform: [{ translateY: drop.translateY }], left: drop.left },
            ]}
          >
            {emoji.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

function createMatrixDrop(id: string, column: number, left: number, variant: HomeEmojiTheme): MatrixDrop {
  const animated = new Animated.Value(0);
  const duration = getMatrixDuration(column, variant);

  const loop = Animated.loop(
    Animated.sequence([
      Animated.delay(getMatrixDelay(column, variant)),
      Animated.timing(animated, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(animated, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ])
  );

  loop.start();

  const translateY = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [MATRIX_START_Y, MATRIX_END_Y],
  });

  return {
    id,
    animated,
    translateY,
    loop,
    left,
    column,
    variant,
  };
}

function getMatrixColumn(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) & 0xffffffff;
  }

  return Math.abs(hash) % MATRIX_COLUMNS;
}

function getMatrixLeft(column: number) {
  const availableWidth = MATRIX_WIDTH - MATRIX_PADDING * 2 - MATRIX_EMOJI_SIZE;
  if (availableWidth <= 0) {
    return MATRIX_PADDING;
  }

  if (MATRIX_COLUMNS <= 1) {
    return MATRIX_PADDING + availableWidth / 2;
  }

  const step = availableWidth / (MATRIX_COLUMNS - 1);
  return MATRIX_PADDING + column * step;
}

function getMatrixDuration(column: number, variant: HomeEmojiTheme) {
  const progress = column / Math.max(1, MATRIX_COLUMNS - 1);
  const base = variant === 'confetti' ? CONFETTI_DURATION_BASE : MATRIX_DURATION_BASE;
  const variation = variant === 'confetti' ? CONFETTI_DURATION_VARIATION : MATRIX_DURATION_VARIATION;
  return base + progress * variation;
}

function getMatrixDelay(column: number, variant: HomeEmojiTheme) {
  const step = variant === 'confetti' ? CONFETTI_DELAY_STEP : MATRIX_DELAY_STEP;
  return column * step;
}

function BubbleSwirl({ emojis, radius, emojiStyle }: BasePatternProps) {
  const ringConfigs = useMemo(
    () => [
      { radius: radius * 0.55, speed: 18000, scaleFrom: 0.94, scaleTo: 1.08 },
      { radius: radius * 0.82, speed: 22000, scaleFrom: 0.93, scaleTo: 1.05 },
      { radius: radius * 1.12, speed: 28000, scaleFrom: 0.9, scaleTo: 1.03 },
    ],
    [radius]
  );

  const assignments = useMemo(() => {
    const buckets = ringConfigs.map(() => [] as OrbitingEmoji[]);
    const limit = emojis.slice(0, 72);
    limit.forEach((emoji, index) => {
      buckets[index % ringConfigs.length].push(emoji);
    });
    return buckets;
  }, [emojis, ringConfigs]);

  const rotationValues = useMemo(() => ringConfigs.map(() => new Animated.Value(0)), [ringConfigs]);
  const pulseValues = useMemo(() => ringConfigs.map(() => new Animated.Value(0)), [ringConfigs]);

  useEffect(() => {
    const loops = rotationValues.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: ringConfigs[index].speed,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [ringConfigs, rotationValues]);

  useEffect(() => {
    const loops = pulseValues.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 2400 + index * 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 2400 + index * 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [pulseValues]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {assignments.map((items, index) => {
        if (items.length === 0) {
          return null;
        }

        const rotate = rotationValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
        });

        const scale = pulseValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [ringConfigs[index].scaleFrom, ringConfigs[index].scaleTo],
        });

        return (
          <Animated.View
            key={`bubble-ring-${index}`}
            style={[
              styles.container,
              { transform: [{ rotate }, { scale }] },
            ]}
          >
            {items.map((item, itemIndex) => {
              const angle = (FULL_ROTATION_RADIANS * itemIndex) / items.length;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.emojiWrapper,
                    {
                      transform: [
                        { rotate: `${angle}rad` },
                        { translateX: ringConfigs[index].radius },
                        { rotate: `${-angle}rad` },
                      ],
                    },
                  ]}
                >
                  <Text style={[styles.emoji, emojiStyle, styles.emojiBubble]}>{item.emoji}</Text>
                </View>
              );
            })}
          </Animated.View>
        );
      })}
    </View>
  );
}

function BubblePopBurst({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 48), [emojis]);
  const burstValues = useMemo(() => limit.map((item, index) => ({
    value: new Animated.Value(0),
    delay: Math.floor(randomForKey(item.id, index) * 1600),
    speed: 2000 + Math.floor(randomForKey(item.id, index + 1) * 1800),
  })), [limit]);

  useEffect(() => {
    const loops = burstValues.map(({ value, delay, speed }) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: speed,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: speed,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [burstValues]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {limit.map((emoji, index) => {
        const randomDistance = radius * (0.4 + randomForKey(emoji.id, index + 2) * 0.9);
        const angle = FULL_ROTATION_RADIANS * randomForKey(emoji.id, index + 3);
        const burst = burstValues[index];
        const translate = burst.value.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [randomDistance * 0.6, randomDistance, randomDistance * 0.4],
        });
        const scale = burst.value.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.7, 1.2, 0.8],
        });

        return (
          <Animated.View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { rotate: `${angle}rad` },
                  { translateX: translate },
                  { rotate: `${-angle}rad` },
                  { scale },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiBubblePop]}>{emoji.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function WaveRibbon({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 42), [emojis]);
  const wave = useLoopingValue(WAVE_DURATION);
  const width = radius * 2.8;
  const amplitude = radius * WAVE_AMPLITUDE_RATIO;

  const phaseValues = useMemo(
    () => limit.map((item, index) => new Animated.Value(randomForKey(item.id, index + 4))),
    [limit]
  );

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {limit.map((emoji, index) => {
        const baseX = -width / 2 + (width / Math.max(1, limit.length - 1)) * index;
        const progress = Animated.modulo(Animated.add(wave, phaseValues[index]), 1);
        const translateY = progress.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, amplitude, 0, -amplitude, 0],
        });
        const wobble = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.9, 1.1, 0.9],
        });

        return (
          <Animated.View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { translateX: baseX },
                  { translateY },
                  { scale: wobble },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiWave]}>{emoji.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function EchoPulse({ emojis, radius, emojiStyle }: BasePatternProps) {
  const rings = useMemo(
    () => [radius * 0.5, radius * 0.85, radius * 1.2],
    [radius]
  );
  const assignments = useMemo(() => {
    const buckets = rings.map(() => [] as OrbitingEmoji[]);
    const limit = emojis.slice(0, 48);
    limit.forEach((emoji, index) => {
      buckets[index % rings.length].push(emoji);
    });
    return buckets;
  }, [emojis, rings]);

  const scaleValues = useMemo(() => rings.map(() => new Animated.Value(0)), [rings]);

  useEffect(() => {
    const loops = scaleValues.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 2600 + index * 700,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 2600 + index * 700,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [scaleValues]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {assignments.map((items, index) => {
        if (items.length === 0) {
          return null;
        }

        const scale = scaleValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.2],
        });

        return (
          <Animated.View
            key={`echo-ring-${index}`}
            style={[styles.container, { transform: [{ scale }] }]}
          >
            {items.map((item, itemIndex) => {
              const angle = (FULL_ROTATION_RADIANS * itemIndex) / items.length;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.emojiWrapper,
                    {
                      transform: [
                        { rotate: `${angle}rad` },
                        { translateX: rings[index] },
                        { rotate: `${-angle}rad` },
                      ],
                    },
                  ]}
                >
                  <Text style={[styles.emoji, emojiStyle, styles.emojiEcho]}>{item.emoji}</Text>
                </View>
              );
            })}
          </Animated.View>
        );
      })}
    </View>
  );
}

function ConfettiStream({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 36), [emojis]);
  const streams = useMemo(
    () => limit.map((item, index) => ({
      id: item.id,
      emoji: item.emoji,
      startX: radius * (0.6 - randomForKey(item.id, index + 5) * 1.2),
      startY: -radius * (0.4 + randomForKey(item.id, index + 6)),
      endX: radius * (0.6 - randomForKey(item.id, index + 7) * 1.2) - radius * 0.8,
      endY: radius * (0.9 + randomForKey(item.id, index + 8)),
      delay: Math.floor(randomForKey(item.id, index + 9) * 1600),
      duration: 2600 + Math.floor(randomForKey(item.id, index + 10) * 2200),
    })),
    [limit, radius]
  );

  const animatedValues = useMemo(
    () => streams.map(() => new Animated.Value(0)),
    [streams]
  );

  useEffect(() => {
    const loops = animatedValues.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(streams[index].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: streams[index].duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [animatedValues, streams]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {streams.map((stream, index) => {
        const progress = animatedValues[index];
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [stream.startX, stream.endX],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [stream.startY, stream.endY],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['-18deg', '12deg'],
        });

        return (
          <Animated.View
            key={stream.id}
            style={[
              styles.emojiWrapper,
              { transform: [{ translateX }, { translateY }, { rotate }] },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiConfetti]}>{stream.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function LaserSweep({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 54), [emojis]);
  const rotation = useLoopingValue(10000);
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
  });
  const beamAngles = useMemo(() => [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4], []);

  const beamAssignments = useMemo(() => {
    const beams = beamAngles.map(() => [] as OrbitingEmoji[]);
    limit.forEach((emoji, index) => {
      beams[index % beamAngles.length].push(emoji);
    });
    return beams;
  }, [beamAngles, limit]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.container, { transform: [{ rotate }] }]}>{
        beamAssignments.map((beam, index) => (
          <View key={`laser-beam-${index}`} style={[styles.beamContainer, { transform: [{ rotate: `${beamAngles[index]}rad` }] }]}>{
            beam.map((emoji, emojiIndex) => {
              const distance = radius * (0.4 + emojiIndex * 0.35);
              return (
                <View
                  key={emoji.id}
                  style={[
                    styles.emojiWrapper,
                    {
                      transform: [
                        { translateX: distance },
                      ],
                    },
                  ]}
                >
                  <Text style={[styles.emoji, emojiStyle, styles.emojiLaser]}>{emoji.emoji}</Text>
                </View>
              );
            })
          }</View>
        ))
      }</Animated.View>
    </View>
  );
}

function AuroraVeil({ emojis, radius, emojiStyle }: BasePatternProps) {
  const columns = useMemo(() => Math.max(2, Math.min(5, Math.ceil(emojis.length / 4))), [emojis.length]);
  const columnWidth = radius * 2.4;
  const segmentHeight = radius * 0.45;
  const limit = useMemo(() => emojis.slice(0, columns * 4), [columns, emojis]);

  const progress = useLoopingValue(AURORA_DURATION, 0, Easing.inOut(Easing.sin));

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {Array.from({ length: columns }).map((_, columnIndex) => {
        const columnItems = limit.filter((_, index) => index % columns === columnIndex);
        if (columnItems.length === 0) {
          return null;
        }

        const baseX = -columnWidth / 2 + (columnWidth / Math.max(1, columns - 1)) * columnIndex;
        const columnPhase = randomForKey(`aurora-${columnIndex}`, columnIndex + 12);
        const shifted = Animated.modulo(Animated.add(progress, columnPhase), 1);
        const translateY = shifted.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [-AURORA_SHIFT, AURORA_SHIFT, -AURORA_SHIFT],
        });
        const skew = columnIndex % 2 === 0 ? '-6deg' : '6deg';

        return (
          <Animated.View
            key={`aurora-column-${columnIndex}`}
            style={[
              styles.columnContainer,
              {
                transform: [
                  { translateX: baseX },
                  { translateY },
                ],
              },
            ]}
          >
            <View style={[styles.columnInner, { transform: [{ skewY: skew }] }]}> 
              {columnItems.map((emoji, rowIndex) => (
                <View key={emoji.id} style={[styles.columnEmoji, { top: rowIndex * segmentHeight }]}> 
                  <Text style={[styles.emoji, emojiStyle, styles.emojiAurora]}>{emoji.emoji}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function FireflyField({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 40), [emojis]);
  const flickers = useMemo(
    () => limit.map((item, index) => ({
      value: new Animated.Value(0),
      duration:
        FIRELY_ALPHA_BASE + Math.floor(randomForKey(item.id, index + 14) * FIRELY_ALPHA_VARIATION),
      offset: Math.floor(randomForKey(item.id, index + 15) * 1800),
    })),
    [limit]
  );

  useEffect(() => {
    const loops = flickers.map(({ value, duration, offset }) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(offset),
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((loop) => loop.stop());
  }, [flickers]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {limit.map((emoji, index) => {
        const randomX = radius * (randomForKey(emoji.id, index + 16) * 2 - 1);
        const randomY = radius * (randomForKey(emoji.id, index + 17) * 2 - 1);
        const progress = flickers[index].value;
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [randomX * 0.92, randomX],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [randomY * 0.92, randomY],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.15, 1, 0.2],
        });

        return (
          <Animated.View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                transform: [{ translateX }, { translateY }],
                opacity,
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiFirefly]}>{emoji.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function StarlightHalo({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 50), [emojis]);
  const rotation = useLoopingValue(20000);
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
  });

  const points = useMemo(() => {
    const vertices = 5;
    const innerRadius = radius * 0.55;
    const outerRadius = radius * 1.05;
    return Array.from({ length: vertices * 2 }, (_, index) =>
      index % 2 === 0 ? outerRadius : innerRadius
    );
  }, [radius]);

  const placements = useMemo(() => {
    if (limit.length === 0) {
      return [];
    }

    return limit.map((emoji, index) => {
      const pointIndex = index % points.length;
      const radiusForPoint = points[pointIndex];
      const angle = (FULL_ROTATION_RADIANS * index) / points.length;
      return { ...emoji, angle, distance: radiusForPoint };
    });
  }, [limit, points]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.container, { transform: [{ rotate }] }]}>
        {placements.map(({ id, emoji, angle, distance }) => (
          <View
            key={id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { rotate: `${angle}rad` },
                  { translateX: distance },
                  { rotate: `${-angle}rad` },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiStarlight]}>{emoji}</Text>
          </View>
        ))
      }</Animated.View>
    </View>
  );
}

function NebulaSwirl({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 64), [emojis]);
  const rotation = useLoopingValue(NEBULA_DURATION, 0, Easing.inOut(Easing.quad));
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0rad', `${FULL_ROTATION_RADIANS}rad`],
  });

  const drift = useLoopingValue(NEBULA_DURATION * 0.8, 0, Easing.inOut(Easing.sin));

  const placements = useMemo(() => {
    return limit.map((emoji, index) => {
      const layer = index % 3;
      const baseRadius = radius * (0.4 + layer * 0.25);
      const wobble = randomForKey(emoji.id, index + 20) * radius * 0.18;
      const distance = baseRadius + wobble;
      const angle = FULL_ROTATION_RADIANS * randomForKey(emoji.id, index + 21);
      return { ...emoji, distance, angle, layer };
    });
  }, [limit, radius]);

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.container, { transform: [{ rotate }] }]}>{
        placements.map(({ id, emoji, distance, angle, layer }) => {
          const translateX = drift.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [distance * 0.9, distance * 1.05, distance * 0.9],
          });
          const scale = 0.9 + layer * 0.06;

          return (
            <Animated.View
              key={id}
              style={[
                styles.emojiWrapper,
                {
                  transform: [
                    { rotate: `${angle}rad` },
                    { translateX },
                    { rotate: `${-angle}rad` },
                    { scale },
                  ],
                },
              ]}
            >
              <Text style={[styles.emoji, emojiStyle, styles.emojiNebula]}>{emoji}</Text>
            </Animated.View>
          );
        })
      }</Animated.View>
    </View>
  );
}

function SupernovaBurst({ emojis, radius, emojiStyle }: BasePatternProps) {
  const limit = useMemo(() => emojis.slice(0, 40), [emojis]);
  const progress = useLoopingValue(SUPER_NOVA_DURATION, 0, Easing.inOut(Easing.quad));

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      {limit.map((emoji, index) => {
        const angle = FULL_ROTATION_RADIANS * (index / Math.max(1, limit.length));
        const maxDistance = radius * (0.6 + randomForKey(emoji.id, index + 24) * 0.8);
        const translate = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [maxDistance * 0.2, maxDistance, maxDistance * 0.3],
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1.4, 0.7],
        });

        return (
          <Animated.View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                transform: [
                  { rotate: `${angle}rad` },
                  { translateX: translate },
                  { rotate: `${-angle}rad` },
                  { scale },
                ],
              },
            ]}
          >
            <Text style={[styles.emoji, emojiStyle, styles.emojiSupernova]}>{emoji.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  emojiSpiral: {
    fontSize: 24,
  },
  emojiBubble: {
    textShadowColor: '#bae6fd',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emojiBubblePop: {
    textShadowColor: '#fbbf24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  emojiWave: {
    textShadowColor: '#38bdf8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  emojiLake: {
    textShadowColor: '#38bdf8',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  emojiEcho: {
    textShadowColor: '#38bdf8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emojiConfetti: {
    textShadowColor: '#fed7aa',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  emojiLaser: {
    textShadowColor: '#f472b6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  emojiAurora: {
    textShadowColor: '#a855f7',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  emojiFirefly: {
    textShadowColor: '#fde68a',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  emojiStarlight: {
    textShadowColor: '#c4b5fd',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 11,
  },
  emojiNebula: {
    textShadowColor: '#818cf8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 13,
  },
  emojiSupernova: {
    textShadowColor: '#fb7185',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  matrixWrapper: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  matrixEmoji: {
    position: 'absolute',
    fontSize: 24,
    color: '#bbf7d0',
    textShadowColor: 'rgba(15, 118, 110, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  beamContainer: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  columnContainer: {
    position: 'absolute',
  },
  columnInner: {
    position: 'relative',
  },
  columnEmoji: {
    position: 'absolute',
    left: -13,
  },
});

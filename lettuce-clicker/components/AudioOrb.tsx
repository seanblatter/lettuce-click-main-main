import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

interface PulsingAudioOrbProps {
  emoji: string;
  size?: number;
  ringColor: string;
  coreBackgroundColor: string;
}

export function PulsingAudioOrb({
  emoji,
  size = 52,
  ringColor,
  coreBackgroundColor,
}: PulsingAudioOrbProps) {
  const primaryPulse = useRef(new Animated.Value(0)).current;
  const secondaryPulse = useRef(new Animated.Value(0)).current;

  const coreRadius = size / 2;
  const innerRadius = (size * 0.73) / 2; // 38 out of 52

  useEffect(() => {
    const primaryAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(primaryPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(primaryPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const secondaryAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(secondaryPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(secondaryPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    primaryAnimation.start();
    secondaryAnimation.start();

    return () => {
      primaryAnimation.stop();
      secondaryAnimation.stop();
      primaryPulse.stopAnimation();
      secondaryPulse.stopAnimation();
    };
  }, [primaryPulse, secondaryPulse]);

  const primaryScale = primaryPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const primaryOpacity = primaryPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });
  const secondaryScale = secondaryPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.65],
  });
  const secondaryOpacity = secondaryPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });
  const coreScale = primaryPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const emojiSize = size * 0.6;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: coreRadius,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: coreRadius,
            borderWidth: 2,
            borderColor: ringColor,
            transform: [{ scale: primaryScale }],
            opacity: primaryOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: coreRadius,
            borderWidth: 2,
            borderColor: ringColor,
            transform: [{ scale: secondaryScale }],
            opacity: secondaryOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          {
            width: size * 0.73,
            height: size * 0.73,
            borderRadius: innerRadius,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: coreBackgroundColor,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
            transform: [{ scale: coreScale }],
          },
        ]}
      >
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

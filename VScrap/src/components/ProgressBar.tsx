import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

interface ProgressBarProps {
  progress: number;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  height?: number;
  indeterminate?: boolean;
}

export function ProgressBar({
  progress,
  color = 'primary',
  height = 6,
  indeterminate = false,
}: ProgressBarProps) {
  const { themeColors } = useTheme();
  const [animation] = useState(() => new Animated.Value(0));
  const [trackWidth, setTrackWidth] = useState(0);
  const clamped = Math.max(0, Math.min(100, progress));

  useEffect(() => {
    animation.stopAnimation();
    if (!indeterminate || trackWidth <= 0) {
      animation.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animation, indeterminate, trackWidth]);

  const indeterminateWidth = trackWidth * 0.36;
  const indeterminateOffset = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-indeterminateWidth, trackWidth],
  });
  const fillColors: [string, string] = color === 'primary'
    ? [themeColors.primary, themeColors.primaryDeep]
    : color === 'success'
      ? [themeColors.success, themeColors.successDeep]
      : color === 'warning'
        ? [themeColors.warning, themeColors.warningDeep]
        : [themeColors.danger, themeColors.dangerDeep];

  return (
    <View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { height, backgroundColor: themeColors.border }]}>
      {indeterminate ? (
        <Animated.View
          style={[
            styles.fill,
            {
              width: indeterminateWidth,
              transform: [{ translateX: indeterminateOffset }],
            },
          ]}>
          <LinearGradient
            colors={fillColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : clamped > 0 ? (
        <View style={[styles.fill, { width: `${clamped}%` }]}>
          <LinearGradient
            colors={fillColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    overflow: 'hidden',
    minWidth: 4,
  },
});

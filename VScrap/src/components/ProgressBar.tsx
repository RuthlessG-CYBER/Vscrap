import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  const clamped = indeterminate ? 35 : Math.max(0, Math.min(100, progress));
  const fillColors: [string, string] = color === 'primary'
    ? [themeColors.primary, themeColors.primaryDeep]
    : color === 'success'
      ? [themeColors.success, themeColors.successDeep]
      : color === 'warning'
        ? [themeColors.warning, themeColors.warningDeep]
        : [themeColors.danger, themeColors.dangerDeep];

  return (
    <View style={[styles.track, { height, backgroundColor: themeColors.border }]}>
      {clamped > 0 ? (
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

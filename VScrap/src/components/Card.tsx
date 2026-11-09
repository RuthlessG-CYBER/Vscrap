import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  variant?: 'surface' | 'elevated' | 'glass';
}

/**
 * Sharp-cornered flat surface. No rounding, no shadow: a square box only.
 */
export function Card({ children, style, padded = true, variant = 'surface' }: CardProps) {
  const { themeColors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: themeColors.surface,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        variant === 'elevated'
          ? {
              backgroundColor: themeColors.bgElevated,
              borderColor: themeColors.borderLight,
            }
          : null,
        variant === 'glass'
          ? {
              backgroundColor: themeColors.surfaceAlt,
              borderColor: themeColors.borderLight,
            }
          : null,
        padded && { padding: spacing.lg },
        style,
      ]}>
      {children}
    </View>
  );
}

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'surface' | 'danger' | 'ghost';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GradientButton({
  title,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
  style,
}: GradientButtonProps) {
  const { themeColors } = useTheme();
  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary'
              ? themeColors.primaryText
              : variant === 'surface' || variant === 'ghost'
                ? themeColors.primary
                : themeColors.white
          }
        />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={compact ? 15 : 18}
              color={
                variant === 'primary'
                  ? themeColors.primaryText
                  : variant === 'danger'
                    ? themeColors.dangerLight
                    : variant === 'surface'
                      ? themeColors.text
                      : variant === 'ghost'
                        ? themeColors.textMuted
                        : themeColors.white
              }
            />
          ) : null}
          <Text
            style={[
              styles.label,
              compact && styles.labelCompact,
              variant === 'primary' && styles.labelPrimary,
              variant === 'danger' && styles.labelDanger,
              variant === 'surface' && styles.labelSurface,
              variant === 'ghost' && styles.labelGhost,
              { color: variant === 'primary' ? themeColors.primaryText : variant === 'danger' ? themeColors.dangerLight : variant === 'surface' ? themeColors.text : variant === 'ghost' ? themeColors.textMuted : themeColors.white },
              isDisabled && styles.labelDisabled,
            ]}>
            {title}
          </Text>
        </>
      )}
    </>
  );

  const variantStyles = variant === 'primary'
    ? { backgroundColor: themeColors.primary }
    : variant === 'surface'
      ? { backgroundColor: themeColors.surfaceAlt, borderWidth: 1, borderColor: themeColors.borderLight }
      : variant === 'ghost'
        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: themeColors.border }
        : { backgroundColor: themeColors.dangerSoft, borderWidth: 1, borderColor: themeColors.danger };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrapper,
        compact && styles.wrapperCompact,
        variantStyles,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      <View style={[styles.inner, compact && styles.innerCompact]}>{content}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  wrapperCompact: {
    borderRadius: radius.badge,
  },
  inner: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  innerCompact: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...type.title,
    fontSize: 15,
    fontWeight: '800',
  },
  labelPrimary: {},
  labelCompact: {
    ...type.small,
    fontWeight: '700',
  },
  labelSurface: {},
  labelGhost: {},
  labelDanger: {},
  labelDisabled: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});

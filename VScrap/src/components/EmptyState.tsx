import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '@/components/GradientButton';
import { spacing, type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconOuter, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}>
        <LinearGradient
          colors={[themeColors.primarySoft, themeColors.accentSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={themeColors.primary} />
        </LinearGradient>
      </View>
      <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: themeColors.textMuted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <GradientButton
          title={actionLabel}
          onPress={onAction}
          variant="surface"
          compact
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  iconOuter: {
    padding: 6,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.h2,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    ...type.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
    lineHeight: 19,
  },
  action: {
    marginTop: spacing.lg,
  },
});

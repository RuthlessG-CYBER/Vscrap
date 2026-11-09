import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  badge?: string | number;
}

export function SectionHeader({ title, actionLabel, onAction, badge }: SectionHeaderProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titleGroup}>
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        {badge !== undefined && (
          <View style={[styles.badge, { backgroundColor: themeColors.surfaceAlt }]}>
            <Text style={[styles.badgeText, { color: themeColors.textMuted }]}>{badge}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={[styles.actionText, { color: themeColors.primary }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={themeColors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...type.h2,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  badgeText: {
    ...type.micro,
    fontSize: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    ...type.small,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
});

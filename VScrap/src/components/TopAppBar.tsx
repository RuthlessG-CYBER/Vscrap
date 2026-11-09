import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  imageSource?: ImageSourcePropType;
  badge?: string;
  rightAction?: React.ReactNode;
}

/**
 * Fixed, square top app bar. Sits above the scroll content on every tab so the
 * brand, page title and quick actions stay visible while the page scrolls.
 */
export function TopAppBar({
  title,
  subtitle,
  icon = 'sparkles',
  imageSource,
  badge,
  rightAction,
}: TopAppBarProps) {
  const { themeColors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: themeColors.bg, borderBottomColor: themeColors.border },
      ]}>
      <View style={styles.inner}>
        <View style={styles.left}>
          {imageSource ? (
            <Image source={imageSource} style={[styles.logo, styles.logoImage]} />
          ) : (
            <View style={[styles.logo, { backgroundColor: themeColors.primary }]}>
              <Ionicons name={icon} size={18} color={themeColors.primaryText} />
            </View>
          )}

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: themeColors.primarySoft }]}>
                  <Text style={[styles.badgeText, { color: themeColors.primary }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: themeColors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
      </View>

      <View style={[styles.accent, { backgroundColor: themeColors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  logo: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...type.h2,
    fontSize: 19,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    ...type.micro,
    fontSize: 9,
    fontWeight: '700',
  },
  subtitle: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accent: {
    position: 'absolute',
    left: spacing.lg,
    bottom: 0,
    width: 36,
    height: 2,
  },
});

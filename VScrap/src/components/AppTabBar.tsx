import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { selectActiveCount, useDownloadsStore } from '@/store/downloadStore';
import { spacing, type } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Home', icon: 'download-outline', activeIcon: 'download' },
  queue: { label: 'Queue', icon: 'list-outline', activeIcon: 'list' },
  library: { label: 'Library', icon: 'albums-outline', activeIcon: 'albums' },
  settings: { label: 'Settings', icon: 'options-outline', activeIcon: 'options' },
};

export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const activeCount = useDownloadsStore(selectActiveCount);
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg, borderTopColor: themeColors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TABS[route.name] ?? TABS.index;
          const options = descriptors[route.key]?.options;
          const badge = route.name === 'queue' && activeCount > 0 ? activeCount : null;

          const onPress = () => {
            haptics.tap();
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          const activeColor = themeColors.primary;
          const inactiveColor = themeColors.textDim;
          const currentColor = isFocused ? activeColor : inactiveColor;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? config.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
              <View style={[styles.iconContainer, isFocused && { backgroundColor: themeColors.primarySoft }]}>
                <Ionicons
                  name={isFocused ? config.activeIcon : config.icon}
                  size={22}
                  color={currentColor}
                />
                {badge ? (
                  <View style={[styles.badge, { backgroundColor: themeColors.primary, borderColor: themeColors.bg }]}>
                    <Text style={[styles.badgeText, { color: themeColors.primaryText }]}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color: currentColor }]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },
  iconContainer: {
    width: 58,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});

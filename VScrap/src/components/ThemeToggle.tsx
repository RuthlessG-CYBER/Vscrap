import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/context/ThemeContext';
import { haptics } from '@/utils/haptics';

const NEXT_MODE = {
  system: 'light',
  light: 'dark',
  dark: 'system',
} as const;

/** Cycles System → Light → Dark and shows the mode currently in effect. */
export function ThemeToggle() {
  const { themeColors, isDark } = useTheme();
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);

  const icon = themeMode === 'system' ? 'contrast-outline' : isDark ? 'moon' : 'sunny';
  const next = NEXT_MODE[themeMode];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${themeMode}. Tap to switch to ${next}.`}
      hitSlop={6}
      onPress={() => {
        haptics.tap();
        setThemeMode(next);
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: themeColors.surfaceAlt,
          borderColor: pressed ? themeColors.borderActive : themeColors.border,
        },
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={17} color={themeColors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});

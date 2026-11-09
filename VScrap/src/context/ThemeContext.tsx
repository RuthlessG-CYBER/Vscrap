import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { useSettingsStore, resolveThemeMode } from '@/store/settingsStore';
import { colors } from '@/theme';

/**
 * Light theme: sand-paper canvas, charcoal text, electric-blue actions.
 * Mirrors the same token names as the dark palette so components stay theme-agnostic.
 */
const LIGHT_COLORS: Record<string, string | number> = {
  bg: '#EDE6D8',
  bgElevated: '#F6F1E7',
  surface: '#F6F1E7',
  surfaceAlt: '#E5DCCB',
  surfaceHover: '#DCD1BD',
  surfaceHighlight: 'rgba(47, 107, 255, 0.08)',
  overlay: 'rgba(239, 232, 218, 0.92)',
  border: '#CFC3AC',
  borderSubtle: 'rgba(30, 30, 28, 0.10)',
  borderLight: '#BFB197',
  borderActive: '#2F6BFF',
  text: '#1E1E1C',
  textMuted: '#5C564B',
  textDim: '#857C6B',
  primary: '#2F6BFF',
  primaryLight: '#4E80FF',
  primaryDeep: '#1F4FD1',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(47, 107, 255, 0.12)',
  primaryGlow: 'rgba(47, 107, 255, 0.24)',
  accent: '#1E1E1C',
  accentLight: '#3A3A35',
  accentDeep: '#000000',
  accentSoft: 'rgba(30, 30, 28, 0.10)',
  accentGlow: 'rgba(30, 30, 28, 0.18)',
  success: '#3F8F63',
  successLight: '#57A77A',
  successDeep: '#2E6F4B',
  successSoft: 'rgba(63, 143, 99, 0.14)',
  warning: '#8C6B2F',
  warningLight: '#A98543',
  warningDeep: '#6E521F',
  warningSoft: 'rgba(140, 107, 47, 0.14)',
  danger: '#B83F34',
  dangerLight: '#C95448',
  dangerDeep: '#8F2E25',
  dangerSoft: 'rgba(184, 63, 52, 0.12)',
};

/** Dark theme: charcoal canvas, sand text, electric-blue actions. */
const DARK_COLORS: Record<string, string | number> = {
  bg: '#1E1E1C',
  bgElevated: '#262624',
  surface: '#232321',
  surfaceAlt: '#2A2A27',
  surfaceHover: '#32322E',
  surfaceHighlight: 'rgba(216, 203, 179, 0.06)',
  overlay: 'rgba(18, 18, 16, 0.88)',
  border: '#3A3A35',
  borderSubtle: 'rgba(216, 203, 179, 0.10)',
  borderLight: '#4A4A44',
  borderActive: '#2F6BFF',
  text: '#F2EEE6',
  textMuted: '#B3A997',
  textDim: '#7F786B',
  primary: '#2F6BFF',
  primaryLight: '#5B8AFF',
  primaryDeep: '#1F4FD1',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(47, 107, 255, 0.16)',
  primaryGlow: 'rgba(47, 107, 255, 0.30)',
  accent: '#D8CBB3',
  accentLight: '#E8DFCE',
  accentDeep: '#B3A386',
  accentSoft: 'rgba(216, 203, 179, 0.14)',
  accentGlow: 'rgba(216, 203, 179, 0.28)',
  success: '#7BC49A',
  successLight: '#9BD5B3',
  successDeep: '#4F9E73',
  successSoft: 'rgba(123, 196, 154, 0.14)',
  warning: '#D8CBB3',
  warningLight: '#E8DFCE',
  warningDeep: '#B3A386',
  warningSoft: 'rgba(216, 203, 179, 0.14)',
  danger: '#E2685A',
  dangerLight: '#EE8B7F',
  dangerDeep: '#B84A3E',
  dangerSoft: 'rgba(226, 104, 90, 0.14)',
};

type ThemeContextValue = {
  themeMode: 'light' | 'dark';
  isDark: boolean;
  themeColors: typeof colors & Partial<Record<string, string | number>>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const [effectiveMode, setEffectiveMode] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const onChange = () => {
      setEffectiveMode(resolveThemeMode(themeMode));
    };
    onChange();
    const sub = Appearance.addChangeListener(onChange);
    return () => sub.remove();
  }, [themeMode]);

  const isDark = effectiveMode === 'dark';
  const themeColors = useMemo(() => {
    if (isDark) return { ...colors, ...DARK_COLORS } as typeof colors & Partial<Record<string, string | number>>;
    return { ...colors, ...LIGHT_COLORS } as typeof colors & Partial<Record<string, string | number>>;
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ themeMode: effectiveMode, isDark, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

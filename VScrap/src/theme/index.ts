/**
 * Core palette: Charcoal / Sand / Electric Blue.
 * Everything in the app derives from these three anchors.
 */
export const palette = {
  charcoal: '#1E1E1C',
  sand: '#D8CBB3',
  electricBlue: '#2F6BFF',
  sandPaper: '#EFE8DA',
} as const;

/**
 * Default (dark) tokens. ThemeContext overrides these for light mode.
 * Dark = charcoal canvas, sand text/accents, electric-blue action color.
 */
export const colors = {
  bg: palette.charcoal,
  bgElevated: '#262624',
  overlay: 'rgba(18, 18, 16, 0.88)',
  surface: '#232321',
  surfaceAlt: '#2A2A27',
  surfaceHover: '#32322E',
  surfaceHighlight: 'rgba(216, 203, 179, 0.06)',
  border: '#3A3A35',
  borderSubtle: 'rgba(216, 203, 179, 0.10)',
  borderLight: '#4A4A44',
  borderActive: palette.electricBlue,
  text: '#F2EEE6',
  textMuted: '#B3A997',
  textDim: '#7F786B',
  // Primary: Electric Blue (download button, active chip, active tab)
  primary: palette.electricBlue,
  primaryLight: '#5B8AFF',
  primaryDeep: '#1F4FD1',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(47, 107, 255, 0.16)',
  primaryGlow: 'rgba(47, 107, 255, 0.30)',
  // Accent: Sand (online dot, verified, saved state)
  accent: palette.sand,
  accentLight: '#E8DFCE',
  accentDeep: '#B3A386',
  accentSoft: 'rgba(216, 203, 179, 0.14)',
  accentGlow: 'rgba(216, 203, 179, 0.28)',
  // Success / Warning / Danger: restrained status tones
  success: '#7BC49A',
  successLight: '#9BD5B3',
  successDeep: '#4F9E73',
  successSoft: 'rgba(123, 196, 154, 0.14)',
  warning: palette.sand,
  warningLight: '#E8DFCE',
  warningDeep: '#B3A386',
  warningSoft: 'rgba(216, 203, 179, 0.14)',
  danger: '#E2685A',
  dangerLight: '#EE8B7F',
  dangerDeep: '#B84A3E',
  dangerSoft: 'rgba(226, 104, 90, 0.14)',
  white: '#FFFFFF',
} as const;

export const gradients = {
  primary: ['#2F6BFF', '#1F4FD1'] as const,
  accent: ['#D8CBB3', '#B3A386'] as const,
  brand: ['#2F6BFF', '#1F4FD1'] as const,
  surface: ['#262624', '#1E1E1C'] as const,
  card: ['#262624', '#1E1E1C'] as const,
  danger: ['#E2685A', '#B84A3E'] as const,
  success: ['#7BC49A', '#4F9E73'] as const,
  warning: ['#D8CBB3', '#B3A386'] as const,
} as const;

/**
 * Square design language: every surface is a sharp box.
 * `pill` stays circular only for dots, badges and avatars.
 */
export const radius = {
  xs: 0,
  sm: 0,
  md: 0,
  lg: 0,
  xl: 0,
  xxl: 0,
  chip: 0,
  badge: 0,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

/** Flat design: no elevation, no drop shadows. */
export const shadows = {
  sm: {},
  card: {},
  glow: {},
  glowAccent: {},
} as const;

export const type = {
  fontFamily: {
    regular: 'JosefinSans_400',
    medium: 'JosefinSans_500',
    semiBold: 'JosefinSans_600',
    bold: 'JosefinSans_700',
    heading: 'ChangaOne',
    ui: 'SpaceGrotesk_400',
    uiMedium: 'SpaceGrotesk_500',
  },
  micro: {
    fontFamily: 'SpaceGrotesk_500',
    fontSize: 9,
    fontWeight: '500' as const,
    letterSpacing: 0.4,
  },
  small: {
    fontFamily: 'SpaceGrotesk_400',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: 'JosefinSans_400',
    fontSize: 11,
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  body: {
    fontFamily: 'JosefinSans_400',
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  bodyStrong: {
    fontFamily: 'JosefinSans_500',
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  title: {
    fontFamily: 'ChangaOne',
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
  },
  h2: {
    fontFamily: 'ChangaOne',
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },
  h1: {
    fontFamily: 'ChangaOne',
    fontSize: 22,
    fontWeight: '400' as const,
    letterSpacing: 0.6,
    lineHeight: 28,
  },
  hero: {
    fontFamily: 'ChangaOne',
    fontSize: 26,
    fontWeight: '400' as const,
    letterSpacing: 0.8,
    lineHeight: 32,
  },
} as const;

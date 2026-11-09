import { createStore } from '@/store/createStore';
import { Appearance, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

export interface SettingsState {
  autoSaveToGallery: boolean;
  wifiOnly: boolean;
  qualityPref: 'Highest Available (Source)' | 'Balanced 1080p (Fast)';
  concurrency: number;
  themeMode: 'light' | 'dark' | 'system';
  hydrated: boolean;
  hasAcceptedTerms: boolean;
  setAutoSaveToGallery: (value: boolean) => void;
  setWifiOnly: (value: boolean) => void;
  setQualityPref: (value: 'Highest Available (Source)' | 'Balanced 1080p (Fast)') => void;
  setConcurrency: (value: number) => void;
  setThemeMode: (value: 'light' | 'dark' | 'system') => void;
  acceptTerms: () => void;
}

type PersistedSettings = Pick<
  SettingsState,
  'autoSaveToGallery' | 'wifiOnly' | 'qualityPref' | 'concurrency' | 'themeMode' | 'hasAcceptedTerms'
>;

const SETTINGS_FILE_NAME = 'vscrap-settings.json';
const QUALITY_OPTIONS: SettingsState['qualityPref'][] = [
  'Highest Available (Source)',
  'Balanced 1080p (Fast)',
];
const THEME_OPTIONS: SettingsState['themeMode'][] = ['light', 'dark', 'system'];

const DEFAULTS: PersistedSettings = {
  autoSaveToGallery: true,
  wifiOnly: false,
  qualityPref: 'Highest Available (Source)',
  concurrency: 3,
  themeMode: 'system',
  hasAcceptedTerms: false,
};

function settingsFile(): File | null {
  // expo-file-system's File API is native-only.
  if (Platform.OS === 'web') return null;
  try {
    return new File(Paths.document, SETTINGS_FILE_NAME);
  } catch {
    return null;
  }
}

function loadPersisted(): PersistedSettings {
  const file = settingsFile();
  if (!file?.exists) return DEFAULTS;

  try {
    const raw = JSON.parse(file.textSync()) as Partial<PersistedSettings>;
    return {
      autoSaveToGallery:
        typeof raw.autoSaveToGallery === 'boolean'
          ? raw.autoSaveToGallery
          : DEFAULTS.autoSaveToGallery,
      wifiOnly: typeof raw.wifiOnly === 'boolean' ? raw.wifiOnly : DEFAULTS.wifiOnly,
      qualityPref:
        raw.qualityPref && QUALITY_OPTIONS.includes(raw.qualityPref)
          ? raw.qualityPref
          : DEFAULTS.qualityPref,
      concurrency:
        typeof raw.concurrency === 'number' && Number.isFinite(raw.concurrency)
          ? Math.max(1, Math.min(6, Math.round(raw.concurrency)))
          : DEFAULTS.concurrency,
      themeMode:
        raw.themeMode && THEME_OPTIONS.includes(raw.themeMode)
          ? raw.themeMode
          : DEFAULTS.themeMode,
      hasAcceptedTerms:
        typeof raw.hasAcceptedTerms === 'boolean'
          ? raw.hasAcceptedTerms
          : DEFAULTS.hasAcceptedTerms,
    };
  } catch {
    return DEFAULTS;
  }
}

function persistSettings(): void {
  const file = settingsFile();
  if (!file) return;

  const state = useSettingsStore.getState();
  const payload: PersistedSettings = {
    autoSaveToGallery: state.autoSaveToGallery,
    wifiOnly: state.wifiOnly,
    qualityPref: state.qualityPref,
    concurrency: state.concurrency,
    themeMode: state.themeMode,
    hasAcceptedTerms: state.hasAcceptedTerms,
  };

  try {
    if (!file.exists) file.create();
    file.writeSync(JSON.stringify(payload));
  } catch {
    // Persistence is best-effort; never block a settings change on disk I/O.
  }
}

/** Resolve the effective theme mode: 'system' maps to the OS preference. */
function resolveThemeMode(mode: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return (Appearance.getColorScheme() ?? 'dark');
}

const persisted = loadPersisted();

export const useSettingsStore = createStore<SettingsState>({
  ...persisted,
  hydrated: true,
  setAutoSaveToGallery: (value) => {
    useSettingsStore.setState({ autoSaveToGallery: value });
    persistSettings();
  },
  setWifiOnly: (value) => {
    useSettingsStore.setState({ wifiOnly: value });
    persistSettings();
  },
  setQualityPref: (value) => {
    useSettingsStore.setState({ qualityPref: value });
    persistSettings();
  },
  setConcurrency: (value) => {
    useSettingsStore.setState({ concurrency: Math.max(1, Math.min(6, value)) });
    persistSettings();
  },
  setThemeMode: (value) => {
    useSettingsStore.setState({ themeMode: value });
    persistSettings();
  },
  acceptTerms: () => {
    useSettingsStore.setState({ hasAcceptedTerms: true });
    persistSettings();
  },
});

export { resolveThemeMode };

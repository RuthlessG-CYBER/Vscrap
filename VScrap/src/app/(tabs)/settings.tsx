import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Screen } from '@/components/Screen';
import { StatStrip } from '@/components/StatStrip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopAppBar } from '@/components/TopAppBar';
import { useSettingsStore } from '@/store/settingsStore';
import { palette, spacing, type } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useTheme } from '@/context/ThemeContext';

const APP_ICON = require('../../../assets/images/icon.png');

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ThemeMode = 'light' | 'dark' | 'system';

const QUALITY_OPTIONS: {
  value: 'Highest Available (Source)' | 'Balanced 1080p (Fast)';
  title: string;
  description: string;
  tag: string;
}[] = [
  {
    value: 'Highest Available (Source)',
    title: 'Highest available',
    description: 'Keep the best source resolution the link offers, up to 4K.',
    tag: 'BEST',
  },
  {
    value: 'Balanced 1080p (Fast)',
    title: 'Data saver',
    description: 'Cap transfers at 720p for quicker downloads and smaller files.',
    tag: 'FAST',
  },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Sand' },
  { value: 'dark', label: 'Dark', hint: 'Charcoal' },
  { value: 'system', label: 'System', hint: 'OS sync' },
];

const appVersion = Constants.expoConfig?.version ?? '1.0.0';
const sdkVersion = Constants.expoConfig?.sdkVersion ?? '58';
const hostLabel =
  Platform.OS === 'android'
    ? `Android ${Platform.Version}`
    : Platform.OS === 'ios'
      ? `iOS ${Platform.Version}`
      : 'Web preview';
const deepLinkScheme = Array.isArray(Constants.expoConfig?.scheme)
  ? Constants.expoConfig?.scheme[0]
  : (Constants.expoConfig?.scheme ?? 'vscrap');

function SquareSwitch({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { themeColors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.switchTrack,
        {
          borderColor: value ? themeColors.primary : themeColors.borderLight,
          backgroundColor: value ? themeColors.primary : themeColors.surface,
        },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.switchKnob,
          {
            backgroundColor: value ? themeColors.primaryText : themeColors.textDim,
            marginLeft: value ? 20 : 0,
          },
        ]}
      />
    </Pressable>
  );
}

function SectionHeading({
  icon,
  title,
  meta,
}: {
  icon: IconName;
  title: string;
  meta?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingLeft}>
        <View style={[styles.sectionIcon, { backgroundColor: themeColors.primarySoft }]}>
          <Ionicons name={icon} size={14} color={themeColors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      </View>
      {meta ? (
        <Text style={[styles.sectionMeta, { color: themeColors.textMuted }]}>{meta}</Text>
      ) : null}
    </View>
  );
}

export default function SettingsRoute() {
  const autoSaveToGallery = useSettingsStore((state) => state.autoSaveToGallery);
  const setAutoSaveToGallery = useSettingsStore((state) => state.setAutoSaveToGallery);
  const wifiOnly = useSettingsStore((state) => state.wifiOnly);
  const setWifiOnly = useSettingsStore((state) => state.setWifiOnly);
  const qualityPref = useSettingsStore((state) => state.qualityPref);
  const setQualityPref = useSettingsStore((state) => state.setQualityPref);
  const concurrency = useSettingsStore((state) => state.concurrency);
  const setConcurrency = useSettingsStore((state) => state.setConcurrency);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);

  const { themeColors } = useTheme();

  const themeLabel = themeMode === 'system' ? 'System' : themeMode === 'light' ? 'Light' : 'Dark';

  const cycleTheme = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    haptics.tap();
    setThemeMode(next);
  };

  const adjustConcurrency = (delta: number) => {
    haptics.tap();
    setConcurrency(Math.max(1, Math.min(6, concurrency + delta)));
  };

  const themePreviewBg = (mode: ThemeMode) => {
    if (mode === 'light') return palette.sandPaper;
    if (mode === 'dark') return palette.charcoal;
    return palette.sand;
  };

  return (
    <Screen>
      <TopAppBar
        title="Settings"
        subtitle="Downloads, storage & appearance"
        imageSource={APP_ICON}
        rightAction={<ThemeToggle />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never">
        <View style={styles.statusRow}>
          <View style={styles.statusGroup}>
            <View style={[styles.statusDot, { backgroundColor: themeColors.primary }]} />
            <Text style={[styles.statusText, { color: themeColors.text }]}>
              Preferences save automatically
            </Text>
          </View>
          <Text style={[styles.statusMeta, { color: themeColors.textMuted }]}>v{appVersion}</Text>
        </View>

        <StatStrip
          items={[
            { label: 'Theme', value: themeLabel, tone: 'primary' },
            {
              label: 'Gallery',
              value: autoSaveToGallery ? 'Auto' : 'Manual',
              tone: autoSaveToGallery ? 'success' : 'default',
            },
            {
              label: 'Network',
              value: wifiOnly ? 'Wi-Fi' : 'Any',
              tone: wifiOnly ? 'primary' : 'default',
            },
            { label: 'Parallel', value: concurrency },
          ]}
        />

        {/* DOWNLOADS */}
        <View style={styles.section}>
          <SectionHeading icon="arrow-down-circle-outline" title="Downloads" meta="Engine behavior" />

          <View style={[styles.rowGroup, { borderTopColor: themeColors.border }]}>
            <View style={styles.settingRow}>
              <View style={[styles.rowIcon, { borderColor: themeColors.border }]}>
                <Ionicons name="images-outline" size={15} color={themeColors.textMuted} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingTitle, { color: themeColors.text }]}>
                  Auto-save to Gallery
                </Text>
                <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>
                  Register finished media in Android MediaStore right away.
                </Text>
              </View>
              <SquareSwitch
                label="Auto-save to Gallery"
                value={autoSaveToGallery}
                onChange={(next) => {
                  haptics.tap();
                  setAutoSaveToGallery(next);
                }}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: themeColors.border }]} />

            <View style={styles.settingRow}>
              <View style={[styles.rowIcon, { borderColor: themeColors.border }]}>
                <Ionicons name="wifi-outline" size={15} color={themeColors.textMuted} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingTitle, { color: themeColors.text }]}>
                  Download on Wi-Fi only
                </Text>
                <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>
                  Keep large transfers off cellular data whenever possible.
                </Text>
              </View>
              <SquareSwitch
                label="Download on Wi-Fi only"
                value={wifiOnly}
                onChange={(next) => {
                  haptics.tap();
                  setWifiOnly(next);
                }}
              />
            </View>
          </View>
        </View>

        {/* QUALITY */}
        <View style={styles.section}>
          <SectionHeading icon="speedometer-outline" title="Quality" meta="Default profile" />

          <View style={styles.optionList}>
            {QUALITY_OPTIONS.map((option) => {
              const active = qualityPref === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptics.tap();
                    setQualityPref(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      borderColor: active ? themeColors.primary : themeColors.border,
                      backgroundColor: active ? themeColors.primarySoft : themeColors.surface,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.radioBox,
                      { borderColor: active ? themeColors.primary : themeColors.borderLight },
                    ]}>
                    {active ? (
                      <View style={[styles.radioFill, { backgroundColor: themeColors.primary }]} />
                    ) : null}
                  </View>

                  <View style={styles.optionCopy}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionTitle, { color: themeColors.text }]}>
                        {option.title}
                      </Text>
                      <View
                        style={[
                          styles.optionTag,
                          {
                            borderColor: active ? themeColors.primary : themeColors.border,
                            backgroundColor: active
                              ? themeColors.primary
                              : themeColors.surfaceAlt,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.optionTagText,
                            { color: active ? themeColors.primaryText : themeColors.textMuted },
                          ]}>
                          {option.tag}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.optionDesc, { color: themeColors.textMuted }]}>
                      {option.description}
                    </Text>
                  </View>

                  <Ionicons
                    name={active ? 'checkmark' : 'ellipse-outline'}
                    size={16}
                    color={active ? themeColors.primary : themeColors.textDim}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* CONCURRENCY */}
        <View style={styles.section}>
          <SectionHeading icon="git-network-outline" title="Parallel transfers" meta="1–6 at once" />

          <View style={[styles.stepperGroup, { borderColor: themeColors.border }]}>
            <View style={styles.stepperCopy}>
              <Text style={[styles.settingTitle, { color: themeColors.text }]}>
                Simultaneous downloads
              </Text>
              <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>
                New links wait in the queue once this limit is reached.
              </Text>
            </View>

            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Decrease simultaneous downloads"
                onPress={() => adjustConcurrency(-1)}
                disabled={concurrency <= 1}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                  concurrency <= 1 && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="remove" size={16} color={themeColors.text} />
              </Pressable>

              <View style={[styles.stepValue, { borderColor: themeColors.border }]}>
                <Text style={[styles.stepValueText, { color: themeColors.text }]}>
                  {concurrency}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Increase simultaneous downloads"
                onPress={() => adjustConcurrency(1)}
                disabled={concurrency >= 6}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                  concurrency >= 6 && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="add" size={16} color={themeColors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.meter}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.meterCell,
                  {
                    backgroundColor:
                      index < concurrency ? themeColors.primary : themeColors.surfaceAlt,
                    borderColor: themeColors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* APPEARANCE */}
        <View style={styles.section}>
          <SectionHeading icon="color-palette-outline" title="Appearance" meta="Theme" />

          <View style={[styles.themeRow, { borderColor: themeColors.border }]}>
            {THEME_OPTIONS.map((option) => {
              const active = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptics.tap();
                    setThemeMode(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.themeCard,
                    {
                      borderColor: active ? themeColors.primary : themeColors.border,
                      backgroundColor: active ? themeColors.primarySoft : themeColors.surface,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.themePreview,
                      { backgroundColor: themePreviewBg(option.value) },
                    ]}>
                    <View style={[styles.previewBar, { backgroundColor: palette.electricBlue }]} />
                    <View
                      style={[
                        styles.previewBar,
                        styles.previewBarShort,
                        { backgroundColor: option.value === 'dark' ? palette.sand : '#8A8070' },
                      ]}
                    />
                    {active ? (
                      <View style={[styles.previewCheck, { backgroundColor: themeColors.primary }]}>
                        <Ionicons name="checkmark" size={10} color={themeColors.primaryText} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.themeLabel, { color: themeColors.text }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.themeHint, { color: themeColors.textMuted }]}>
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={cycleTheme}
            style={({ pressed }) => [
              styles.themeCycle,
              { borderColor: themeColors.border, backgroundColor: themeColors.surface },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="contrast-outline" size={14} color={themeColors.primary} />
            <Text style={[styles.themeCycleText, { color: themeColors.text }]}>
              Quick cycle theme
            </Text>
            <Text style={[styles.themeCycleValue, { color: themeColors.primary }]}>
              {themeLabel}
            </Text>
          </Pressable>
        </View>

        {/* ABOUT */}
        <View style={styles.section}>
          <SectionHeading icon="information-circle-outline" title="About" meta="VScrap" />

          <View style={[styles.aboutBlock, { borderColor: themeColors.border }]}>
            <View style={styles.aboutHeader}>
              <View>
                <Text style={[styles.aboutTitle, { color: themeColors.text }]}>
                  VScrap for Android
                </Text>
                <Text style={[styles.aboutVersion, { color: themeColors.textMuted }]}>
                  Version {appVersion}
                </Text>
              </View>
              <View style={[styles.stableBadge, { backgroundColor: themeColors.surfaceAlt }]}>
                <Text style={[styles.stableText, { color: themeColors.textMuted }]}>STABLE</Text>
              </View>
            </View>

            <View style={[styles.detailGrid, { borderColor: themeColors.border }]}>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, { color: themeColors.textMuted }]}>Engine</Text>
                <Text style={[styles.gridValue, { color: themeColors.text }]}>
                  Expo SDK {sdkVersion}
                </Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, { color: themeColors.textMuted }]}>Host</Text>
                <Text style={[styles.gridValue, { color: themeColors.text }]}>{hostLabel}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, { color: themeColors.textMuted }]}>Deep link</Text>
                <Text style={[styles.gridValue, { color: themeColors.primary }]}>
                  {deepLinkScheme}://download?url=
                </Text>
              </View>
            </View>

            <View style={[styles.linksBlock, { borderTopColor: themeColors.border }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.linkRow,
                  { borderBottomColor: themeColors.borderSubtle },
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  Alert.alert(
                    'Privacy Policy',
                    'VScrap is local-first. No logs, analytics, or user telemetry are recorded.'
                  )
                }>
                <Text style={[styles.linkText, { color: themeColors.text }]}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.linkRow,
                  { borderBottomColor: themeColors.borderSubtle },
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  Alert.alert(
                    'Proxy Security Audit',
                    'SSRF protection, domain whitelisting, and strict HTTPS certificates are enforced.'
                  )
                }>
                <Text style={[styles.linkText, { color: themeColors.text }]}>
                  Proxy Security Audit
                </Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.linkRow,
                  { borderBottomColor: themeColors.borderSubtle },
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  Alert.alert(
                    'Content & Copyright Rights',
                    'Please respect site terms and intellectual property rights.'
                  )
                }>
                <Text style={[styles.linkText, { color: themeColors.text }]}>
                  Content & Copyright Rights
                </Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.aboutFooter, { color: themeColors.textMuted }]}>
              Local-first media downloader. Cache only what you have the right to keep.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 24,
    gap: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  statusMeta: {
    ...type.small,
    fontSize: 11,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...type.h2,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  sectionMeta: {
    ...type.micro,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  rowGroup: {
    borderTopWidth: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
    gap: 3,
  },
  settingTitle: {
    ...type.bodyStrong,
    fontSize: 13.5,
    letterSpacing: 0.1,
  },
  settingSub: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 15,
  },
  separator: {
    height: 1,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 18,
    height: 18,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  radioBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    ...type.bodyStrong,
    fontSize: 13.5,
    letterSpacing: 0.1,
  },
  optionTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
  },
  optionTagText: {
    ...type.micro,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  optionDesc: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 15,
  },
  stepperGroup: {
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  stepperCopy: {
    gap: 3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    width: 40,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 52,
    height: 36,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: {
    ...type.h2,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  disabled: {
    opacity: 0.4,
  },
  meter: {
    flexDirection: 'row',
    gap: 5,
  },
  meterCell: {
    flex: 1,
    height: 5,
    borderWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  themeCard: {
    flex: 1,
    padding: spacing.sm,
    gap: 5,
    borderWidth: 1,
    margin: -1,
  },
  themePreview: {
    height: 40,
    padding: 6,
    gap: 4,
    justifyContent: 'flex-end',
  },
  previewBar: {
    height: 5,
    width: '76%',
  },
  previewBarShort: {
    width: '46%',
  },
  previewCheck: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLabel: {
    ...type.bodyStrong,
    fontSize: 12,
    marginTop: 1,
  },
  themeHint: {
    ...type.micro,
    fontSize: 9,
  },
  themeCycle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderWidth: 1,
  },
  themeCycleText: {
    ...type.bodyStrong,
    flex: 1,
    fontSize: 12,
  },
  themeCycleValue: {
    ...type.small,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  aboutBlock: {
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  aboutTitle: {
    ...type.bodyStrong,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  aboutVersion: {
    ...type.caption,
    fontSize: 11,
    marginTop: 1,
  },
  stableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stableText: {
    ...type.micro,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  detailGrid: {
    borderWidth: 1,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  gridLabel: {
    ...type.small,
    fontSize: 11,
  },
  gridValue: {
    ...type.small,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  linksBlock: {
    borderTopWidth: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  linkText: {
    ...type.bodyStrong,
    fontSize: 12.5,
  },
  aboutFooter: {
    ...type.caption,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.995 }],
  },
});

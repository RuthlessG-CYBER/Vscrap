import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { GradientButton } from '@/components/GradientButton';
import { LibraryCard } from '@/components/LibraryCard';
import { Screen } from '@/components/Screen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopAppBar } from '@/components/TopAppBar';
import { apiClient, errorMessage } from '@/services/apiClient';
import { useDownloadsStore } from '@/store/downloadStore';
import { radius, spacing, type } from '@/theme';
import type { MediaFormatOption } from '@/types/media';
import { formatBytes } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import {
  isShareLink,
  validateUrl,
} from '@/utils/urlUtils';
import { useTheme } from '@/context/ThemeContext';

const APP_ICON = require('../../../assets/images/icon.png');

export default function HomeRoute() {
  const router = useRouter();
  const items = useDownloadsStore((state) => state.items);
  const enqueue = useDownloadsStore((state) => state.enqueue);
  const { themeColors } = useTheme();

  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formats, setFormats] = useState<MediaFormatOption[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [formatsLoading, setFormatsLoading] = useState(false);
  const [formatsError, setFormatsError] = useState<string | null>(null);

  const validation = useMemo(() => (url.trim() ? validateUrl(url) : null), [url]);
  const shareLink = Boolean(validation?.valid && validation.share);
  const activeFormat = shareLink ? selectedFormat : null;

  useEffect(() => {
    const trimmed = url.trim();
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!trimmed || !isShareLink(trimmed)) {
        setFormats([]);
        setSelectedFormat(null);
        setFormatsError(null);
        setFormatsLoading(false);
        return;
      }

      setFormatsLoading(true);
      setFormatsError(null);

      void (async () => {
        try {
          const result = await apiClient.post<{ formats?: MediaFormatOption[] }>(
            '/api/download/formats',
            { url: trimmed },
            { timeoutMs: 60000 }
          );
          if (cancelled) return;
          const options = Array.isArray(result.formats) ? result.formats : [];
          setFormats(options);
          setSelectedFormat((current) =>
            current && options.some((entry) => entry.id === current)
              ? current
              : options[0]?.id ?? null
          );
        } catch (error) {
          if (cancelled) return;
          setFormats([]);
          setSelectedFormat(null);
          setFormatsError(errorMessage(error));
        } finally {
          if (!cancelled) setFormatsLoading(false);
        }
      })();
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  const completed = useMemo(
    () =>
      items
        .filter((item) => item.status === 'completed')
        .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || b.createdAt)),
    [items]
  );
  const activeCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'queued' || item.status === 'analyzing' || item.status === 'downloading'
      ).length,
    [items]
  );
  const totalBytes = useMemo(
    () => completed.reduce((total, item) => total + (item.size || 0), 0),
    [completed]
  );

  const storageParts = useMemo(() => {
    const formatted = formatBytes(totalBytes);
    const parts = formatted.split(' ');
    return { number: parts[0] ?? '0', unit: parts[1] ?? 'B' };
  }, [totalBytes]);

  const recent = completed.slice(0, 3);

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        Alert.alert('Clipboard is empty', 'Copy a media link first, then try again.');
        return;
      }
      haptics.tap();
      setUrl(text.trim());
    } catch (error) {
      haptics.error();
      Alert.alert('Could not paste', errorMessage(error));
    }
  };

  const startDownload = async () => {
    const trimmed = url.trim();
    const result = validateUrl(trimmed);
    if (!result.valid) {
      haptics.error();
      Alert.alert('Check the link', result.message);
      return;
    }

    setSubmitting(true);
    try {
      await enqueue(trimmed, activeFormat);
      haptics.success();
      setUrl('');
      router.navigate('/queue');
    } catch (error) {
      haptics.error();
      Alert.alert('Could not start the download', errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopAppBar
        title="VScrap"
        subtitle="Media Downloader"
        imageSource={APP_ICON}
        badge="2.0"
        rightAction={<ThemeToggle />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never">
        <View style={styles.heroSection}>
          <View style={styles.heroTitleRow}>
            <Text style={[styles.heroTitle, { color: themeColors.text }]}>Download media</Text>
            <View style={[styles.engineBadge, { backgroundColor: themeColors.surfaceAlt }]}>
              <Ionicons
                name="flash"
                size={11}
                color={themeColors.textMuted}
              />
              <Text style={[styles.engineBadgeText, { color: themeColors.textMuted }]}>
                Lossless engine
              </Text>
            </View>
          </View>
          <Text style={[styles.heroSubtitle, { color: themeColors.textMuted }]}>
            Fast, lossless downloads directly from supported platforms.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.statTop}>
              <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>Active</Text>
              <Ionicons
                name="sync-outline"
                size={15}
                color={themeColors.primary}
              />
            </View>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {activeCount}
            </Text>
            <Text style={[styles.statSublabel, { color: themeColors.textMuted }]}>
              Tasks running
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.statTop}>
              <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>Saved</Text>
              <Ionicons
                name="folder-outline"
                size={15}
                color={themeColors.primary}
              />
            </View>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {completed.length}
            </Text>
            <Text style={[styles.statSublabel, { color: themeColors.textMuted }]}>
              Media assets
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.statTop}>
              <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>Storage</Text>
              <Ionicons
                name="pie-chart-outline"
                size={15}
                color={themeColors.warning}
              />
            </View>
            <View style={styles.storageValueRow}>
              <Text style={[styles.statValue, { color: themeColors.text }]}>
                {storageParts.number}
              </Text>
              <Text style={[styles.storageUnit, { color: themeColors.text }]}>
                {storageParts.unit}
              </Text>
            </View>
            <Text style={[styles.statSublabel, { color: themeColors.textMuted }]}>
              Internal space
            </Text>
          </View>
        </View>

        <View style={[styles.inputCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={styles.urlHeader}>
            <Text style={[styles.urlLabel, { color: themeColors.textMuted }]}>Media URL</Text>
            <View style={styles.clipboardReadyRow}>
              <Ionicons
                name="clipboard-outline"
                size={13}
                color={themeColors.primary}
              />
              <Text style={[styles.clipboardReadyText, { color: themeColors.primary }]}>
                Clipboard ready
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: themeColors.surfaceAlt, borderColor: validation ? (validation.valid ? themeColors.borderActive : themeColors.danger) : themeColors.border },
            ]}>
            <Ionicons
              name="link-outline"
              size={18}
              color={themeColors.textDim}
            />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://instagram.com/p/... ..."
              placeholderTextColor={themeColors.textDim}
              style={[styles.input, { color: themeColors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              returnKeyType="go"
              onSubmitEditing={() => void startDownload()}
              selectionColor={themeColors.primary}
            />
            {url.length > 0 && (
              <Pressable
                accessibilityLabel="Clear link"
                hitSlop={8}
                onPress={() => setUrl('')}
                style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={themeColors.textDim}
                />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Paste from clipboard"
              onPress={() => void pasteFromClipboard()}
              style={({ pressed }) => [styles.pasteBtn, pressed && styles.pressed]}>
              <Ionicons
                name="clipboard-outline"
                size={13}
                color={themeColors.text}
              />
              <Text style={[styles.pasteBtnText, { color: themeColors.text }]}>Paste</Text>
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={themeColors.accent}
            />
            <Text style={[styles.statusRowText, { color: themeColors.accent }]}>
              {validation?.valid
                ? validation.share
                  ? `HTTPS Verified • ${validation.host} active`
                  : `HTTPS Verified • Direct proxy stream active`
                : 'HTTPS Verified • Direct proxy stream active'}
            </Text>
          </View>

          <View style={styles.formatBlock}>
            <View style={styles.labelRow}>
              <Text style={[styles.formatLabel, { color: themeColors.textMuted }]}>
                Output format & fidelity
              </Text>
              {formatsLoading && (
                <ActivityIndicator size="small" color={themeColors.primary} />
              )}
            </View>

            {formatsError ? (
              <Text style={[styles.formatError, { color: themeColors.dangerLight }]}>
                {formatsError}
              </Text>
            ) : formats.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.formatChips}>
                <Pressable
                  key="auto-best"
                  accessibilityRole="button"
                  accessibilityState={selectedFormat === null ? { selected: true } : {}}
                  onPress={() => {
                    haptics.tap();
                    setSelectedFormat(null);
                  }}
                  style={({ pressed }) => [
                    styles.formatChip,
                    selectedFormat === null
                      ? [styles.formatChipActive, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]
                      : [styles.formatChipInactive, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }],
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.formatChipText,
                      selectedFormat === null
                        ? [styles.formatChipTextActive, { color: themeColors.primaryText }]
                        : [styles.formatChipTextInactive, { color: themeColors.textMuted }],
                    ]}>
                    Auto (Best)
                  </Text>
                </Pressable>
                {formats.map((option) => {
                  const active = option.id === selectedFormat;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={active ? { selected: true } : {}}
                      onPress={() => {
                        haptics.tap();
                        setSelectedFormat(option.id);
                      }}
                      style={({ pressed }) => [
                        styles.formatChip,
                        active
                          ? [styles.formatChipActive, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]
                          : [styles.formatChipInactive, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }],
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.formatChipText,
                          active
                            ? [styles.formatChipTextActive, { color: themeColors.primaryText }]
                            : [styles.formatChipTextInactive, { color: themeColors.textMuted }],
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.formatChips}>
              <View style={[styles.formatChip, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
                  <Text style={[styles.formatChipText, { color: themeColors.primaryText }]}>
                    Auto (Best)
                  </Text>
                </View>
                <View style={[styles.formatChip, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}>
                  <Text style={[styles.formatChipText, { color: themeColors.textMuted }]}>
                    1080p Video
                  </Text>
                </View>
                <View style={[styles.formatChip, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}>
                  <Text style={[styles.formatChipText, { color: themeColors.textMuted }]}>
                    MP3 Audio
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>

          <GradientButton
            title="Download Resource"
            icon="download-outline"
            onPress={() => void startDownload()}
            loading={submitting}
          />

          <View style={styles.footnoteRow}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={themeColors.textDim}
            />
            <Text style={[styles.footnoteText, { color: themeColors.textMuted }]}>
              Automatic clipboard detection enabled. Supports reel sequences, 4K videos, stories &
              master audio tracks.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Recent downloads
              </Text>
              <View style={styles.todayBadge}>
                <Text style={[styles.todayBadgeText, { color: themeColors.textMuted }]}>
                  {completed.length} today
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/library')}
              style={({ pressed }) => [styles.viewAllBtn, pressed && styles.pressed]}>
              <Text style={[styles.viewAllText, { color: themeColors.primary }]}>
                View all
              </Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={themeColors.primary}
              />
            </Pressable>
          </View>

          {recent.length > 0 ? (
            <View style={styles.recentList}>
              {recent.map((item) => (
                <LibraryCard key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyRecent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="cloud-download-outline"
                  size={24}
                  color={themeColors.primary}
                />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                  No downloads yet
                </Text>
                <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                  Finished files will appear here, ready to open, share or save to your gallery.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 20,
    gap: spacing.lg,
  },
  heroSection: {
    gap: 4,
    marginTop: 2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    ...type.hero,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.badge,
  },
  engineBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  heroSubtitle: {
    ...type.body,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    padding: spacing.md,
    gap: 3,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    ...type.h1,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  storageValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 2,
  },
  storageUnit: {
    fontSize: 12,
    fontWeight: '800',
  },
  statSublabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  inputCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
  },
  urlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urlLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  clipboardReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clipboardReadyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...type.body,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  clearBtn: {
    padding: 4,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
  },
  statusRowText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formatBlock: {
    gap: spacing.xs + 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  formatChips: {
    gap: 8,
    paddingRight: spacing.sm,
  },
  formatChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatChipActive: {
  },
  formatChipInactive: {
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  formatChipTextActive: {
  },
  formatChipTextInactive: {
  },
  formatError: {
    fontSize: 11,
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  footnoteText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...type.h2,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  todayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    gap: spacing.md,
  },
  emptyRecent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    ...type.title,
    fontSize: 14,
  },
  emptyText: {
    ...type.small,
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
});

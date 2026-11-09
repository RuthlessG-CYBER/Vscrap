import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { LibraryCard } from '@/components/LibraryCard';
import { Screen } from '@/components/Screen';
import { StatStrip } from '@/components/StatStrip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopAppBar } from '@/components/TopAppBar';
import { useDownloadsStore } from '@/store/downloadStore';
import type { MediaKind } from '@/utils/urlUtils';
import { spacing, type } from '@/theme';
import { formatBytes } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | MediaKind;

const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'All', icon: 'albums-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { key: 'image', label: 'Images', icon: 'image-outline' },
  { key: 'file', label: 'Files', icon: 'document-text-outline' },
];

export default function LibraryRoute() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const items = useDownloadsStore((state) => state.items);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const files = useMemo(
    () => items.filter((item) => item.status === 'completed' && Boolean(item.localUri)),
    [items]
  );

  const totalBytes = useMemo(
    () => files.reduce((total, item) => total + (item.size || 0), 0),
    [files]
  );

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: files.length,
      image: 0,
      video: 0,
      audio: 0,
      file: 0,
    };
    for (const item of files) {
      base[item.mediaKind] += 1;
    }
    return base;
  }, [files]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((item) => {
      if (filter !== 'all' && item.mediaKind !== filter) return false;
      if (!needle) return true;
      return (
        item.filename.toLowerCase().includes(needle) ||
        item.url.toLowerCase().includes(needle)
      );
    });
  }, [files, filter, query]);

  const isFiltering = query.trim().length > 0 || filter !== 'all';

  const clearFilters = () => {
    haptics.tap();
    setQuery('');
    setFilter('all');
  };

  return (
    <Screen>
      <TopAppBar
        title="Library"
        subtitle={`${files.length} file${files.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)}`}
        icon="folder-outline"
        rightAction={<ThemeToggle />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never">
        <View style={styles.statusRow}>
          <View style={styles.statusGroup}>
            <Ionicons name="archive-outline" size={14} color={themeColors.primary} />
            <Text style={[styles.statusText, { color: themeColors.text }]}>Local archive</Text>
          </View>
          <Text style={[styles.statusMeta, { color: themeColors.textMuted }]}>
            {isFiltering ? `${filtered.length} shown` : `${files.length} stored`}
          </Text>
        </View>

        <StatStrip
          items={[
            { label: 'Files', value: files.length, tone: 'primary' },
            { label: 'Videos', value: counts.video },
            { label: 'Audio', value: counts.audio },
            { label: 'Storage', value: formatBytes(totalBytes) },
          ]}
        />

        <View
          style={[
            styles.searchWrap,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          ]}>
          <Ionicons name="search" size={16} color={themeColors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search saved media"
            placeholderTextColor={themeColors.textDim}
            style={[styles.searchInput, { color: themeColors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={themeColors.primary}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => setQuery('')}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}>
              <Ionicons name="close-circle" size={17} color={themeColors.textDim} />
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.filterBar,
            { borderColor: themeColors.border, backgroundColor: themeColors.surface },
          ]}>
          {FILTERS.map((entry, index) => {
            const active = entry.key === filter;
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                onPress={() => {
                  haptics.tap();
                  setFilter(entry.key);
                }}
                style={({ pressed }) => [
                  styles.filterCell,
                  index < FILTERS.length - 1
                    ? { borderRightWidth: 1, borderRightColor: themeColors.border }
                    : null,
                  active ? { backgroundColor: themeColors.primary } : null,
                  pressed ? styles.pressed : null,
                ]}>
                <View style={styles.filterTop}>
                  <Ionicons
                    name={entry.icon}
                    size={13}
                    color={active ? themeColors.primaryText : themeColors.textMuted}
                  />
                  <Text
                    style={[
                      styles.filterCount,
                      { color: active ? themeColors.primaryText : themeColors.textDim },
                    ]}>
                    {counts[entry.key]}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? themeColors.primaryText : themeColors.textMuted },
                  ]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Saved media</Text>
          <Text style={[styles.sectionMeta, { color: themeColors.textMuted }]}>
            {filtered.length} of {files.length}
          </Text>
        </View>

        {filtered.length === 0 ? (
          files.length === 0 ? (
            <EmptyState
              icon="folder-open-outline"
              title="Your library is empty"
              message="Downloaded media will be stored here. Paste a link on the home tab to start archiving."
              actionLabel="Add a link"
              onAction={() => router.navigate('/')}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No results found"
              message="No files match your current search query or filter."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          )
        ) : (
          <View style={styles.list}>
            {filtered.map((item) => (
              <LibraryCard key={item.id} item={item} />
            ))}
          </View>
        )}

        {filtered.length > 0 && isFiltering ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearFilters}
            style={({ pressed }) => [
              styles.resetBtn,
              { borderColor: themeColors.border, backgroundColor: themeColors.surface },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="funnel-outline" size={13} color={themeColors.primary} />
            <Text style={[styles.resetText, { color: themeColors.primary }]}>Reset filters</Text>
          </Pressable>
        ) : null}

        <View style={[styles.footerNote, { borderColor: themeColors.border }]}>
          <Ionicons name="information-circle-outline" size={15} color={themeColors.textDim} />
          <Text style={[styles.footerText, { color: themeColors.textMuted }]}>
            Gallery exports are kept by Android even after you delete a file from VScrap.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 20,
    gap: spacing.lg,
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
  statusText: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  statusMeta: {
    ...type.small,
    fontSize: 11,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...type.body,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  clearBtn: {
    padding: 4,
  },
  filterBar: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  filterCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 2,
  },
  filterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterCount: {
    ...type.micro,
    fontSize: 10,
    fontWeight: '700',
  },
  filterLabel: {
    ...type.micro,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.h2,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  sectionMeta: {
    ...type.small,
    fontSize: 11,
  },
  list: {
    gap: spacing.md,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  resetText: {
    ...type.small,
    fontSize: 11,
    fontWeight: '700',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  footerText: {
    flex: 1,
    ...type.caption,
    fontSize: 11,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});

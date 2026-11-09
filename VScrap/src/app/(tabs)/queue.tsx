import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DownloadCard } from '@/components/DownloadCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatStrip } from '@/components/StatStrip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopAppBar } from '@/components/TopAppBar';
import { useDownloadsStore } from '@/store/downloadStore';
import type { DownloadItem, DownloadStatus } from '@/types/media';
import { spacing, type } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'active' | 'done' | 'failed';
type ActionTone = 'default' | 'primary' | 'danger';

const ACTIVE_STATUSES: DownloadStatus[] = ['queued', 'analyzing', 'downloading', 'paused'];
const ISSUE_STATUSES: DownloadStatus[] = ['failed', 'cancelled'];

const STATUS_ORDER: Record<DownloadStatus, number> = {
  downloading: 0,
  analyzing: 1,
  queued: 2,
  paused: 3,
  failed: 4,
  cancelled: 5,
  completed: 6,
};

const EMPTY_STATES: Record<
  Filter,
  { icon: IconName; title: string; message: string; action?: string }
> = {
  all: {
    icon: 'cloud-download-outline',
    title: 'Your queue is empty',
    message: 'Paste a media link on the home screen to start downloading.',
    action: 'Add a link',
  },
  active: {
    icon: 'timer-outline',
    title: 'Nothing in progress',
    message: 'Active transfers and link analysis will show up here live.',
    action: 'Add a link',
  },
  done: {
    icon: 'checkmark-circle-outline',
    title: 'No saved downloads yet',
    message: 'Finished files will appear here and be stored in your library.',
    action: 'Add a link',
  },
  failed: {
    icon: 'alert-circle-outline',
    title: 'No failed downloads',
    message: 'All tasks have completed cleanly without errors.',
  },
};

export default function QueueRoute() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const items = useDownloadsStore((state) => state.items);
  const pause = useDownloadsStore((state) => state.pause);
  const resume = useDownloadsStore((state) => state.resume);
  const retry = useDownloadsStore((state) => state.retry);
  const clearFinished = useDownloadsStore((state) => state.clearFinished);
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const inProgress = items.filter(
      (item) =>
        item.status === 'queued' || item.status === 'analyzing' || item.status === 'downloading'
    ).length;
    const paused = items.filter((item) => item.status === 'paused').length;
    const completed = items.filter((item) => item.status === 'completed').length;
    const issues = items.filter((item) => ISSUE_STATUSES.includes(item.status)).length;

    return { inProgress, paused, completed, issues };
  }, [items]);

  const filtered = useMemo(() => {
    const match = (item: DownloadItem) => {
      if (filter === 'all') return true;
      if (filter === 'active') return ACTIVE_STATUSES.includes(item.status);
      if (filter === 'done') return item.status === 'completed';
      return ISSUE_STATUSES.includes(item.status);
    };

    return items
      .filter(match)
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt)
      );
  }, [filter, items]);

  const filters: { key: Filter; label: string; count: number; icon: IconName }[] = [
    { key: 'all', label: 'All', count: items.length, icon: 'albums-outline' },
    {
      key: 'active',
      label: 'Active',
      count: counts.inProgress + counts.paused,
      icon: 'cloud-download-outline',
    },
    { key: 'done', label: 'Saved', count: counts.completed, icon: 'checkmark-circle-outline' },
    { key: 'failed', label: 'Issues', count: counts.issues, icon: 'alert-circle-outline' },
  ];

  const empty = EMPTY_STATES[filter];

  const handlePauseAll = () => {
    haptics.tap();
    items.filter((i) => i.status === 'downloading').forEach((i) => pause(i.id));
  };

  const handleResumeAll = () => {
    haptics.tap();
    items.filter((i) => i.status === 'paused').forEach((i) => resume(i.id));
  };

  const handleRetryAll = () => {
    haptics.tap();
    items.filter((i) => i.status === 'failed').forEach((i) => void retry(i.id));
  };

  const confirmClearDone = () => {
    Alert.alert(
      'Clear finished tasks?',
      'This removes completed, failed and cancelled entries from the queue. Files in your Library remain intact.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Clear Queue',
          onPress: () => {
            haptics.tap();
            clearFinished();
          },
        },
      ]
    );
  };

  const manageActions: {
    key: string;
    label: string;
    icon: IconName;
    tone: ActionTone;
    onPress: () => void;
  }[] = [];

  if (items.some((item) => item.status === 'downloading')) {
    manageActions.push({
      key: 'pause',
      label: 'Pause all',
      icon: 'pause',
      tone: 'default',
      onPress: handlePauseAll,
    });
  }
  if (counts.paused > 0) {
    manageActions.push({
      key: 'resume',
      label: 'Resume all',
      icon: 'play',
      tone: 'primary',
      onPress: handleResumeAll,
    });
  }
  if (items.some((item) => item.status === 'failed')) {
    manageActions.push({
      key: 'retry',
      label: 'Retry failed',
      icon: 'refresh',
      tone: 'default',
      onPress: handleRetryAll,
    });
  }
  if (counts.completed > 0 || counts.issues > 0) {
    manageActions.push({
      key: 'clear',
      label: 'Clear finished',
      icon: 'trash-outline',
      tone: 'danger',
      onPress: confirmClearDone,
    });
  }

  return (
    <Screen>
      <TopAppBar
        title="Download Queue"
        subtitle={`${counts.inProgress} active · ${counts.completed} saved`}
        icon="cloud-download"
        rightAction={<ThemeToggle />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never">
        <View style={styles.statusRow}>
          <View style={styles.liveGroup}>
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor:
                    counts.inProgress > 0 ? themeColors.accent : themeColors.textDim,
                },
              ]}
            />
            <Text style={[styles.liveText, { color: themeColors.text }]}>
              {counts.inProgress > 0
                ? `${counts.inProgress} transfer${counts.inProgress === 1 ? '' : 's'} running`
                : 'Engine idle'}
            </Text>
          </View>
          <Text style={[styles.statusMeta, { color: themeColors.textMuted }]}>
            {items.length} task{items.length === 1 ? '' : 's'}
          </Text>
        </View>

        <StatStrip
          items={[
            { label: 'Active', value: counts.inProgress, tone: 'primary' },
            { label: 'Paused', value: counts.paused, tone: 'warning' },
            { label: 'Saved', value: counts.completed, tone: 'success' },
            { label: 'Issues', value: counts.issues, tone: counts.issues ? 'danger' : 'default' },
          ]}
        />

        {manageActions.length > 0 ? (
          <View style={styles.actionRow}>
            {manageActions.map((action) => {
              const palette =
                action.tone === 'primary'
                  ? {
                      backgroundColor: themeColors.primarySoft,
                      borderColor: themeColors.primary,
                      color: themeColors.primary,
                    }
                  : action.tone === 'danger'
                    ? {
                        backgroundColor: themeColors.dangerSoft,
                        borderColor: themeColors.danger,
                        color: themeColors.danger,
                      }
                    : {
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.border,
                        color: themeColors.textMuted,
                      };

              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: palette.backgroundColor,
                      borderColor: palette.borderColor,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name={action.icon} size={14} color={palette.color} />
                  <Text style={[styles.actionLabel, { color: palette.color }]}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Queue</Text>
          <Text style={[styles.sectionMeta, { color: themeColors.textMuted }]}>
            {filtered.length} of {items.length} shown
          </Text>
        </View>

        <View
          style={[
            styles.filterBar,
            { borderColor: themeColors.border, backgroundColor: themeColors.surface },
          ]}>
          {filters.map((entry, index) => {
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
                  index < filters.length - 1
                    ? { borderRightWidth: 1, borderRightColor: themeColors.border }
                    : null,
                  active ? { backgroundColor: themeColors.primary } : null,
                  pressed ? styles.pressed : null,
                ]}>
                <View style={styles.filterTop}>
                  <Ionicons
                    name={entry.icon}
                    size={14}
                    color={active ? themeColors.primaryText : themeColors.textMuted}
                  />
                  <Text
                    style={[
                      styles.filterCount,
                      { color: active ? themeColors.primaryText : themeColors.textDim },
                    ]}>
                    {entry.count}
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

        {filtered.length === 0 ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            message={empty.message}
            actionLabel={empty.action}
            onAction={empty.action ? () => router.navigate('/') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((item) => (
              <DownloadCard key={item.id} item={item} />
            ))}
          </View>
        )}
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
  liveGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  statusMeta: {
    ...type.small,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  actionLabel: {
    ...type.small,
    fontSize: 11,
    fontWeight: '700',
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
  filterBar: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  filterCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  filterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterCount: {
    ...type.micro,
    fontSize: 10,
    fontWeight: '700',
  },
  filterLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  list: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});

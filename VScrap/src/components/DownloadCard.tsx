import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Card } from '@/components/Card';
import { MediaIcon } from '@/components/MediaIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusPill } from '@/components/StatusPill';
import { errorMessage } from '@/services/apiClient';
import { useDownloadsStore } from '@/store/downloadStore';
import type { DownloadItem } from '@/types/media';
import { radius, spacing, type } from '@/theme';
import { formatBytes, formatDuration, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { hostnameOf, mediaKindLabel } from '@/utils/urlUtils';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface CardActionProps {
  icon: IconName;
  label?: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
}

function CardAction({ icon, label, onPress, tone = 'default', disabled }: CardActionProps) {
  const { themeColors } = useTheme();

  const getColors = () => {
    switch (tone) {
      case 'primary':
        return {
          bg: themeColors.primarySoft,
          border: themeColors.borderLight,
          text: themeColors.primary,
        };
      case 'success':
        return {
          bg: themeColors.accentSoft,
          border: themeColors.borderLight,
          text: themeColors.accent,
        };
      case 'warning':
        return {
          bg: themeColors.warningSoft,
          border: themeColors.borderLight,
          text: themeColors.warning,
        };
      case 'danger':
        return {
          bg: themeColors.dangerSoft,
          border: themeColors.borderLight,
          text: themeColors.danger,
        };
      default:
        return {
          bg: themeColors.surfaceAlt,
          border: themeColors.borderLight,
          text: themeColors.textMuted,
        };
    }
  };

  const styleColors = getColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: styleColors.bg, borderColor: styleColors.border },
        label ? styles.actionWithLabel : styles.actionIconOnly,
        disabled && styles.actionDisabled,
        pressed && styles.actionPressed,
      ]}>
      <Ionicons name={icon} size={14} color={styleColors.text} />
      {label ? (
        <Text style={[styles.actionLabel, { color: styleColors.text }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

async function runAction(action: () => void | Promise<void>, successMessage?: string) {
  haptics.tap();
  try {
    await action();
    if (successMessage) {
      haptics.success();
      Alert.alert('Done', successMessage);
    }
  } catch (error) {
    haptics.error();
    Alert.alert('Something went wrong', errorMessage(error));
  }
}

function getPlatformInfo(url: string, kind: string): { name: string; icon: IconName; color: string } {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com')) {
    return { name: 'Instagram', icon: 'logo-instagram', color: '#E1306C' };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { name: 'YouTube', icon: 'logo-youtube', color: '#EF4444' };
  }
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    return { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' };
  }
  if (lower.includes('tiktok.com')) {
    return { name: 'TikTok', icon: 'logo-tiktok', color: '#00F2FE' };
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return { name: 'X / Twitter', icon: 'logo-twitter', color: '#38BDF8' };
  }
  if (lower.includes('reddit.com')) {
    return { name: 'Reddit', icon: 'logo-reddit', color: '#F97316' };
  }
  if (lower.includes('pinterest.com')) {
    return { name: 'Pinterest', icon: 'logo-pinterest', color: '#E11D48' };
  }
  const host = hostnameOf(url);
  return {
    name: host ? host.replace(/^www\./, '') : mediaKindLabel(kind as any),
    icon: 'globe-outline',
    color: '#6B7280',
  };
}

export function DownloadCard({ item }: { item: DownloadItem }) {
  const { themeColors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const pause = useDownloadsStore((state) => state.pause);
  const retry = useDownloadsStore((state) => state.retry);
  const resume = useDownloadsStore((state) => state.resume);
  const cancel = useDownloadsStore((state) => state.cancel);
  const remove = useDownloadsStore((state) => state.remove);
  const share = useDownloadsStore((state) => state.share);
  const preview = useDownloadsStore((state) => state.preview);
  const saveToLibrary = useDownloadsStore((state) => state.saveToLibrary);

  const isActive = item.status === 'downloading' || item.status === 'analyzing';
  const isDownloading = item.status === 'downloading';
  const isPaused = item.status === 'paused';
  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const showProgress = isDownloading || isPaused || item.status === 'analyzing';

  const ext = (item.filename.split('.').pop() || 'media').toUpperCase();
  const platform = getPlatformInfo(item.url, item.mediaKind);
  const isImageThumb = item.mediaKind === 'image' && item.localUri && !imageFailed;

  const confirmRemove = () => {
    Alert.alert('Remove download?', 'This will delete the downloaded file from VScrap.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void runAction(() => remove(item.id)),
      },
    ]);
  };

  const handleCardPress = () => {
    if (isCompleted) {
      void runAction(() => preview(item.id));
    }
  };

  return (
    <Card
      style={[
        styles.card,
        isDownloading && { borderColor: themeColors.primary, backgroundColor: themeColors.surfaceAlt },
        isFailed && { borderColor: themeColors.borderLight },
      ]}>
      {/* Top Header Row */}
      <Pressable
        onPress={handleCardPress}
        disabled={!isCompleted}
        style={({ pressed }) => [styles.headerRow, pressed && isCompleted && styles.pressed]}>
        {/* Thumbnail / Icon */}
        <View style={styles.thumbWrapper}>
          {isImageThumb ? (
            <Image
              source={{ uri: item.localUri || undefined }}
              style={styles.thumbImage}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <MediaIcon kind={item.mediaKind} size={46} />
          )}

          {/* Platform Mini Badge Overlay */}
          <View style={[styles.platformBadge, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.bg }]}>
            <Ionicons name={platform.icon} size={11} color={platform.color} />
          </View>
        </View>

        {/* Title & Metadata */}
        <View style={styles.titleBlock}>
          <View style={styles.topMeta}>
            <Text style={[styles.platformName, { color: themeColors.primaryLight }]}>
              {platform.name}
            </Text>
            <Text style={[styles.metaDot, { color: themeColors.textDim }]}>•</Text>
            <Text style={[styles.formatTag, { color: themeColors.textDim }]}>{ext}</Text>
            {item.durationSeconds ? (
              <>
                <Text style={[styles.metaDot, { color: themeColors.textDim }]}>•</Text>
                <Text style={[styles.metaDuration, { color: themeColors.textDim }]}>
                  {formatDuration(item.durationSeconds)}
                </Text>
              </>
            ) : null}
          </View>

          <Text style={[styles.filename, { color: themeColors.text }]} numberOfLines={1}>
            {item.filename}
          </Text>

          {isCompleted && (
            <Text style={[styles.completedMeta, { color: themeColors.textDim }]} numberOfLines={1}>
              {formatBytes(item.size)} • {formatRelativeTime(item.completedAt || item.createdAt)}
            </Text>
          )}
        </View>

        {/* Status Pill */}
        <StatusPill status={item.status} />
      </Pressable>

      {/* Progress & Live Transfer Stats */}
      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressMetrics}>
            <Text style={[styles.progressLabel, { color: themeColors.textMuted }]}>
              {item.status === 'analyzing'
                ? 'Analyzing media source…'
                : isPaused
                  ? 'Transfer paused'
                  : item.size
                    ? `${formatBytes(item.bytesWritten)} of ${formatBytes(item.size)}`
                    : formatBytes(item.bytesWritten)}
            </Text>
            {isDownloading || isPaused ? (
              <Text style={[styles.progressPct, { color: isPaused ? themeColors.warning : themeColors.text }]}>
                {Math.round(item.progress)}%
              </Text>
            ) : null}
          </View>

          <ProgressBar
            progress={item.progress}
            color={isPaused ? 'warning' : 'primary'}
            height={6}
            indeterminate={item.status === 'analyzing' || (isDownloading && item.progress === 0)}
          />
        </View>
      )}

      {/* Error Callout */}
      {isFailed && (
        <View style={[styles.errorBox, { backgroundColor: themeColors.dangerSoft, borderColor: themeColors.borderLight }]}>
          <Ionicons name="alert-circle" size={15} color={themeColors.dangerLight} />
          <Text style={[styles.errorText, { color: themeColors.dangerLight }]} numberOfLines={2}>
            {item.error || 'The download could not be completed.'}
          </Text>
        </View>
      )}

      {/* Gallery Warning */}
      {isCompleted && item.galleryError && (
        <View style={[styles.warningBox, { backgroundColor: themeColors.warningSoft, borderColor: themeColors.borderLight }]}>
          <Ionicons name="warning-outline" size={13} color={themeColors.warningLight} />
          <Text style={[styles.warningText, { color: themeColors.warningLight }]} numberOfLines={2}>
            Not in Gallery: {item.galleryError}
          </Text>
        </View>
      )}

      {/* Actions Toolbar */}
      <View style={[styles.actionsBar, { borderTopColor: themeColors.border }]}>
        {isActive ? (
          <>
            {isDownloading ? (
              <CardAction
                icon="pause"
                label="Pause"
                tone="warning"
                onPress={() => void runAction(() => pause(item.id))}
              />
            ) : null}
            <CardAction
              icon="close"
              label="Cancel"
              tone="danger"
              onPress={() => void runAction(() => cancel(item.id))}
            />
          </>
        ) : null}

        {isPaused || item.status === 'cancelled' ? (
          <>
            <CardAction
              icon="play"
              label="Resume"
              tone="primary"
              onPress={() => {
                haptics.tap();
                void resume(item.id);
              }}
            />
            <CardAction
              icon="trash-outline"
              tone="danger"
              onPress={confirmRemove}
            />
          </>
        ) : null}

        {isFailed ? (
          <>
            <CardAction
              icon="refresh"
              label="Retry"
              tone="primary"
              onPress={() => {
                haptics.tap();
                void retry(item.id);
              }}
            />
            <CardAction
              icon="trash-outline"
              tone="danger"
              onPress={confirmRemove}
            />
          </>
        ) : null}

        {isCompleted ? (
          <>
            <CardAction
              icon={item.mediaKind === 'image' ? 'eye-outline' : 'play'}
              label="Open"
              tone="primary"
              onPress={() => void runAction(() => preview(item.id))}
            />
            <CardAction
              icon="share-social-outline"
              label="Share"
              onPress={() => void runAction(() => share(item.id))}
            />
            <CardAction
              icon={item.savedToLibrary ? 'checkmark-circle' : 'download-outline'}
              label={item.savedToLibrary ? 'Saved' : 'Gallery'}
              tone={item.savedToLibrary ? 'success' : 'default'}
              disabled={item.savedToLibrary}
              onPress={() =>
                void runAction(() => saveToLibrary(item.id), 'Saved to your gallery.')
              }
            />
            <CardAction
              icon="trash-outline"
              tone="danger"
              onPress={confirmRemove}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbWrapper: {
    position: 'relative',
    width: 46,
    height: 46,
  },
  thumbImage: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  platformBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  topMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  platformName: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaDot: {
    fontSize: 10,
  },
  formatTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metaDuration: {
    fontSize: 10,
  },
  filename: {
    ...type.bodyStrong,
    fontSize: 14,
  },
  completedMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  progressContainer: {
    gap: 7,
    paddingTop: 2,
  },
  progressMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...type.small,
    fontSize: 11,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    ...type.small,
    fontSize: 11,
    lineHeight: 15,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: 2,
    borderTopWidth: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  actionWithLabel: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  actionIconOnly: {
    width: 32,
    height: 32,
    marginLeft: 'auto',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Card } from '@/components/Card';
import { errorMessage } from '@/services/apiClient';
import { useDownloadsStore } from '@/store/downloadStore';
import type { DownloadItem } from '@/types/media';
import { radius, spacing, type } from '@/theme';
import { formatBytes, formatDuration, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { hostnameOf, mediaKindLabel } from '@/utils/urlUtils';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const kindIcon: Record<DownloadItem['mediaKind'], IconName> = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'musical-notes-outline',
  file: 'document-text-outline',
};

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
    return {
      name: kind === 'audio' ? 'YouTube Audio' : 'YouTube Video',
      icon: 'logo-youtube',
      color: '#EF4444',
    };
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

export function LibraryCard({ item }: { item: DownloadItem }) {
  const { themeColors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const share = useDownloadsStore((state) => state.share);
  const preview = useDownloadsStore((state) => state.preview);
  const saveToLibrary = useDownloadsStore((state) => state.saveToLibrary);
  const remove = useDownloadsStore((state) => state.remove);

  const isImage = item.mediaKind === 'image' && item.localUri && !imageFailed;
  const isVideo = item.mediaKind === 'video';
  const isAudio = item.mediaKind === 'audio';
  const ext = (item.filename.split('.').pop() || 'media').toUpperCase();
  const platform = getPlatformInfo(item.url, item.mediaKind);

  const confirmRemove = () => {
    Alert.alert('Delete file?', 'This removes the media file from your VScrap library.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runAction(() => remove(item.id)),
      },
    ]);
  };

  const handleOpen = () => {
    void runAction(() => preview(item.id));
  };

  return (
    <Card style={styles.card}>
      <Pressable onPress={handleOpen} style={({ pressed }) => [styles.mainPressable, pressed && styles.pressed]}>
        {/* Media Thumbnail */}
        <View style={[styles.preview, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.borderLight }]}>
          {isImage ? (
            <Image
              source={{ uri: item.localUri || undefined }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : isVideo ? (
            <View style={[styles.videoFallback, { backgroundColor: themeColors.surfaceAlt }]}>
              <View style={[styles.playBubble, { backgroundColor: themeColors.primary }]}>
                <Ionicons name="play" size={16} color={themeColors.primaryText} />
              </View>
            </View>
          ) : (
            <View style={[styles.fallback, { backgroundColor: themeColors.surfaceAlt }]}>
              <Ionicons
                name={isAudio ? 'musical-notes' : kindIcon[item.mediaKind]}
                size={24}
                color={isAudio ? themeColors.accent : themeColors.primary}
              />
            </View>
          )}

          {/* Badge over thumbnail: duration or format */}
          <View style={[styles.thumbPill, { backgroundColor: 'rgba(0, 0, 0, 0.6)', borderColor: 'rgba(255, 255, 255, 0.12)' }]}>
            <Text style={[styles.thumbPillText, { color: themeColors.text }]}>
              {isVideo && item.durationSeconds
                ? formatDuration(item.durationSeconds)
                : ext.slice(0, 4)}
            </Text>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.info}>
          {/* Platform & Status Badge Row */}
          <View style={styles.topInfoRow}>
            <View style={[styles.categoryPill, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}>
              <Ionicons name={platform.icon} size={11} color={platform.color} />
              <Text style={[styles.categoryText, { color: themeColors.text }]} numberOfLines={1}>
                {platform.name}
              </Text>
            </View>

            <View style={styles.statusRow}>
              {item.savedToLibrary ? (
                <>
                  <Ionicons name="checkmark-circle" size={12} color={themeColors.accent} />
                  <Text style={[styles.statusSavedText, { color: themeColors.accent }]}>Gallery</Text>
                </>
              ) : (
                <>
                  <Ionicons name="folder-outline" size={12} color={themeColors.textDim} />
                  <Text style={[styles.statusStorageText, { color: themeColors.textDim }]}>Sandbox</Text>
                </>
              )}
            </View>
          </View>

          {/* Filename */}
          <Text style={[styles.filename, { color: themeColors.text }]} numberOfLines={1}>
            {item.filename}
          </Text>

          {/* Metadata */}
          <Text style={[styles.meta, { color: themeColors.textMuted }]} numberOfLines={1}>
            {formatBytes(item.size)} • {ext}
            {isVideo && item.durationSeconds ? ` • ${formatDuration(item.durationSeconds)}` : ''}
            {' • '}
            {formatRelativeTime(item.completedAt || item.createdAt)}
          </Text>
        </View>
      </Pressable>

      {/* Action Buttons Row */}
      <View style={[styles.actionsRow, { borderTopColor: themeColors.border }]}>
        {/* Open / Play Button */}
        <Pressable
          accessibilityLabel="Open Media"
          onPress={handleOpen}
          style={({ pressed }) => [styles.openBtn, pressed && styles.actionPressed, { backgroundColor: themeColors.primarySoft, borderColor: themeColors.borderLight }]}>
          <Ionicons name={item.mediaKind === 'image' ? 'eye-outline' : 'play'} size={13} color={themeColors.primary} />
          <Text style={[styles.openBtnText, { color: themeColors.primary }]}>{item.mediaKind === 'image' ? 'View' : 'Play'}</Text>
        </Pressable>

        {/* Share Button */}
        <Pressable
          accessibilityLabel="Share File"
          onPress={() => void runAction(() => share(item.id))}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.borderLight }]}>
          <Ionicons name="share-social-outline" size={14} color={themeColors.textMuted} />
          <Text style={[styles.actionBtnText, { color: themeColors.textMuted }]}>Share</Text>
        </Pressable>

        {/* Save to Gallery (if not yet saved) */}
        {!item.savedToLibrary ? (
          <Pressable
            accessibilityLabel="Export to Gallery"
            onPress={() =>
              void runAction(() => saveToLibrary(item.id), 'Exported copy to your gallery.')
            }
            style={({ pressed }) => [styles.actionBtn, styles.saveBtn, pressed && styles.actionPressed, { backgroundColor: themeColors.accentSoft, borderColor: themeColors.borderLight }]}>
            <Ionicons name="download-outline" size={14} color={themeColors.accentLight} />
            <Text style={[styles.actionBtnText, { color: themeColors.accentLight }]}>Save</Text>
          </Pressable>
        ) : null}

        {/* Delete Button */}
        <Pressable
          accessibilityLabel="Delete File"
          onPress={confirmRemove}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.actionPressed, { backgroundColor: themeColors.dangerSoft, borderColor: themeColors.borderLight }]}>
          <Ionicons name="trash-outline" size={14} color={themeColors.dangerLight} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  mainPressable: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  preview: {
    width: 78,
    height: 78,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  topInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
    maxWidth: 160,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusSavedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusStorageText: {
    fontSize: 11,
  },
  filename: {
    ...type.bodyStrong,
    fontSize: 14,
  },
  meta: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 4,
    borderTopWidth: 1,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  openBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  saveBtn: {},
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    marginLeft: 'auto',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  pressed: {
    opacity: 0.85,
  },
});

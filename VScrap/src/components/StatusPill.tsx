import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DownloadStatus } from '@/types/media';
import { type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

const LABELS: Record<DownloadStatus, string> = {
  queued: 'Queued',
  analyzing: 'Checking',
  downloading: 'Downloading',
  paused: 'Paused',
  completed: 'Saved',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function StatusPill({ status }: { status: DownloadStatus }) {
  const { themeColors } = useTheme();

  const tone =
    status === 'failed'
      ? themeColors.danger
      : status === 'paused'
        ? themeColors.warning
        : status === 'completed'
          ? themeColors.success
          : status === 'queued' || status === 'cancelled'
            ? themeColors.textDim
            : themeColors.primary;

  const fill =
    status === 'failed'
      ? themeColors.dangerSoft
      : status === 'paused'
        ? themeColors.warningSoft
        : status === 'completed'
          ? themeColors.successSoft
          : status === 'queued' || status === 'cancelled'
            ? themeColors.surfaceAlt
            : themeColors.primarySoft;

  return (
    <View style={[styles.pill, { backgroundColor: fill, borderColor: themeColors.border }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.label, { color: themeColors.text }]}>{LABELS[status] || 'Queued'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
});

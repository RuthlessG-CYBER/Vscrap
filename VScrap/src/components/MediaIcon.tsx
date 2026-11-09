import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MediaKind } from '@/utils/urlUtils';
import { radius } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const config: Record<
  MediaKind,
  { icon: IconName }
> = {
  image: {
    icon: 'image-outline',
  },
  video: {
    icon: 'videocam-outline',
  },
  audio: {
    icon: 'musical-notes-outline',
  },
  file: {
    icon: 'document-text-outline',
  },
};

interface MediaIconProps {
  kind: MediaKind;
  size?: number;
  iconSize?: number;
}

export function MediaIcon({ kind, size = 44, iconSize }: MediaIconProps) {
  const { themeColors } = useTheme();
  const entry = config[kind] || config.file;
  const tint = kind === 'file' ? themeColors.textMuted : kind === 'audio' ? themeColors.warning : themeColors.primary;
  const background = kind === 'audio' ? themeColors.warningSoft : themeColors.primarySoft;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: background,
          borderColor: themeColors.borderLight,
        },
      ]}>
      <Ionicons name={entry.icon} size={iconSize ?? Math.round(size * 0.48)} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

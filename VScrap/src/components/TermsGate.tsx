import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { useSettingsStore } from '@/store/settingsStore';
import { radius, spacing, type } from '@/theme';
import { haptics } from '@/utils/haptics';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Your files stay on your device',
    body: 'Completed downloads are written to VScrap app storage. Nothing is uploaded back to the service.',
  },
  {
    icon: 'heart-outline',
    title: 'Respect creators',
    body: 'Only download media you own or have permission to save. Do not use VScrap to bypass paywalls or DRM.',
  },
  {
    icon: 'link-outline',
    title: 'Direct HTTPS links only',
    body: 'VScrap fetches public HTTPS media through a secure backend proxy. Local and private network addresses are blocked.',
  },
  {
    icon: 'server-outline',
    title: 'Security by design',
    body: 'The app never stores secrets. Link validation, SSRF protection and rate limits run on the backend.',
  },
];

export function TermsGate() {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const hasAcceptedTerms = useSettingsStore((state) => state.hasAcceptedTerms);
  const acceptTerms = useSettingsStore((state) => state.acceptTerms);
  const insets = useSafeAreaInsets();
  const { themeColors } = useTheme();

  const visible = hydrated && !hasAcceptedTerms;

  const accept = () => {
    haptics.success();
    acceptTerms();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}>
      <View style={[styles.backdrop, { backgroundColor: themeColors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: themeColors.surface, borderColor: themeColors.border, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <LinearGradient
            colors={[themeColors.primarySoft, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.glow}
            pointerEvents="none"
          />

          <View style={styles.hero}>
            <View style={[styles.logo, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="sparkles" size={24} color={themeColors.primaryText} />
            </View>
            <View style={[styles.brandBadge, { backgroundColor: themeColors.primarySoft, borderColor: themeColors.borderLight }]}>
              <Text style={[styles.brand, { color: themeColors.primary }]}>VSCRAP</Text>
            </View>
            <Text style={[styles.title, { color: themeColors.text }]}>Before you start</Text>
            <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
              A quick note about how VScrap works and how to use it responsibly.
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.points}
            showsVerticalScrollIndicator={false}>
            {POINTS.map((point) => (
              <View key={point.title} style={[styles.point, { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }]}>
                <View style={[styles.pointIcon, { backgroundColor: themeColors.primarySoft }]}>
                  <Ionicons name={point.icon} size={18} color={themeColors.primary} />
                </View>
                <View style={styles.pointCopy}>
                  <Text style={[styles.pointTitle, { color: themeColors.text }]}>{point.title}</Text>
                  <Text style={[styles.pointBody, { color: themeColors.textMuted }]}>{point.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Text style={[styles.legal, { color: themeColors.textDim }]}>
            By continuing, you confirm that you will only download content you have the right to
            save and that you will follow the terms of the sites you use.
          </Text>

          <GradientButton title="I understand & agree" icon="checkmark" onPress={accept} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.badge,
    borderWidth: 1,
  },
  brand: {
    ...type.micro,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  title: {
    ...type.h1,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    ...type.body,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  scroll: {
    marginTop: spacing.lg,
    flexGrow: 0,
  },
  points: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  point: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCopy: {
    flex: 1,
    gap: 2,
  },
  pointTitle: {
    ...type.bodyStrong,
    fontSize: 13,
  },
  pointBody: {
    ...type.small,
    fontSize: 12,
    lineHeight: 16,
  },
  legal: {
    ...type.small,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: spacing.md,
    lineHeight: 15,
  },
});

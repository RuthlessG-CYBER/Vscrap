import * as Haptics from 'expo-haptics';

type Feedback = () => Promise<void>;

const safe = (fn: Feedback): Feedback => async () => {
  try {
    await fn();
  } catch {
    // Haptics are unavailable on some platforms (e.g. web) — silently ignore.
  }
};

export const haptics = {
  tap: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  ),
  error: safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  ),
};

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type FeedbackType = 'light' | 'medium' | 'success' | 'error';

export const triggerHapticFeedback = (type: FeedbackType = 'light'): void => {
  if (type === 'success') {
    void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
    return;
  }

  if (type === 'error') {
    void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
    return;
  }

  const style = type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style }).catch(() => undefined);
};

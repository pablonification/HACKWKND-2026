import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type FeedbackType = 'light' | 'medium' | 'success' | 'error';

export const triggerHapticFeedback = (type: FeedbackType = 'light') => {
  if (Platform.OS === 'web') {
    return;
  }

  if (type === 'success') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return;
  }

  if (type === 'error') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    return;
  }

  const impactStyle =
    type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

  void Haptics.impactAsync(impactStyle).catch(() => undefined);
};

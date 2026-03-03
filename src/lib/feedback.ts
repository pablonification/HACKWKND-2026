import { Platform, Vibration } from 'react-native';

export type FeedbackType = 'light' | 'medium' | 'success' | 'error';

const FEEDBACK_DURATION: Record<FeedbackType, number> = {
  light: 10,
  medium: 18,
  success: 14,
  error: 30,
};

export const triggerHapticFeedback = (type: FeedbackType = 'light') => {
  if (Platform.OS === 'web') {
    return;
  }

  Vibration.vibrate(FEEDBACK_DURATION[type]);
};

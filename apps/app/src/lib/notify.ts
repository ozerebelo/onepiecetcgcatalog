import { Alert, Platform } from 'react-native';

import i18n from '@/i18n';

import { errorMessage } from './validation';

/** Minimal cross-platform error popup (react-native-web's Alert.alert is a no-op). */
export function notifyError(error: unknown) {
  const title = i18n.t('common.error');
  const message = errorMessage(error);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/** Yes/no confirmation that works on web and native. */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

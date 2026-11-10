/**
 * Vibración háptica: nativa en Android/iOS con @capacitor/haptics; en la web, navigator.vibrate
 * cuando existe. Nunca lanza errores.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { motionEnabled } from '../store/settings';

export function tap(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (!motionEnabled()) return;
  const style =
    kind === 'heavy'
      ? ImpactStyle.Heavy
      : kind === 'medium'
        ? ImpactStyle.Medium
        : ImpactStyle.Light;
  Haptics.impact({ style }).catch(() => undefined);
}

export function notify(kind: 'success' | 'error') {
  if (!motionEnabled()) return;
  Haptics.notification({
    type: kind === 'success' ? NotificationType.Success : NotificationType.Error,
  }).catch(() => undefined);
}

/**
 * Analítica con consentimiento previo (RGPD/LOPDP): no se registra nada hasta que el usuario
 * acepta en el aviso. El destino es configurable (Plausible, Mixpanel, GA4 vía servidor...).
 */
import { useSettings } from '../store/settings';

const ENDPOINT = import.meta.env.VITE_ANALYTICS_URL as string | undefined;

export function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (!ENDPOINT || useSettings.getState().analyticsConsent !== 'granted') return;
  const body = JSON.stringify({ event, props, path: window.location.pathname, ts: Date.now() });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
    else void fetch(ENDPOINT, { method: 'POST', body, keepalive: true });
  } catch {
    // La analítica nunca debe romper la app.
  }
}

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/storage';

export type Language = 'es' | 'en';
export type BoardTheme = 'midnight' | 'ebony' | 'green' | 'brown' | 'blue';
export type AppTheme = 'dark' | 'light' | 'system';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  isPremium: boolean;
  isGuest: boolean;
}

interface SettingsState {
  language: Language;
  boardTheme: BoardTheme;
  showCoordinates: boolean;
  /** Tema de la interfaz: oscuro "premium" por defecto. */
  appTheme: AppTheme;
  /** Sonidos sintetizados (movimiento, captura, jaque, éxito). */
  sound: boolean;
  /** Animaciones y partículas; se desactivan solas con "reducir movimiento" del sistema. */
  effects: boolean;
  /** Consentimiento de analítica (RGPD): no se envía nada hasta que el usuario acepta. */
  analyticsConsent: 'unset' | 'granted' | 'denied';
  token: string | null;
  user: AuthUser | null;
  setLanguage: (language: Language) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setShowCoordinates: (show: boolean) => void;
  setAppTheme: (theme: AppTheme) => void;
  setSound: (on: boolean) => void;
  setEffects: (on: boolean) => void;
  setAnalyticsConsent: (consent: 'granted' | 'denied') => void;
  setSession: (token: string | null, user: AuthUser | null) => void;
}

const detectLanguage = (): Language => {
  try {
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: detectLanguage(),
      boardTheme: 'midnight',
      showCoordinates: true,
      appTheme: 'dark',
      sound: true,
      effects: true,
      analyticsConsent: 'unset',
      token: null,
      user: null,
      setLanguage: (language) => set({ language }),
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setShowCoordinates: (showCoordinates) => set({ showCoordinates }),
      setAppTheme: (appTheme) => set({ appTheme }),
      setSound: (sound) => set({ sound }),
      setEffects: (effects) => set({ effects }),
      setAnalyticsConsent: (analyticsConsent) => set({ analyticsConsent }),
      setSession: (token, user) => set({ token, user }),
    }),
    { name: 'ia-ajedrez:settings', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

/** ¿Deben reproducirse animaciones? Respeta el ajuste y "reducir movimiento" del sistema. */
export function motionEnabled(): boolean {
  if (!useSettings.getState().effects) return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

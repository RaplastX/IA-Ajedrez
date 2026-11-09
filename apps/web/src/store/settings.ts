import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/storage';

export type Language = 'es' | 'en';
export type BoardTheme = 'green' | 'brown' | 'blue';

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
  /** Consentimiento de analítica (RGPD): no se envía nada hasta que el usuario acepta. */
  analyticsConsent: 'unset' | 'granted' | 'denied';
  token: string | null;
  user: AuthUser | null;
  setLanguage: (language: Language) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setShowCoordinates: (show: boolean) => void;
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
      boardTheme: 'green',
      showCoordinates: true,
      analyticsConsent: 'unset',
      token: null,
      user: null,
      setLanguage: (language) => set({ language }),
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setShowCoordinates: (showCoordinates) => set({ showCoordinates }),
      setAnalyticsConsent: (analyticsConsent) => set({ analyticsConsent }),
      setSession: (token, user) => set({ token, user }),
    }),
    { name: 'ia-ajedrez:settings', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);

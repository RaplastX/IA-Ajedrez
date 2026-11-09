import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useSettings } from '../store/settings';
import { en } from './en';
import { es } from './es';

export const resources = { es: { translation: es }, en: { translation: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: useSettings.getState().language,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Mantiene i18next y <html lang> sincronizados con el ajuste de idioma.
useSettings.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    void i18n.changeLanguage(state.language);
    document.documentElement.lang = state.language;
  }
});
if (typeof document !== 'undefined') document.documentElement.lang = useSettings.getState().language;

export default i18n;

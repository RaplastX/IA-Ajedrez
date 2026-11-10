import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativa (Android/iOS) que empaqueta la misma app web (apps/web/dist).
 * Stockfish WASM se ejecuta en un Web Worker dentro del WebView, igual que en el navegador.
 * Cambia `appId` por el identificador de tu organización antes de publicar en las tiendas.
 */
const config: CapacitorConfig = {
  appId: 'com.iaajedrez.app',
  appName: 'IA Ajedrez',
  webDir: '../web/dist',
  android: {
    // Origen https://localhost: permite cookies seguras y APIs que exigen contexto seguro.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

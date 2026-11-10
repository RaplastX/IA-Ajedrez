# App móvil (Capacitor)

Empaqueta la app web (`apps/web/dist`) como app nativa de Android e iOS. Stockfish WASM corre en
un Web Worker dentro del WebView, igual que en el navegador, así que todo el entrenamiento
funciona sin conexión.

## Requisitos

- Android: Android Studio (SDK 24+).
- iOS: macOS con Xcode y CocoaPods.

## Primeros pasos

```bash
# 1. Compila la web apuntando a tu API (URL absoluta, la app no comparte origen con ella)
VITE_API_URL=https://api.tu-dominio.com npm run build -w @ia-ajedrez/web

# 2. Genera los proyectos nativos (una sola vez) y versiónalos en git
npm run add:android -w @ia-ajedrez/mobile
npm run add:ios -w @ia-ajedrez/mobile

# 3. Copia la web y abre el IDE nativo
npm run android -w @ia-ajedrez/mobile
npm run ios -w @ia-ajedrez/mobile
```

En el servidor añade los orígenes del WebView a `CORS_ORIGINS`:
`https://localhost` (Android) y `capacitor://localhost` (iOS).

## Antes de publicar

- Cambia `appId` en `capacitor.config.ts` por el identificador de tu organización.
- Iconos y pantalla de inicio: `npx @capacitor/assets generate` a partir de un icono de 1024 px.
- Revisa [docs/LEGAL.md](../../docs/LEGAL.md): GPL de Stockfish en las tiendas y políticas de pago
  dentro de la app.

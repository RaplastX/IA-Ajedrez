#!/usr/bin/env node
/**
 * Copia Stockfish.js (WASM, lite single-threaded) a public/engine para servirlo como Web Worker.
 * Se elige la variante "lite single" porque pesa ~1.8 MB y no necesita cabeceras COOP/COEP:
 * funciona igual en cualquier hosting estático y dentro del WebView de Capacitor.
 * El worker busca el .wasm con el mismo nombre que el .js, por eso ambos se llaman "stockfish".
 * Junto al motor se copia su licencia GPL-3.0 (obligatorio al distribuirlo).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = dirname(require.resolve('stockfish/package.json'));
const target = join(here, '..', 'public', 'engine');
mkdirSync(target, { recursive: true });

const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish.wasm'],
  ['Copying.txt', 'COPYING-stockfish.txt'],
];
for (const [from, to] of files) {
  const src = join(pkgDir, from);
  if (!existsSync(src)) throw new Error(`No se encuentra ${src}`);
  copyFileSync(src, join(target, to));
}
console.log(`Stockfish copiado en ${target}`);

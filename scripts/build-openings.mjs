#!/usr/bin/env node
/**
 * Descarga los nombres de aperturas de lichess-org/chess-openings (CC0) y genera
 * apps/web/src/data/openings.json con entradas { eco, name, moves } (SAN sin números).
 *
 * Uso: node scripts/build-openings.mjs [--out ruta.json]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outIndex = process.argv.indexOf('--out');
const out = resolve(outIndex > 0 ? process.argv[outIndex + 1] : 'apps/web/src/data/openings.json');
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

const entries = [];
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${BASE}/${file}.tsv`);
  if (!res.ok) throw new Error(`No se pudo descargar ${file}.tsv: ${res.status}`);
  const lines = (await res.text()).trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const moves = pgn
      .replace(/\d+\.(\.\.)?/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
    entries.push({ eco, name, moves });
  }
}
writeFileSync(out, JSON.stringify(entries));
console.log(`Guardadas ${entries.length} aperturas en ${out}`);

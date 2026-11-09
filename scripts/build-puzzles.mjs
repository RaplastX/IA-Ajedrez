#!/usr/bin/env node
/**
 * Genera apps/web/src/data/puzzles.json a partir de la base de puzzles de Lichess (CC0).
 *
 * Uso:
 *   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   node scripts/build-puzzles.mjs lichess_db_puzzle.csv.zst [--per-bucket 30] [--out ruta.json]
 *
 * Acepta .csv o .csv.zst (Node 22.15+ trae zstd en zlib). Filtra puzzles populares y con
 * rating estable, y muestrea de forma estratificada por tramo de rating y por tema para que
 * el banco cubra 500–2800 y todos los motivos tácticos.
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!input) {
  console.error('Uso: node scripts/build-puzzles.mjs <lichess_db_puzzle.csv[.zst]> [--per-bucket N] [--out file]');
  process.exit(1);
}
const perBucket = Number(opt('per-bucket', '30'));
const out = resolve(opt('out', 'apps/web/src/data/puzzles.json'));

// Temas que la app muestra como categorías de entrenamiento.
const TRAINING_THEMES = [
  'mateIn1', 'mateIn2', 'mateIn3', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck',
  'hangingPiece', 'trappedPiece', 'sacrifice', 'deflection', 'attraction', 'clearance',
  'interference', 'xRayAttack', 'zugzwang', 'backRankMate', 'smotheredMate', 'promotion',
  'advancedPawn', 'quietMove', 'defensiveMove', 'endgame', 'rookEndgame', 'pawnEndgame',
  'opening', 'middlegame', 'kingsideAttack', 'capturingDefender', 'exposedKing',
];
const IGNORED_THEMES = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'equality', 'mate']);

let stream = createReadStream(input);
if (input.endsWith('.zst')) stream = stream.pipe(createZstdDecompress());
const rl = createInterface({ input: stream, crlfDelay: Infinity });

const buckets = new Map(); // tramo de 100 → puzzles
const themeCount = new Map();
let header = null;
let read = 0;

for await (const line of rl) {
  if (!header) {
    header = line.split(',');
    continue;
  }
  read++;
  const cols = line.split(',');
  const row = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
  const rating = Number(row.Rating);
  if (Number(row.Popularity) < 88 || Number(row.NbPlays) < 800 || Number(row.RatingDeviation) > 85) continue;
  if (rating < 500 || rating >= 2900) continue;
  const themes = row.Themes.split(' ').filter((t) => t && !IGNORED_THEMES.has(t));
  if (!themes.some((t) => TRAINING_THEMES.includes(t))) continue;
  const bucket = Math.floor(rating / 100) * 100;
  const list = buckets.get(bucket) ?? [];
  if (list.length >= perBucket) {
    // Sustituye si aporta un tema poco representado.
    const rare = themes.find((t) => (themeCount.get(t) ?? 0) < 12);
    if (!rare) continue;
    const victim = list.findIndex((p) => p.themes.every((t) => (themeCount.get(t) ?? 0) > 20));
    if (victim < 0) continue;
    for (const t of list[victim].themes) themeCount.set(t, (themeCount.get(t) ?? 1) - 1);
    list.splice(victim, 1);
  }
  const puzzle = {
    id: row.PuzzleId,
    fen: row.FEN,
    moves: row.Moves.split(' '),
    rating,
    themes,
    popularity: Number(row.Popularity),
    plays: Number(row.NbPlays),
  };
  if (row.OpeningTags) puzzle.openingTags = row.OpeningTags.split(' ');
  list.push(puzzle);
  for (const t of themes) themeCount.set(t, (themeCount.get(t) ?? 0) + 1);
  buckets.set(bucket, list);
}

const puzzles = [...buckets.entries()].sort(([a], [b]) => a - b).flatMap(([, list]) => list);
writeFileSync(out, JSON.stringify(puzzles));
console.log(`Leídos ${read} puzzles, guardados ${puzzles.length} en ${out}`);
console.log('Temas:', Object.fromEntries([...themeCount.entries()].sort((a, b) => b[1] - a[1])));

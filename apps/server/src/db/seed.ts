/** Carga el banco de puzzles (muestra CC0 de Lichess incluida en la app web) si la tabla está vacía. */
import type { Puzzle } from '@ia-ajedrez/core';
import { count } from 'drizzle-orm';
import bank from '../../../web/src/data/puzzles.json' with { type: 'json' };
import type { Db } from './client.js';
import { puzzles } from './schema.js';

export async function seedPuzzles(db: Db, source: Puzzle[] = bank as Puzzle[]): Promise<number> {
  const [row] = await db.select({ n: count() }).from(puzzles);
  if ((row?.n ?? 0) > 0) return 0;
  const chunk = 200;
  for (let i = 0; i < source.length; i += chunk) {
    await db
      .insert(puzzles)
      .values(
        source.slice(i, i + chunk).map((p) => ({
          id: p.id,
          fen: p.fen,
          moves: p.moves,
          rating: p.rating,
          themes: p.themes,
          popularity: p.popularity ?? null,
        })),
      )
      .onConflictDoNothing();
  }
  return source.length;
}

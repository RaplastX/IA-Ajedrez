/** Progreso, puzzles (con rating Glicko-2 validado en servidor), partidas y clasificación. */
import {
  parsePgn,
  playPuzzleMove,
  startPuzzle,
  updatePuzzleRating,
  type Puzzle,
} from '@ia-ajedrez/core';
import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { games, progress, puzzleAttempts, puzzles, ratings, users } from '../db/schema.js';
import { parseBody, type AppContext } from './context.js';

const progressSchema = z.object({ data: z.record(z.string(), z.unknown()) });

const attemptSchema = z.object({
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).max(40),
  timeMs: z.number().int().min(0).max(3_600_000).optional(),
});

const gameSchema = z.object({
  pgn: z.string().min(1).max(50_000),
  result: z.enum(['1-0', '0-1', '1/2-1/2', '*']),
  mode: z.enum(['ai', 'import', 'online']),
  opponent: z.string().max(60),
  accuracy: z.number().min(0).max(100).optional(),
});

/** Reproduce las jugadas del usuario contra la solución: el cliente no puede declararse ganador. */
export function verifyPuzzleSolution(puzzle: Puzzle, moves: string[]): boolean {
  let state = startPuzzle(puzzle);
  for (const uci of moves) {
    if (state.status !== 'playing') break;
    const result = playPuzzleMove(state, uci);
    if (!result.correct) return false;
    state = result.state;
  }
  return state.status === 'solved';
}

export async function trainingRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.get('/api/progress', { preHandler: app.authenticate }, async (request) => {
    const [row] = await db.select().from(progress).where(eq(progress.userId, request.user.sub));
    return { data: row?.data ?? null, updatedAt: row?.updatedAt.toISOString() ?? null };
  });

  app.put(
    '/api/progress',
    { preHandler: app.authenticate, bodyLimit: 512 * 1024 },
    async (request, reply) => {
      const body = parseBody(progressSchema, request.body, reply);
      if (!body) return;
      // La XP la declara el cliente (modo sin conexión): se acota para limitar abusos.
      const stats = body.data.stats as { xp?: unknown } | undefined;
      const xp = Math.max(0, Math.min(10_000_000, Math.floor(Number(stats?.xp) || 0)));
      const now = new Date();
      await db
        .insert(progress)
        .values({ userId: request.user.sub, data: body.data, xp, updatedAt: now })
        .onConflictDoUpdate({
          target: progress.userId,
          set: { data: body.data, xp, updatedAt: now },
        });
      return { ok: true };
    },
  );

  app.get('/api/puzzles/next', { preHandler: app.authenticate }, async (request) => {
    const { theme } = request.query as { theme?: string };
    const [rating] = await db.select().from(ratings).where(eq(ratings.userId, request.user.sub));
    const target = Math.round(rating?.rating ?? 1500);
    const rows = await db
      .select()
      .from(puzzles)
      .where(theme ? sql`${theme} = ANY(${puzzles.themes})` : undefined)
      .orderBy(sql`abs(${puzzles.rating} - ${target}), random()`)
      .limit(1);
    return { puzzle: rows[0] ?? null };
  });

  app.post(
    '/api/puzzles/:id/attempts',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = parseBody(attemptSchema, request.body, reply);
      if (!body) return;
      const { id } = request.params as { id: string };
      const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, id));
      if (!puzzle) return reply.code(404).send({ error: 'puzzle_not_found' });
      const userId = request.user.sub;
      const solved = verifyPuzzleSolution(
        { ...puzzle, popularity: puzzle.popularity ?? undefined },
        body.moves,
      );

      const [current] = await db.select().from(ratings).where(eq(ratings.userId, userId));
      const before = current ?? {
        rating: 1500,
        rd: 350,
        volatility: 0.06,
        solved: 0,
        attempted: 0,
      };
      // Solo el primer intento de cada puzzle cuenta para el rating (evita "farmear").
      const previous = await db
        .select({ id: puzzleAttempts.id })
        .from(puzzleAttempts)
        .where(and(eq(puzzleAttempts.userId, userId), eq(puzzleAttempts.puzzleId, id)))
        .limit(1);
      const counted = previous.length === 0;
      const next = counted ? updatePuzzleRating(before, puzzle.rating, solved) : before;

      await db.transaction(async (tx) => {
        await tx.insert(puzzleAttempts).values({
          userId,
          puzzleId: id,
          solved,
          timeMs: body.timeMs ?? null,
          ratingBefore: before.rating,
          ratingAfter: next.rating,
        });
        if (counted) {
          await tx
            .insert(ratings)
            .values({
              userId,
              rating: next.rating,
              rd: next.rd,
              volatility: next.volatility,
              solved: solved ? 1 : 0,
              attempted: 1,
            })
            .onConflictDoUpdate({
              target: ratings.userId,
              set: {
                rating: next.rating,
                rd: next.rd,
                volatility: next.volatility,
                solved: sql`${ratings.solved} + ${solved ? 1 : 0}`,
                attempted: sql`${ratings.attempted} + 1`,
                updatedAt: new Date(),
              },
            });
        }
      });
      return {
        solved,
        counted,
        rating: { rating: next.rating, rd: next.rd, volatility: next.volatility },
      };
    },
  );

  app.post('/api/games', { preHandler: app.authenticate }, async (request, reply) => {
    const body = parseBody(gameSchema, request.body, reply);
    if (!body) return;
    let headers: Record<string, string>;
    try {
      headers = parsePgn(body.pgn).headers;
    } catch {
      return reply.code(400).send({ error: 'invalid_pgn' });
    }
    const [row] = await db
      .insert(games)
      .values({
        ownerId: request.user.sub,
        whiteName: (headers.White ?? '?').slice(0, 60),
        blackName: (headers.Black ?? '?').slice(0, 60),
        mode: body.mode,
        pgn: body.pgn,
        result: body.result,
        accuracy: body.accuracy ?? null,
      })
      .returning({ id: games.id });
    return reply.code(201).send({ id: row!.id });
  });

  app.get('/api/games', { preHandler: app.authenticate }, async (request) => {
    const id = request.user.sub;
    const rows = await db
      .select()
      .from(games)
      .where(or(eq(games.ownerId, id), eq(games.whiteId, id), eq(games.blackId, id)))
      .orderBy(desc(games.createdAt))
      .limit(50);
    return { games: rows };
  });

  // Ranking público: solo nombre visible (nunca el correo) y solo cuentas registradas.
  app.get('/api/leaderboard', async (request) => {
    const { board = 'puzzle', limit = '20' } = request.query as { board?: string; limit?: string };
    const n = Math.min(100, Math.max(1, Number(limit) || 20));
    const rows =
      board === 'xp'
        ? await db
            .select({ displayName: users.displayName, value: progress.xp })
            .from(progress)
            .innerJoin(users, eq(users.id, progress.userId))
            .where(eq(users.isGuest, false))
            .orderBy(desc(progress.xp))
            .limit(n)
        : await db
            .select({ displayName: users.displayName, value: ratings.rating })
            .from(ratings)
            .innerJoin(users, eq(users.id, ratings.userId))
            .where(and(eq(users.isGuest, false), gte(ratings.attempted, 3)))
            .orderBy(desc(ratings.rating))
            .limit(n);
    return {
      entries: rows.map((r, i) => ({ rank: i + 1, displayName: r.displayName, value: r.value })),
    };
  });
}

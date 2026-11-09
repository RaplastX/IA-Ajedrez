/** Tutor en lenguaje natural y análisis de posiciones con el motor del servidor. */
import { Chess } from 'chess.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { users } from '../db/schema.js';
import { rulesTutor, type TutorRequest } from '../tutor/providers.js';
import { parseBody, type AppContext } from './context.js';

const FACT_CODES = [
  'givesMate',
  'givesCheck',
  'capture',
  'castles',
  'promotes',
  'hangingPiece',
  'allowsMate',
  'missedMate',
  'losesMaterial',
  'bestWasFork',
  'bestWinsMaterial',
  'betterMove',
  'evalSwing',
  'solidMove',
] as const;

const tutorSchema = z.object({
  fen: z.string().max(100),
  playedUci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  facts: z
    .array(z.object({ code: z.enum(FACT_CODES) }).loose())
    .max(12),
  bestLine: z.array(z.string().max(10)).max(12).default([]),
  locale: z.enum(['es', 'en']).catch('es'),
  question: z.string().trim().max(300).optional(),
});

const analysisSchema = z.object({
  fen: z.string().max(100),
  depth: z.number().int().min(1).max(22).default(16),
});

const isLegalFen = (fen: string) => {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
};

export async function aiRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db, config, tutor } = ctx;
  const limited = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  app.post('/api/tutor/explain', { preHandler: app.authenticate, ...limited }, async (request, reply) => {
    const body = parseBody(tutorSchema, request.body, reply);
    if (!body) return;
    if (!isLegalFen(body.fen)) return reply.code(400).send({ error: 'invalid_fen' });
    const req = body as TutorRequest;

    if (tutor.name !== 'rules' && !config.TUTOR_FREE) {
      const [user] = await db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, request.user.sub));
      if (!user?.isPremium) return reply.code(402).send({ error: 'premium_required' });
    }
    try {
      return { text: await tutor.explain(req), provider: tutor.name };
    } catch (error) {
      request.log.warn({ err: error }, 'tutor_fallback');
      return { text: await rulesTutor.explain(req), provider: 'rules' };
    }
  });

  app.post('/api/analysis/position', { preHandler: app.authenticate, ...limited }, async (request, reply) => {
    const body = parseBody(analysisSchema, request.body, reply);
    if (!body) return;
    if (!isLegalFen(body.fen)) return reply.code(400).send({ error: 'invalid_fen' });
    const engine = ctx.engine();
    if (!engine) return reply.code(503).send({ error: 'engine_unavailable' });
    return engine.analyse(body.fen, body.depth);
  });
}

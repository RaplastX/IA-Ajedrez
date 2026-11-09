/** Registro, inicio de sesión, invitados y derechos RGPD (acceso/portabilidad y supresión). */
import { eq, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { games, progress, puzzleAttempts, ratings, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { parseBody, type AppContext } from './context.js';

const displayName = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Solo letras, números, espacios, _ . -');

const registerSchema = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(200),
  displayName,
  acceptTerms: z.literal(true, { error: 'terms_required' }),
  locale: z.enum(['es', 'en']).catch('es'),
});

const loginSchema = z.object({
  email: z.string().transform((e) => e.toLowerCase().trim()),
  password: z.string().max(200),
});

type UserRow = typeof users.$inferSelect;

export const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  isPremium: u.isPremium,
  isGuest: u.isGuest,
});

export async function accountRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;
  const authLimit = { config: { rateLimit: { max: ctx.config.AUTH_RATE_LIMIT, timeWindow: '1 minute' } } };

  const issue = (u: UserRow) => ({ token: app.jwt.sign({ sub: u.id, guest: u.isGuest }), user: publicUser(u) });

  app.post('/api/auth/register', authLimit, async (request, reply) => {
    if ((request.body as { acceptTerms?: unknown } | undefined)?.acceptTerms !== true) {
      return reply.code(400).send({ error: 'terms_required' });
    }
    const body = parseBody(registerSchema, request.body, reply);
    if (!body) return;
    const clash = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(or(eq(users.email, body.email), eq(users.displayName, body.displayName)));
    if (clash.some((c) => c.email === body.email)) return reply.code(409).send({ error: 'email_taken' });
    if (clash.length) return reply.code(409).send({ error: 'name_taken' });
    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
        locale: body.locale,
        termsAcceptedAt: new Date(),
      })
      .returning();
    await db.insert(ratings).values({ userId: user!.id });
    return reply.code(201).send(issue(user!));
  });

  app.post('/api/auth/login', authLimit, async (request, reply) => {
    const body = parseBody(loginSchema, request.body, reply);
    if (!body) return;
    const [user] = await db.select().from(users).where(eq(users.email, body.email));
    // Se verifica siempre algo para no revelar por el tiempo de respuesta si el correo existe.
    const ok = await verifyPassword(body.password, user?.passwordHash ?? 'scrypt$16384$8$1$AAAA$AAAA');
    if (!user || !ok) return reply.code(401).send({ error: 'invalid_credentials' });
    return issue(user);
  });

  app.post('/api/auth/guest', authLimit, async (_request, reply) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const name = `Invitado-${randomInt(1000, 99999)}`;
      const inserted = await db
        .insert(users)
        .values({ displayName: name, isGuest: true })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        await db.insert(ratings).values({ userId: inserted[0].id });
        return reply.code(201).send(issue(inserted[0]));
      }
    }
    return reply.code(503).send({ error: 'try_again' });
  });

  app.get('/api/me', { preHandler: app.authenticate }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.user.sub));
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return { user: publicUser(user) };
  });

  // Derecho de acceso y portabilidad (art. 15 y 20 RGPD): todos los datos en JSON.
  app.get('/api/me/export', { preHandler: app.authenticate }, async (request) => {
    const id = request.user.sub;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    const [rating] = await db.select().from(ratings).where(eq(ratings.userId, id));
    const [prog] = await db.select().from(progress).where(eq(progress.userId, id));
    const attempts = await db.select().from(puzzleAttempts).where(eq(puzzleAttempts.userId, id));
    const ownGames = await db
      .select()
      .from(games)
      .where(or(eq(games.ownerId, id), eq(games.whiteId, id), eq(games.blackId, id)));
    const { passwordHash: _omit, ...profile } = user ?? ({} as UserRow);
    return { exportedAt: new Date().toISOString(), profile, rating, progress: prog, puzzleAttempts: attempts, games: ownGames };
  });

  // Derecho de supresión (art. 17 RGPD): borra la cuenta y anonimiza las partidas compartidas.
  app.delete('/api/me', { preHandler: app.authenticate }, async (request, reply) => {
    const id = request.user.sub;
    await db.transaction(async (tx) => {
      await tx.update(games).set({ whiteName: 'anónimo' }).where(eq(games.whiteId, id));
      await tx.update(games).set({ blackName: 'anónimo' }).where(eq(games.blackId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
    return reply.code(204).send();
  });
}

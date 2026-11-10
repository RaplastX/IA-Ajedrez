/** Construye la aplicación Fastify con todas sus dependencias (inyectables para tests). */
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { eq, sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import type { Config } from './config.js';
import { connectDatabase, migrate, type Database } from './db/client.js';
import { games, users } from './db/schema.js';
import { seedPuzzles } from './db/seed.js';
import { UciEngine } from './engine/uci-engine.js';
import { authPlugin } from './plugins/auth.js';
import { MultiplayerHub, type FinishedGame, type HubOptions } from './realtime/hub.js';
import { accountRoutes } from './routes/account.js';
import { aiRoutes } from './routes/ai.js';
import type { AppContext } from './routes/context.js';
import { paymentRoutes } from './routes/payments.js';
import { trainingRoutes } from './routes/training.js';
import { createTutor, type TutorProvider } from './tutor/providers.js';

export interface BuildOptions {
  database?: Database;
  tutor?: TutorProvider;
  stripe?: Stripe | null;
  hubOptions?: HubOptions;
}

export interface BuiltApp {
  app: FastifyInstance;
  ctx: AppContext;
}

export async function buildApp(config: Config, options: BuildOptions = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    trustProxy: true,
  });

  const database = options.database ?? (await connectDatabase(config));
  await migrate(database.db);
  await seedPuzzles(database.db);

  let engine: UciEngine | null | undefined;
  const hub = new MultiplayerHub({
    ...options.hubOptions,
    onGameEnd: async (game: FinishedGame) => {
      await options.hubOptions?.onGameEnd?.(game);
      const ids = await database.db
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.id} in (${game.white.id}, ${game.black.id})`);
      const known = new Set(ids.map((r) => r.id));
      await database.db.insert(games).values({
        whiteId: known.has(game.white.id) ? game.white.id : null,
        blackId: known.has(game.black.id) ? game.black.id : null,
        whiteName: game.white.name,
        blackName: game.black.name,
        mode: 'online',
        timeControl: game.tc,
        pgn: game.pgn,
        result: game.result,
      });
    },
  });

  const ctx: AppContext = {
    config,
    db: database.db,
    tutor: options.tutor ?? createTutor(config),
    stripe:
      options.stripe !== undefined
        ? options.stripe
        : config.STRIPE_SECRET_KEY
          ? new Stripe(config.STRIPE_SECRET_KEY)
          : null,
    engine: () =>
      engine === undefined ? (engine = UciEngine.create(config.STOCKFISH_PATH)) : engine,
    hub,
  };

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: false,
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(authPlugin, { secret: config.JWT_SECRET });
  await app.register(websocket, { options: { maxPayload: 4096 } });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_req, reply) => {
    try {
      await database.db.execute(sql`select 1`);
      return { status: 'ready', db: database.kind };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  // Métricas en formato Prometheus (Datadog, Grafana Cloud, etc. pueden recogerlas).
  app.get('/metrics', async (_req, reply) => {
    const s = hub.stats;
    reply.type('text/plain; version=0.0.4');
    return [
      '# TYPE ia_ajedrez_ws_connections gauge',
      `ia_ajedrez_ws_connections ${s.connections}`,
      '# TYPE ia_ajedrez_games_in_progress gauge',
      `ia_ajedrez_games_in_progress ${s.games}`,
      '# TYPE ia_ajedrez_seeks gauge',
      `ia_ajedrez_seeks ${s.seeks}`,
      '',
    ].join('\n');
  });

  // WebSocket de multijugador: /ws?token=<JWT>
  app.get('/ws', { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token ?? '';
    let payload: { sub: string; guest: boolean };
    try {
      payload = app.jwt.verify(token);
    } catch {
      socket.close(4401, 'unauthorized');
      return;
    }
    const [user] = await database.db.select().from(users).where(eq(users.id, payload.sub));
    if (!user) {
      socket.close(4401, 'unauthorized');
      return;
    }
    const connection = hub.connect({ id: user.id, name: user.displayName }, (msg) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    });
    socket.on('message', (data) => connection.onMessage(String(data)));
    socket.on('close', () => connection.onClose());
  });

  await app.register(async (scope) => accountRoutes(scope, ctx));
  await app.register(async (scope) => trainingRoutes(scope, ctx));
  await app.register(async (scope) => aiRoutes(scope, ctx));
  await app.register(async (scope) => paymentRoutes(scope, ctx));

  app.addHook('onClose', async () => {
    hub.shutdown();
    engine?.close();
    if (!options.database) await database.close();
  });

  return { app, ctx };
}

import type { FastifyReply } from 'fastify';
import type Stripe from 'stripe';
import type { ZodType } from 'zod';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import type { UciEngine } from '../engine/uci-engine.js';
import type { MultiplayerHub } from '../realtime/hub.js';
import type { TutorProvider } from '../tutor/providers.js';

/** Dependencias que reciben las rutas (inyectables en tests). */
export interface AppContext {
  config: Config;
  db: Db;
  tutor: TutorProvider;
  stripe: Stripe | null;
  engine: () => UciEngine | null;
  hub: MultiplayerHub;
}

/** Valida con zod y responde 400 si falla. Devuelve null en ese caso. */
export function parseBody<T>(schema: ZodType<T>, body: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  void reply.code(400).send({
    error: 'validation',
    details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  });
  return null;
}

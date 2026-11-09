/** Autenticación con JWT (Bearer). Los invitados reciben un token con `guest: true`. */
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; guest: boolean };
    user: { sub: string; guest: boolean };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAccount: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app: FastifyInstance, opts: { secret: string }) => {
  await app.register(jwt, { secret: opts.secret, sign: { expiresIn: '30d' } });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'unauthorized' });
    }
  });

  /** Como authenticate, pero rechaza invitados (pagos, ranking, borrado de cuenta...). */
  app.decorate('requireAccount', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (request.user.guest) return reply.code(403).send({ error: 'account_required' });
  });
});

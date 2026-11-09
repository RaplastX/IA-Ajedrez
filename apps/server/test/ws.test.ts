import type { ServerMessage } from '@ia-ajedrez/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';
import { testConfig } from '../src/config.js';
import { games } from '../src/db/schema.js';
import type { AppContext } from '../src/routes/context.js';

let app: FastifyInstance;
let ctx: AppContext;
let base: string;

beforeAll(async () => {
  ({ app, ctx } = await buildApp(testConfig(), { hubOptions: { random: () => 0.9 } }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  base = typeof address === 'object' && address ? `127.0.0.1:${address.port}` : '';
});
afterAll(async () => {
  await app.close();
});

/** Cliente WebSocket con cola de mensajes para esperar el siguiente de un tipo. */
async function client() {
  const guest = (await (await fetch(`http://${base}/api/auth/guest`, { method: 'POST' })).json()) as { token: string };
  const ws = new WebSocket(`ws://${base}/ws?token=${guest.token}`);
  const queue: ServerMessage[] = [];
  const waiters: { type: string; resolve: (m: ServerMessage) => void }[] = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(String(data)) as ServerMessage;
    const i = waiters.findIndex((w) => w.type === msg.t);
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(msg);
    else queue.push(msg);
  });
  await new Promise((r) => ws.once('open', r));
  const next = <T extends ServerMessage['t']>(type: T) =>
    new Promise<Extract<ServerMessage, { t: T }>>((resolve) => {
      const i = queue.findIndex((m) => m.t === type);
      if (i >= 0) resolve(queue.splice(i, 1)[0] as Extract<ServerMessage, { t: T }>);
      else waiters.push({ type, resolve: resolve as (m: ServerMessage) => void });
    });
  return { ws, next, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe('WebSocket de multijugador', () => {
  it('rechaza conexiones sin token válido', async () => {
    const ws = new WebSocket(`ws://${base}/ws?token=falso`);
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)));
    expect(code).toBe(4401);
  });

  it('dos invitados juegan una partida completa y se guarda', async () => {
    const a = await client();
    const b = await client();
    await a.next('hello');
    await b.next('hello');
    a.send({ t: 'seek', tc: '1+0' });
    await a.next('seeking');
    b.send({ t: 'seek', tc: '1+0' });
    const startA = await a.next('start');
    const startB = await b.next('start');
    // random() = 0.9 → quien ya esperaba (a) juega con blancas.
    expect(startA.color).toBe('w');
    expect(startB.color).toBe('b');
    const gameId = startA.gameId;
    a.send({ t: 'move', gameId, uci: 'f2f3' });
    expect((await b.next('move')).san).toBe('f3');
    b.send({ t: 'chat', gameId, text: '¡suerte!' });
    expect((await a.next('chat')).text).toBe('¡suerte!');
    b.send({ t: 'move', gameId, uci: 'e7e5' });
    await a.next('move');
    a.send({ t: 'resign', gameId });
    const end = await b.next('end');
    expect(end).toMatchObject({ result: '0-1', reason: 'resign' });
    await new Promise((r) => setTimeout(r, 100));
    const saved = await ctx.db.select().from(games);
    expect(saved.some((g) => g.result === '0-1' && g.mode === 'online' && g.pgn.includes('1. f3 e5'))).toBe(true);
    a.ws.close();
    b.ws.close();
  });
});

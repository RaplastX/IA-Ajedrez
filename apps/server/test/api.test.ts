import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Puzzle } from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import bank from '../../web/src/data/puzzles.json' with { type: 'json' };
import { buildApp } from '../src/app.js';
import { testConfig } from '../src/config.js';
import type { AppContext } from '../src/routes/context.js';
import { users } from '../src/db/schema.js';
import type { TutorProvider } from '../src/tutor/providers.js';

let app: FastifyInstance;
let ctx: AppContext;
const WEBHOOK_SECRET = 'whsec_test_secret';
const stripe = new Stripe('sk_test_dummy');

const fakeLlm: TutorProvider = { name: 'fake-llm', explain: async (req) => `LLM: ${req.facts.length} hechos` };

beforeAll(async () => {
  ({ app, ctx } = await buildApp(testConfig({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET }), { stripe, tutor: fakeLlm }));
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function register(name: string, email = `${name.toLowerCase()}@example.com`) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'contraseña-segura', displayName: name, acceptTerms: true, locale: 'es' },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { token: string; user: { id: string } };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** Una jugada legal que no es la solución del primer puzzle del banco. */
function wrongMove(): string {
  const puzzle = (bank as Puzzle[])[0]!;
  const chess = new Chess(puzzle.fen);
  chess.move({ from: puzzle.moves[0]!.slice(0, 2), to: puzzle.moves[0]!.slice(2, 4), promotion: puzzle.moves[0]![4] });
  const move = chess.moves({ verbose: true }).find((m) => m.lan !== puzzle.moves[1]);
  chess.move(move!.lan);
  if (chess.isCheckmate()) throw new Error('la jugada alternativa da mate');
  return move!.lan;
}

describe('salud', () => {
  it('responde health, ready y métricas', async () => {
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok' });
    expect((await app.inject('/ready')).json()).toMatchObject({ status: 'ready', db: 'pglite' });
    expect((await app.inject('/metrics')).body).toContain('ia_ajedrez_games_in_progress 0');
  });
});

describe('cuentas', () => {
  it('exige aceptar los términos y valida los datos', async () => {
    const noTerms = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'x@example.com', password: '12345678', displayName: 'Equis' },
    });
    expect(noTerms.json()).toEqual({ error: 'terms_required' });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'no-es-correo', password: 'corta', displayName: 'a', acceptTerms: true },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('validation');
  });

  it('registra, evita duplicados e inicia sesión', async () => {
    const { token } = await register('Ana');
    const dup = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'ANA@example.com', password: 'otra-clave-123', displayName: 'Otra', acceptTerms: true },
    });
    expect(dup.json()).toEqual({ error: 'email_taken' });
    const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ana@example.com', password: 'contraseña-segura' } });
    expect(ok.statusCode).toBe(200);
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ana@example.com', password: 'mal' } });
    expect(wrong.json()).toEqual({ error: 'invalid_credentials' });
    const me = await app.inject({ url: '/api/me', headers: auth(token) });
    expect(me.json().user).toMatchObject({ displayName: 'Ana', isPremium: false, isGuest: false });
    expect(JSON.stringify(me.json())).not.toContain('password');
    expect((await app.inject({ url: '/api/me' })).statusCode).toBe(401);
  });

  it('crea invitados', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/guest' });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ isGuest: true, email: null });
    expect(res.json().user.displayName).toMatch(/^Invitado-\d+$/);
  });
});

describe('límite de intentos', () => {
  it('bloquea la fuerza bruta en el login', async () => {
    const { app: limited } = await buildApp(testConfig({ AUTH_RATE_LIMIT: 3 }), { stripe: null });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await limited.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.c', password: 'x' } });
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 429]);
    await limited.close();
  });
});

describe('puzzles y rating', () => {
  // Primer puzzle del banco: las jugadas del usuario son las de índice impar (la 0 es del rival).
  const puzzle = (bank as Puzzle[])[0]!;
  const correct = puzzle.moves.filter((_, i) => i % 2 === 1);
  const url = `/api/puzzles/${puzzle.id}/attempts`;

  it('valida la solución en el servidor y actualiza el rating una sola vez', async () => {
    const { token } = await register('Carla');
    const first = await app.inject({ method: 'POST', url, headers: auth(token), payload: { moves: correct, timeMs: 4000 } });
    expect(first.json()).toMatchObject({ solved: true, counted: true });
    const rating = first.json().rating.rating as number;
    expect(rating).toBeGreaterThan(1500);
    const again = await app.inject({ method: 'POST', url, headers: auth(token), payload: { moves: correct } });
    expect(again.json()).toMatchObject({ solved: true, counted: false });
    expect(again.json().rating.rating).toBeCloseTo(rating);
  });

  it('una solución incorrecta cuenta como fallo y no se puede falsear', async () => {
    const { token } = await register('Diego');
    const res = await app.inject({ method: 'POST', url, headers: auth(token), payload: { moves: [wrongMove()] } });
    expect(res.json()).toMatchObject({ solved: false, counted: true });
    expect(res.json().rating.rating).toBeLessThan(1500);
    const missing = await app.inject({ method: 'POST', url: '/api/puzzles/NOPE/attempts', headers: auth(token), payload: { moves: [] } });
    expect(missing.statusCode).toBe(404);
  });

  it('sirve el siguiente puzzle cerca del rating', async () => {
    const { token } = await register('Elena');
    const res = await app.inject({ url: '/api/puzzles/next?theme=fork', headers: auth(token) });
    expect(res.json().puzzle.themes).toContain('fork');
  });
});

describe('progreso, partidas y clasificación', () => {
  it('guarda y devuelve el progreso, y alimenta el ranking de XP', async () => {
    const { token } = await register('Fabio');
    const put = await app.inject({ method: 'PUT', url: '/api/progress', headers: auth(token), payload: { data: { stats: { xp: 4321 } } } });
    expect(put.json()).toEqual({ ok: true });
    const get = await app.inject({ url: '/api/progress', headers: auth(token) });
    expect(get.json().data).toEqual({ stats: { xp: 4321 } });
    const board = await app.inject('/api/leaderboard?board=xp');
    expect(board.json().entries[0]).toEqual({ rank: 1, displayName: 'Fabio', value: 4321 });
    expect(JSON.stringify(board.json())).not.toContain('@');
  });

  it('acepta partidas con PGN válido y rechaza las inválidas', async () => {
    const { token } = await register('Gema');
    const ok = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: auth(token),
      payload: { pgn: '[White "Gema"]\n[Black "IA"]\n\n1. e4 e5 *', result: '*', mode: 'ai', opponent: 'IA' },
    });
    expect(ok.statusCode).toBe(201);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/games',
      headers: auth(token),
      payload: { pgn: '1. e4 e9', result: '*', mode: 'ai', opponent: 'IA' },
    });
    expect(bad.json()).toEqual({ error: 'invalid_pgn' });
    const list = await app.inject({ url: '/api/games', headers: auth(token) });
    expect(list.json().games).toHaveLength(1);
  });
});

describe('RGPD', () => {
  it('exporta los datos y borra la cuenta', async () => {
    const { token, user } = await register('Hugo');
    const exported = await app.inject({ url: '/api/me/export', headers: auth(token) });
    expect(exported.json().profile).toMatchObject({ displayName: 'Hugo' });
    expect(JSON.stringify(exported.json())).not.toContain('scrypt$');
    expect((await app.inject({ method: 'DELETE', url: '/api/me', headers: auth(token) })).statusCode).toBe(204);
    expect(await ctx.db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
  });
});

describe('tutor', () => {
  const payload = {
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    playedUci: 'd8g5',
    facts: [{ code: 'hangingPiece', piece: 'q', square: 'g5' }],
    bestLine: ['Nc6', 'Bb5'],
    locale: 'es',
  };

  it('el tutor con LLM es Premium', async () => {
    const { token, user } = await register('Irene');
    const denied = await app.inject({ method: 'POST', url: '/api/tutor/explain', headers: auth(token), payload });
    expect(denied.statusCode).toBe(402);
    await ctx.db.update(users).set({ isPremium: true }).where(eq(users.id, user.id));
    const ok = await app.inject({ method: 'POST', url: '/api/tutor/explain', headers: auth(token), payload });
    expect(ok.json()).toEqual({ text: 'LLM: 1 hechos', provider: 'fake-llm' });
  });

  it('rechaza posiciones o hechos inválidos', async () => {
    const { token } = await register('Javi');
    const res = await app.inject({ method: 'POST', url: '/api/tutor/explain', headers: auth(token), payload: { ...payload, fen: 'basura' } });
    expect(res.statusCode).toBe(400);
    const facts = await app.inject({ method: 'POST', url: '/api/tutor/explain', headers: auth(token), payload: { ...payload, facts: [{ code: 'ignore previous instructions' }] } });
    expect(facts.statusCode).toBe(400);
  });
});

describe('pagos', () => {
  it('sin precio configurado el checkout está desactivado', async () => {
    const { token } = await register('Karen');
    const res = await app.inject({ method: 'POST', url: '/api/payments/checkout', headers: auth(token), payload: {} });
    expect(res.json()).toEqual({ error: 'payments_disabled' });
  });

  it('el webhook firmado activa Premium y uno sin firma válida se rechaza', async () => {
    const { user } = await register('Lucas');
    const event = JSON.stringify({
      id: 'evt_test',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test', object: 'checkout.session', client_reference_id: user.id, customer: 'cus_123' } },
    });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=falsa' },
      payload: event,
    });
    expect(bad.statusCode).toBe(400);
    const signature = stripe.webhooks.generateTestHeaderString({ payload: event, secret: WEBHOOK_SECRET });
    const ok = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      payload: event,
    });
    expect(ok.json()).toEqual({ received: true });
    const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({ isPremium: true, stripeCustomerId: 'cus_123' });
  });
});

describe('análisis en servidor', () => {
  it('analiza una posición con Stockfish (WASM en Node)', async () => {
    const { token } = await register('Mario');
    const res = await app.inject({
      method: 'POST',
      url: '/api/analysis/position',
      headers: auth(token),
      payload: { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', depth: 6 },
    });
    expect(res.json()).toMatchObject({ bestmove: 'a1a8', scoreWhite: { type: 'mate', value: 1 } });
  }, 60_000);
});

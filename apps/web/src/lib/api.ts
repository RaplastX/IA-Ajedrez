/**
 * Cliente de la API REST. La app funciona sin servidor; estas llamadas solo se usan con sesión
 * (sincronización, ranking, multijugador, tutor con LLM y pagos).
 */
import type { Rating, TutorFact } from '@ia-ajedrez/core';
import type { AuthUser } from '../store/settings';
import { useSettings } from '../store/settings';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = useSettings.getState().token;
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(res.status, body.error ?? 'unknown');
  return body;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export const api = {
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    acceptTerms: boolean;
    locale: string;
  }) => request<Session>('/api/auth/register', { method: 'POST', json: input }),
  login: (input: { email: string; password: string }) =>
    request<Session>('/api/auth/login', { method: 'POST', json: input }),
  guest: () => request<Session>('/api/auth/guest', { method: 'POST', json: {} }),
  me: () => request<{ user: AuthUser }>('/api/me'),
  exportData: () => request<unknown>('/api/me/export'),
  deleteAccount: () => request<void>('/api/me', { method: 'DELETE' }),
  getProgress: () =>
    request<{ data: Record<string, unknown> | null; updatedAt: string | null }>('/api/progress'),
  putProgress: (data: unknown) =>
    request<{ ok: true }>('/api/progress', { method: 'PUT', json: { data } }),
  submitPuzzle: (puzzleId: string, moves: string[], timeMs: number) =>
    request<{ solved: boolean; rating: Rating }>(
      `/api/puzzles/${encodeURIComponent(puzzleId)}/attempts`,
      {
        method: 'POST',
        json: { moves, timeMs },
      },
    ),
  uploadGame: (game: {
    pgn: string;
    result: string;
    mode: string;
    opponent: string;
    accuracy?: number;
  }) => request<{ id: string }>('/api/games', { method: 'POST', json: game }),
  leaderboard: (board: 'puzzle' | 'xp') =>
    request<{ entries: { rank: number; displayName: string; value: number }[] }>(
      `/api/leaderboard?board=${board}`,
    ),
  tutor: (input: {
    fen: string;
    playedUci: string;
    facts: TutorFact[];
    bestLine: string[];
    locale: string;
    question?: string;
  }) =>
    request<{ text: string; provider: string }>('/api/tutor/explain', {
      method: 'POST',
      json: input,
    }),
  checkout: () => request<{ url: string }>('/api/payments/checkout', { method: 'POST', json: {} }),
};

/** URL del WebSocket de multijugador (mismo origen o VITE_API_URL). */
export function websocketUrl(token: string): string {
  const base = BASE || window.location.origin;
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

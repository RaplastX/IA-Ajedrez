/** Protocolo del multijugador por WebSocket y reloj de ajedrez (compartido cliente/servidor). */

export const TIME_CONTROLS = ['1+0', '3+2', '5+0', '10+5'] as const;
export type TimeControl = (typeof TIME_CONTROLS)[number];

export function parseTimeControl(tc: string): { baseMs: number; incrementMs: number } {
  const match = /^(\d+)\+(\d+)$/.exec(tc);
  if (!match) throw new Error(`Control de tiempo inválido: ${tc}`);
  return { baseMs: Number(match[1]) * 60_000, incrementMs: Number(match[2]) * 1000 };
}

export interface ClockState {
  w: number;
  b: number;
  turn: 'w' | 'b';
  /** Marca de tiempo (ms) desde la que corre el reloj del bando que mueve; null = parado. */
  runningSince: number | null;
}

export function createClock(tc: string): ClockState {
  const { baseMs } = parseTimeControl(tc);
  return { w: baseMs, b: baseMs, turn: 'w', runningSince: null };
}

/** Tiempo restante de cada bando en el instante `now`. */
export function clockRemaining(clock: ClockState, now: number): { w: number; b: number } {
  const elapsed = clock.runningSince === null ? 0 : now - clock.runningSince;
  return {
    w: clock.turn === 'w' ? Math.max(0, clock.w - elapsed) : clock.w,
    b: clock.turn === 'b' ? Math.max(0, clock.b - elapsed) : clock.b,
  };
}

/**
 * Aplica una jugada: descuenta el tiempo al que mueve, suma el incremento y cambia el turno.
 * El reloj arranca tras la primera jugada de las blancas (como en Lichess).
 */
export function clockAfterMove(clock: ClockState, now: number, incrementMs: number): ClockState {
  const remaining = clockRemaining(clock, now);
  const mover = clock.turn;
  const started = clock.runningSince !== null;
  const next: ClockState = {
    ...clock,
    ...remaining,
    turn: mover === 'w' ? 'b' : 'w',
    runningSince: now,
  };
  if (started) next[mover] += incrementMs;
  return next;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (ms < 10_000)
    return `${minutes}:${String(seconds).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface PlayerInfo {
  id: string;
  name: string;
  rating?: number;
}

export type ClientMessage =
  | { t: 'seek'; tc: TimeControl }
  | { t: 'cancel' }
  | { t: 'move'; gameId: string; uci: string }
  | { t: 'resign'; gameId: string }
  | { t: 'chat'; gameId: string; text: string }
  | { t: 'ping' };

export type EndReason = 'checkmate' | 'stalemate' | 'draw' | 'resign' | 'timeout' | 'abandon';

export type ServerMessage =
  | { t: 'hello'; user: PlayerInfo }
  | { t: 'seeking'; tc: TimeControl }
  | { t: 'cancelled' }
  | {
      t: 'start';
      gameId: string;
      color: 'w' | 'b';
      white: PlayerInfo;
      black: PlayerInfo;
      fen: string;
      tc: TimeControl;
      clock: ClockState;
      serverNow: number;
    }
  | {
      t: 'move';
      gameId: string;
      uci: string;
      san: string;
      fen: string;
      clock: ClockState;
      serverNow: number;
    }
  | { t: 'end'; gameId: string; result: '1-0' | '0-1' | '1/2-1/2'; reason: EndReason; pgn: string }
  | { t: 'chat'; gameId: string; from: string; text: string }
  | { t: 'error'; code: string }
  | { t: 'pong' };

const MAX_CHAT = 200;

/** Valida y normaliza un mensaje del cliente; devuelve null si no es válido. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  switch (m.t) {
    case 'seek':
      return (TIME_CONTROLS as readonly unknown[]).includes(m.tc)
        ? { t: 'seek', tc: m.tc as TimeControl }
        : null;
    case 'cancel':
    case 'ping':
      return { t: m.t };
    case 'move':
      return typeof m.gameId === 'string' &&
        typeof m.uci === 'string' &&
        /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci)
        ? { t: 'move', gameId: m.gameId, uci: m.uci }
        : null;
    case 'resign':
      return typeof m.gameId === 'string' ? { t: 'resign', gameId: m.gameId } : null;
    case 'chat': {
      if (typeof m.gameId !== 'string' || typeof m.text !== 'string') return null;
      const text = m.text
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, MAX_CHAT);
      return text ? { t: 'chat', gameId: m.gameId, text } : null;
    }
    default:
      return null;
  }
}

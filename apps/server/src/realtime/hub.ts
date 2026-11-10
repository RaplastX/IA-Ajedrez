/**
 * Multijugador en tiempo real: emparejamiento por control de tiempo, partidas con reloj
 * autoritativo en el servidor, validación de jugadas con chess.js, chat y abandono.
 * No depende del transporte: el WebSocket solo entrega mensajes de texto (ver ws.ts),
 * lo que permite testear toda la lógica con relojes y temporizadores simulados.
 */
import {
  clockAfterMove,
  clockRemaining,
  createClock,
  parseClientMessage,
  parseTimeControl,
  uciToMoveObject,
  type ClockState,
  type EndReason,
  type PlayerInfo,
  type ServerMessage,
  type TimeControl,
} from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { randomUUID } from 'node:crypto';

type Send = (msg: ServerMessage) => void;
type Timer = ReturnType<typeof setTimeout>;

export interface FinishedGame {
  id: string;
  white: PlayerInfo;
  black: PlayerInfo;
  tc: TimeControl;
  pgn: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  reason: EndReason;
}

export interface HubOptions {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
  random?: () => number;
  onGameEnd?: (game: FinishedGame) => Promise<void> | void;
  /** Tiempo para reconectar antes de perder por abandono. */
  abandonMs?: number;
}

interface Game {
  id: string;
  tc: TimeControl;
  incrementMs: number;
  white: PlayerInfo;
  black: PlayerInfo;
  chess: Chess;
  clock: ClockState;
  flagTimer?: Timer;
  abandonTimers: Map<string, Timer>;
  chatLog: Map<string, number[]>;
}

export class MultiplayerHub {
  private readonly connections = new Map<string, Send>();
  private readonly seeks = new Map<TimeControl, PlayerInfo>();
  private readonly games = new Map<string, Game>();
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => Timer;
  private readonly clearTimer: (timer: Timer) => void;
  private readonly random: () => number;
  private readonly abandonMs: number;

  constructor(private readonly options: HubOptions = {}) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.random = options.random ?? Math.random;
    this.abandonMs = options.abandonMs ?? 30_000;
  }

  get stats() {
    return { connections: this.connections.size, seeks: this.seeks.size, games: this.games.size };
  }

  /** Registra una conexión. Devuelve los manejadores de mensaje y cierre. */
  connect(user: PlayerInfo, send: Send) {
    this.connections.set(user.id, send);
    send({ t: 'hello', user });
    // Reconexión: se reanuda cualquier partida en curso.
    for (const game of this.games.values()) {
      if (game.white.id !== user.id && game.black.id !== user.id) continue;
      const timer = game.abandonTimers.get(user.id);
      if (timer) this.clearTimer(timer);
      game.abandonTimers.delete(user.id);
      send(this.startMessage(game, game.white.id === user.id ? 'w' : 'b'));
    }
    return {
      onMessage: (raw: string) => this.handle(user, raw),
      onClose: () => this.disconnect(user, send),
    };
  }

  private send(userId: string, msg: ServerMessage) {
    this.connections.get(userId)?.(msg);
  }

  private broadcast(game: Game, msg: ServerMessage) {
    this.send(game.white.id, msg);
    this.send(game.black.id, msg);
  }

  private disconnect(user: PlayerInfo, send: Send) {
    // Solo si esta conexión sigue siendo la activa (una pestaña nueva la sustituye).
    if (this.connections.get(user.id) !== send) return;
    this.connections.delete(user.id);
    for (const [tc, seeker] of this.seeks) if (seeker.id === user.id) this.seeks.delete(tc);
    for (const game of this.games.values()) {
      if (game.white.id !== user.id && game.black.id !== user.id) continue;
      const color = game.white.id === user.id ? 'w' : 'b';
      game.abandonTimers.set(
        user.id,
        this.setTimer(
          () => this.end(game, color === 'w' ? '0-1' : '1-0', 'abandon'),
          this.abandonMs,
        ),
      );
    }
  }

  private handle(user: PlayerInfo, raw: string) {
    const msg = parseClientMessage(raw);
    if (!msg) return this.send(user.id, { t: 'error', code: 'bad_message' });
    switch (msg.t) {
      case 'ping':
        return this.send(user.id, { t: 'pong' });
      case 'seek':
        return this.seek(user, msg.tc);
      case 'cancel':
        for (const [tc, seeker] of this.seeks) if (seeker.id === user.id) this.seeks.delete(tc);
        return this.send(user.id, { t: 'cancelled' });
      case 'move':
        return this.move(user, msg.gameId, msg.uci);
      case 'resign': {
        const game = this.games.get(msg.gameId);
        if (!game) return;
        const color = this.colorOf(game, user.id);
        if (!color) return;
        return this.end(game, color === 'w' ? '0-1' : '1-0', 'resign');
      }
      case 'chat':
        return this.chat(user, msg.gameId, msg.text);
    }
  }

  private colorOf(game: Game, userId: string): 'w' | 'b' | null {
    if (game.white.id === userId) return 'w';
    if (game.black.id === userId) return 'b';
    return null;
  }

  private isPlaying(userId: string) {
    for (const g of this.games.values())
      if (g.white.id === userId || g.black.id === userId) return true;
    return false;
  }

  private seek(user: PlayerInfo, tc: TimeControl) {
    if (this.isPlaying(user.id)) return this.send(user.id, { t: 'error', code: 'already_playing' });
    for (const [otherTc, seeker] of this.seeks)
      if (seeker.id === user.id) this.seeks.delete(otherTc);
    const opponent = this.seeks.get(tc);
    if (!opponent || !this.connections.has(opponent.id)) {
      this.seeks.set(tc, user);
      return this.send(user.id, { t: 'seeking', tc });
    }
    this.seeks.delete(tc);
    const [white, black] = this.random() < 0.5 ? [user, opponent] : [opponent, user];
    const game: Game = {
      id: randomUUID(),
      tc,
      incrementMs: parseTimeControl(tc).incrementMs,
      white,
      black,
      chess: new Chess(),
      clock: createClock(tc),
      abandonTimers: new Map(),
      chatLog: new Map(),
    };
    game.chess.setHeader('Event', `IA Ajedrez online ${tc}`);
    game.chess.setHeader('White', white.name);
    game.chess.setHeader('Black', black.name);
    game.chess.setHeader('TimeControl', tc);
    game.chess.setHeader(
      'Date',
      new Date(this.now()).toISOString().slice(0, 10).replace(/-/g, '.'),
    );
    this.games.set(game.id, game);
    this.send(white.id, this.startMessage(game, 'w'));
    this.send(black.id, this.startMessage(game, 'b'));
  }

  private startMessage(game: Game, color: 'w' | 'b'): ServerMessage {
    return {
      t: 'start',
      gameId: game.id,
      color,
      white: game.white,
      black: game.black,
      fen: game.chess.fen(),
      tc: game.tc,
      clock: game.clock,
      serverNow: this.now(),
    };
  }

  private move(user: PlayerInfo, gameId: string, uci: string) {
    const game = this.games.get(gameId);
    if (!game) return this.send(user.id, { t: 'error', code: 'no_game' });
    const color = this.colorOf(game, user.id);
    if (!color) return this.send(user.id, { t: 'error', code: 'not_a_player' });
    if (game.chess.turn() !== color)
      return this.send(user.id, { t: 'error', code: 'not_your_turn' });

    const now = this.now();
    if (game.clock.runningSince !== null && clockRemaining(game.clock, now)[color] <= 0) {
      return this.end(game, color === 'w' ? '0-1' : '1-0', 'timeout');
    }
    let san: string;
    try {
      san = game.chess.move(uciToMoveObject(uci)!).san;
    } catch {
      return this.send(user.id, { t: 'error', code: 'illegal_move' });
    }
    game.clock = clockAfterMove(game.clock, now, game.incrementMs);
    this.broadcast(game, {
      t: 'move',
      gameId,
      uci,
      san,
      fen: game.chess.fen(),
      clock: game.clock,
      serverNow: now,
    });

    if (game.chess.isCheckmate()) return this.end(game, color === 'w' ? '1-0' : '0-1', 'checkmate');
    if (game.chess.isStalemate()) return this.end(game, '1/2-1/2', 'stalemate');
    if (game.chess.isDraw()) return this.end(game, '1/2-1/2', 'draw');
    this.scheduleFlag(game);
  }

  private scheduleFlag(game: Game) {
    if (game.flagTimer) this.clearTimer(game.flagTimer);
    const turn = game.clock.turn;
    const remaining = clockRemaining(game.clock, this.now())[turn];
    game.flagTimer = this.setTimer(() => {
      if (!this.games.has(game.id) || game.clock.turn !== turn) return;
      // Sin material para dar mate, quedarse sin tiempo no pierde (regla FIDE simplificada).
      this.end(game, turn === 'w' ? '0-1' : '1-0', 'timeout');
    }, remaining + 50);
  }

  private chat(user: PlayerInfo, gameId: string, text: string) {
    const game = this.games.get(gameId);
    if (!game || !this.colorOf(game, user.id)) return;
    const now = this.now();
    const recent = (game.chatLog.get(user.id) ?? []).filter((t) => now - t < 10_000);
    if (recent.length >= 5) return this.send(user.id, { t: 'error', code: 'chat_rate_limited' });
    game.chatLog.set(user.id, [...recent, now]);
    this.broadcast(game, { t: 'chat', gameId, from: user.name, text });
  }

  private end(game: Game, result: FinishedGame['result'], reason: EndReason) {
    if (!this.games.has(game.id)) return;
    this.games.delete(game.id);
    if (game.flagTimer) this.clearTimer(game.flagTimer);
    for (const timer of game.abandonTimers.values()) this.clearTimer(timer);
    game.chess.setHeader('Result', result);
    game.chess.setHeader('Termination', reason);
    const pgn = game.chess.pgn();
    this.broadcast(game, { t: 'end', gameId: game.id, result, reason, pgn });
    void Promise.resolve(
      this.options.onGameEnd?.({
        id: game.id,
        white: game.white,
        black: game.black,
        tc: game.tc,
        pgn,
        result,
        reason,
      }),
    ).catch(() => undefined);
  }

  /** Cierra temporizadores (al apagar el servidor). */
  shutdown() {
    for (const game of this.games.values()) {
      if (game.flagTimer) this.clearTimer(game.flagTimer);
      for (const timer of game.abandonTimers.values()) this.clearTimer(timer);
    }
  }
}

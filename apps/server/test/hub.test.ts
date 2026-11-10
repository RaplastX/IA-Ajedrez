import type { ServerMessage } from '@ia-ajedrez/core';
import { describe, expect, it } from 'vitest';
import { MultiplayerHub, type FinishedGame } from '../src/realtime/hub.js';

/** Reloj y temporizadores simulados para controlar el tiempo en los tests. */
function fakeTime() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (t: ReturnType<typeof setTimeout>) => void timers.delete(t as unknown as number),
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers.entries()].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && timers.has(id)) {
          timers.delete(id);
          t.fn();
        }
      }
    },
  };
}

function setup() {
  const time = fakeTime();
  const ended: FinishedGame[] = [];
  const hub = new MultiplayerHub({
    ...time,
    random: () => 0,
    abandonMs: 30_000,
    onGameEnd: (g) => void ended.push(g),
  });
  const inbox = { ana: [] as ServerMessage[], beto: [] as ServerMessage[] };
  const ana = hub.connect({ id: 'ana', name: 'Ana' }, (m) => inbox.ana.push(m));
  const beto = hub.connect({ id: 'beto', name: 'Beto' }, (m) => inbox.beto.push(m));
  const send = (who: typeof ana, msg: object) => who.onMessage(JSON.stringify(msg));
  const last = (list: ServerMessage[]) => list[list.length - 1]!;
  return { hub, time, ended, inbox, ana, beto, send, last };
}

function startGame(s: ReturnType<typeof setup>) {
  s.send(s.ana, { t: 'seek', tc: '3+2' });
  expect(s.last(s.inbox.ana)).toEqual({ t: 'seeking', tc: '3+2' });
  s.send(s.beto, { t: 'seek', tc: '3+2' });
  const start = s.last(s.inbox.beto);
  if (start.t !== 'start') throw new Error('no empezó');
  // random() = 0 → quien busca segundo (beto) juega con blancas.
  expect(start.color).toBe('w');
  expect(s.last(s.inbox.ana)).toMatchObject({ t: 'start', color: 'b' });
  return start.gameId;
}

describe('emparejamiento y partida', () => {
  it('empareja, valida turnos y jugadas, y termina en mate', () => {
    const s = setup();
    const gameId = startGame(s);
    s.send(s.ana, { t: 'move', gameId, uci: 'e7e5' });
    expect(s.last(s.inbox.ana)).toEqual({ t: 'error', code: 'not_your_turn' });
    s.send(s.beto, { t: 'move', gameId, uci: 'e2e5' });
    expect(s.last(s.inbox.beto)).toEqual({ t: 'error', code: 'illegal_move' });
    // Mate del loco: 1.f3 e5 2.g4 Qh4#
    for (const [who, uci] of [
      [s.beto, 'f2f3'],
      [s.ana, 'e7e5'],
      [s.beto, 'g2g4'],
      [s.ana, 'd8h4'],
    ] as const) {
      s.time.advance(1000);
      s.send(who, { t: 'move', gameId, uci });
    }
    expect(s.last(s.inbox.beto)).toMatchObject({ t: 'end', result: '0-1', reason: 'checkmate' });
    expect(s.ended[0]).toMatchObject({
      result: '0-1',
      reason: 'checkmate',
      white: { name: 'Beto' },
    });
    expect(s.ended[0]!.pgn).toContain('Qh4#');
    expect(s.hub.stats.games).toBe(0);
  });

  it('descuenta el reloj y pierde por tiempo', () => {
    const s = setup();
    const gameId = startGame(s);
    s.send(s.beto, { t: 'move', gameId, uci: 'e2e4' }); // arranca el reloj
    s.time.advance(5_000);
    s.send(s.ana, { t: 'move', gameId, uci: 'e7e5' });
    const move = s.last(s.inbox.ana);
    expect(move).toMatchObject({ t: 'move', clock: { b: 180_000 - 5_000 + 2_000, turn: 'w' } });
    s.time.advance(181_000); // las blancas no mueven
    expect(s.last(s.inbox.ana)).toMatchObject({ t: 'end', result: '0-1', reason: 'timeout' });
  });

  it('abandono y reconexión', () => {
    const s = setup();
    const gameId = startGame(s);
    s.ana.onClose();
    s.time.advance(10_000);
    // Ana vuelve antes de 30 s: recibe la partida en curso.
    const inbox: ServerMessage[] = [];
    s.hub.connect({ id: 'ana', name: 'Ana' }, (m) => inbox.push(m));
    expect(inbox.map((m) => m.t)).toEqual(['hello', 'start']);
    s.time.advance(60_000);
    expect(s.ended).toHaveLength(0);
    // Beto se va y no vuelve: pierde por abandono.
    s.beto.onClose();
    s.time.advance(30_001);
    expect(s.ended[0]).toMatchObject({ result: '0-1', reason: 'abandon' });
    expect(inbox.at(-1)).toMatchObject({ t: 'end', gameId });
  });

  it('abandonar, chat con límite y mensajes inválidos', () => {
    const s = setup();
    const gameId = startGame(s);
    for (let i = 0; i < 6; i++) s.send(s.ana, { t: 'chat', gameId, text: `hola ${i}` });
    const chats = s.inbox.beto.filter((m) => m.t === 'chat');
    expect(chats).toHaveLength(5);
    expect(s.last(s.inbox.ana)).toEqual({ t: 'error', code: 'chat_rate_limited' });
    s.ana.onMessage('{"t":"seek","tc":"99+0"}');
    expect(s.last(s.inbox.ana)).toEqual({ t: 'error', code: 'bad_message' });
    s.send(s.ana, { t: 'seek', tc: '1+0' });
    expect(s.last(s.inbox.ana)).toEqual({ t: 'error', code: 'already_playing' });
    s.send(s.beto, { t: 'resign', gameId });
    expect(s.ended[0]).toMatchObject({ result: '0-1', reason: 'resign' });
  });

  it('cancelar la búsqueda', () => {
    const s = setup();
    s.send(s.ana, { t: 'seek', tc: '5+0' });
    s.send(s.ana, { t: 'cancel' });
    expect(s.last(s.inbox.ana)).toEqual({ t: 'cancelled' });
    s.send(s.beto, { t: 'seek', tc: '5+0' });
    expect(s.last(s.inbox.beto)).toEqual({ t: 'seeking', tc: '5+0' });
  });
});

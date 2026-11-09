import { describe, expect, it } from 'vitest';
import { clockAfterMove, clockRemaining, createClock, formatClock, parseClientMessage, parseTimeControl } from '../src/index.js';

describe('reloj', () => {
  it('arranca tras la primera jugada y aplica incremento', () => {
    let clock = createClock('3+2');
    expect(parseTimeControl('3+2')).toEqual({ baseMs: 180_000, incrementMs: 2000 });
    clock = clockAfterMove(clock, 1_000, 2000); // 1.e4: aún no corre, sin incremento
    expect(clock).toMatchObject({ w: 180_000, b: 180_000, turn: 'b', runningSince: 1_000 });
    clock = clockAfterMove(clock, 6_000, 2000); // las negras piensan 5 s
    expect(clock).toMatchObject({ w: 180_000, b: 177_000, turn: 'w' });
    expect(clockRemaining(clock, 16_000)).toEqual({ w: 170_000, b: 177_000 });
    expect(clockRemaining(clock, 999_999).w).toBe(0);
  });

  it('formatea', () => {
    expect(formatClock(180_000)).toBe('3:00');
    expect(formatClock(9_450)).toBe('0:10.4');
  });
});

describe('mensajes del cliente', () => {
  it('valida y sanea', () => {
    expect(parseClientMessage('{"t":"seek","tc":"3+2"}')).toEqual({ t: 'seek', tc: '3+2' });
    expect(parseClientMessage('{"t":"seek","tc":"90+0"}')).toBeNull();
    expect(parseClientMessage('{"t":"move","gameId":"g","uci":"e7e8q"}')).toMatchObject({ uci: 'e7e8q' });
    expect(parseClientMessage('{"t":"move","gameId":"g","uci":"e9e8"}')).toBeNull();
    expect(parseClientMessage('{"t":"chat","gameId":"g","text":"  hola\\u0007  "}')).toEqual({ t: 'chat', gameId: 'g', text: 'hola' });
    expect(parseClientMessage('{"t":"chat","gameId":"g","text":"   "}')).toBeNull();
    expect(parseClientMessage('no json')).toBeNull();
    expect(parseClientMessage('{"t":"hack"}')).toBeNull();
  });
});

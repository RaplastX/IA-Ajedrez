import { describe, expect, it, vi } from 'vitest';
import { WEAPONS, type WeaponId } from '../src/lib/weapons';

/** Contexto 2D de mentira: acepta cualquier llamada y cuenta los trazos. */
function fakeContext() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  return {
    calls,
    g: new Proxy(target, {
      get: (_t, prop: string) => {
        if (prop === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
        if (prop in target) return target[prop];
        return (...args: unknown[]) => {
          calls.push(prop);
          return args.length ? undefined : undefined;
        };
      },
      set: (_t, prop: string, value) => {
        target[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D,
  };
}

describe('armas de las piezas', () => {
  const ids = Object.keys(WEAPONS) as WeaponId[];

  it('cada pieza tiene su propia arma', () => {
    expect(new Set(ids.map((id) => WEAPONS[id].draw)).size).toBe(6);
  });

  it.each(ids)('el arma de %s se dibuja en todo su recorrido en cualquier dirección', (id) => {
    const spec = WEAPONS[id];
    expect(spec.hit).toBeGreaterThan(0.2);
    expect(spec.hit).toBeLessThan(0.8);
    for (const target of [
      { x: 100, y: 30 },
      { x: 30, y: 100 },
      { x: 16, y: 16 },
      { x: 100, y: 100 },
    ]) {
      const { g, calls } = fakeContext();
      for (let p = 0; p <= 1.0001; p += 0.02) {
        expect(() => spec.draw(g, Math.min(1, p), { x: 64, y: 64 }, target)).not.toThrow();
      }
      expect(calls.length).toBeGreaterThan(20);
    }
  });

  it('el impacto ocurre una sola vez por ataque (con hit-stop)', async () => {
    vi.useFakeTimers();
    const frames: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { WeaponStage } = await import('../src/lib/weapons');
    const { g } = fakeContext();
    const canvas = {
      getContext: () => g,
      getBoundingClientRect: () => ({ width: 400, height: 400 }),
      width: 400,
      height: 400,
    } as unknown as HTMLCanvasElement;
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const stage = new WeaponStage(canvas);
    const onHit = vi.fn();
    const onDone = vi.fn();
    stage.play(WEAPONS.k, { x: 20, y: 20 }, { x: 60, y: 60 }, onHit, onDone);
    for (let t = 16; t < 3000 && onDone.mock.calls.length === 0; t += 16) frames.shift()?.(t);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('fuente de píxeles', () => {
  it('dibuja "MATE" y los números con contorno', async () => {
    const { text } = await import('../src/lib/pixel');
    const fills: string[] = [];
    const g = {
      set fillStyle(v: string) {
        fills.push(v);
      },
      fillRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    text(g, 'MATE', 64, 62, 4, '#ff2e63');
    text(g, '+9', 20, 20, 1, '#ffd23f');
    expect(fills).toContain('#ff2e63');
    expect(fills).toContain('#1b1f4a');
  });
});

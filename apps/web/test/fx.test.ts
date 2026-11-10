import { mulberry32 } from '@ia-ajedrez/core';
import { describe, expect, it } from 'vitest';
import { captureBurst, confetti, stepParticle } from '../src/lib/fx';
import { play } from '../src/lib/sound';
import { motionEnabled, useSettings } from '../src/store/settings';

describe('partículas', () => {
  it('la captura genera destello, chispas y humo centrados en la casilla', () => {
    const burst = captureBurst(100, 50, 40, mulberry32(1));
    expect(burst.filter((p) => p.kind === 'ring')).toHaveLength(1);
    expect(burst.filter((p) => p.kind === 'spark').length).toBeGreaterThan(20);
    expect(burst.filter((p) => p.kind === 'smoke').length).toBeGreaterThan(3);
    expect(burst[0]).toMatchObject({ x: 100, y: 50 });
  });

  it('las chispas caen por gravedad y todas se extinguen', () => {
    const particles = captureBurst(0, 0, 40, mulberry32(2));
    const spark = particles.find((p) => p.kind === 'spark')!;
    const vy0 = spark.vy;
    stepParticle(spark, 0.05);
    expect(spark.vy).toBeGreaterThan(vy0 - Math.abs(vy0) * 0.1);
    let alive = particles;
    for (let i = 0; i < 200 && alive.length; i++)
      alive = alive.filter((p) => stepParticle(p, 0.016));
    expect(alive).toEqual([]);
  });

  it('el confeti es determinista con semilla y empieza por encima de la pantalla', () => {
    const a = confetti(400, 30, mulberry32(3));
    expect(a).toEqual(confetti(400, 30, mulberry32(3)));
    expect(a.every((p) => p.y < 0 && p.x >= 0 && p.x <= 400)).toBe(true);
  });
});

describe('ajustes de efectos y sonido', () => {
  it('desactivar efectos apaga las animaciones', () => {
    useSettings.getState().setEffects(false);
    expect(motionEnabled()).toBe(false);
    useSettings.getState().setEffects(true);
  });

  it('el sonido no falla sin Web Audio (jsdom) ni con el sonido apagado', () => {
    expect(() => play('capture')).not.toThrow();
    useSettings.getState().setSound(false);
    expect(() => play('success')).not.toThrow();
    useSettings.getState().setSound(true);
  });

  it('el tema por defecto es oscuro premium con tablero medianoche', () => {
    expect(useSettings.getState()).toMatchObject({
      appTheme: 'dark',
      boardTheme: 'midnight',
      sound: true,
    });
  });
});

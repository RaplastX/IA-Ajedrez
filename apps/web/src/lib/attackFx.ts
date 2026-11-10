/**
 * Coreografía de una captura o un mate en pixel art: el atacante se arma y usa SU arma, hay un
 * instante de "hit-stop", la pieza capturada parpadea en blanco y se rompe, todo el tablero se
 * tiñe un instante del color del arma, el tablero tiembla en píxeles enteros y aparece el daño
 * como un número pequeño en fuente de píxeles. Sin carteles ni brillos: estilo retro.
 */
import { pieceImage, pieceKey } from '../components/Board/pieces';
import { captureBurst, dustPuff, shatter, type ParticleSystem } from './fx';
import { tap } from './haptics';
import { C } from './pixel';
import { play } from './sound';
import { UNIT, WEAPONS, type WeaponId, type WeaponStage } from './weapons';

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface AttackOptions {
  board: HTMLElement;
  stage: WeaponStage | null;
  particles: ParticleSystem | null;
  weapon: WeaponId;
  /** Centros de casilla en unidades de casilla (col + 0.5, fila + 0.5). */
  from: [number, number];
  to: [number, number];
  victim: { type: string; color: 'w' | 'b' } | null;
  attackerEl: HTMLElement | null;
  defer: (fn: () => void, ms: number) => void;
}

const canAnimate = (el: Element | null): boolean =>
  !!el && typeof (el as HTMLElement).animate === 'function';

/** Cuántos "cuadros" tiene una animación de `ms` milisegundos (movimiento a saltos). */
const stepsFor = (ms: number) => `steps(${Math.max(4, Math.round((ms / 1000) * 14))}, end)`;

/** Teñido de color de todo el tablero, como el destello rojo/naranja de Shotgun King. */
export function flashBoard(board: HTMLElement, color: string, strength = 0.55) {
  const flash = document.createElement('div');
  flash.className = 'fx-flash';
  flash.style.background = color;
  board.appendChild(flash);
  if (!canAnimate(flash)) return flash.remove();
  const a = flash.animate(
    [
      { opacity: strength, offset: 0 },
      { opacity: 0, offset: 0.34 },
      { opacity: strength * 0.5, offset: 0.5 },
      { opacity: 0, offset: 0.75 },
      { opacity: 0, offset: 1 },
    ],
    { duration: 260, easing: 'steps(1, end)' },
  );
  a.onfinish = () => flash.remove();
}

/** Temblor del tablero en píxeles enteros y a pocos cuadros. */
export function shakeBoard(board: HTMLElement, amp: number, ux = 1, uy = 0, ms = 280) {
  if (!canAnimate(board)) return;
  const seq = [1, -1, 0.7, -0.5, 0.3, 0];
  board.animate(
    seq.map((d, i) => ({
      transform: `translate(${Math.round(d * amp * (0.4 + Math.abs(ux)))}px, ${Math.round(d * amp * (0.3 + Math.abs(uy)) * (i % 2 ? -1 : 1))}px)`,
      easing: 'steps(1, end)',
    })),
    { duration: ms },
  );
}

export function playAttack(o: AttackOptions): number {
  const spec = WEAPONS[o.weapon];
  const real = o.board.getBoundingClientRect().width / 8; // píxeles de pantalla por casilla
  const U = UNIT;
  const a = { x: o.from[0] * U, y: o.from[1] * U };
  const b = { x: o.to[0] * U, y: o.to[1] * U };
  const dx = o.from[0] - o.to[0]; // en casillas: del destino al origen
  const dy = o.from[1] - o.to[1];
  const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / dist;
  const uy = (b.y - a.y) / dist;
  const hitMs = spec.ms * spec.hit;
  const total = spec.ms + 280;

  // 1) El atacante vuelve visualmente a su casilla y hace su movimiento propio (a saltos).
  const at = (x: number, y: number, extra = '') => `translate(${x * 100}%, ${y * 100}%) ${extra}`;
  if (o.attackerEl && canAnimate(o.attackerEl)) {
    const f = (ms: number) => Math.min(0.99, ms / total);
    const frames: Keyframe[] = spec.melee
      ? [
          { offset: 0, transform: at(dx, dy) },
          { offset: f(hitMs - 170), transform: at(dx - ux * 0.3, dy - uy * 0.3, 'scale(1.1,0.9)') },
          { offset: f(hitMs), transform: at(dx * 0.02, dy * 0.02, 'scale(1.25,0.8)') },
          { offset: f(hitMs + 140), transform: at(0, -0.1, 'scale(0.94,1.1)') },
          { offset: 1, transform: at(0, 0) },
        ]
      : [
          { offset: 0, transform: at(dx, dy) },
          {
            offset: f(hitMs * 0.5),
            transform: at(dx - ux * 0.04, dy - uy * 0.04, 'scale(1.05,0.95)'),
          },
          { offset: f(hitMs - 30), transform: at(dx, dy, 'scale(0.95,1.08)') },
          {
            offset: f(hitMs + 30),
            transform: at(dx - ux * 0.22, dy - uy * 0.22, 'scale(1.1,0.9)'),
          },
          { offset: f(hitMs + 220), transform: at(dx, dy) },
          { offset: f(hitMs + 340), transform: at(dx * 0.5, dy * 0.5 - 0.5, 'scale(0.92,1.12)') },
          { offset: 1, transform: at(0, 0) },
        ];
    const duration = total + (spec.melee ? 0 : 340);
    // Cuadro de ataque del sprite (ojos encendidos, cuerpo estirado) mientras dura el ataque.
    const sprite = o.attackerEl.querySelector<HTMLElement>('.sprite');
    if (sprite) {
      sprite.classList.add('atk');
      o.defer(() => sprite.classList.remove('atk'), duration);
    }
    o.attackerEl.animate(frames, { duration, easing: stepsFor(duration), fill: 'backwards' });
  }

  // 2) El arma (pixel art en el canvas de baja resolución).
  o.stage?.play(spec, a, b, () => impact());

  // 3) El impacto.
  function impact() {
    play(o.weapon === 'k' || o.weapon === 'r' ? 'capture' : 'check');
    tap('heavy');
    const value = o.victim ? (PIECE_VALUE[o.victim.type] ?? 1) : 10;
    // La pieza capturada parpadea en blanco, sube un poco y se rompe en píxeles.
    if (o.victim) {
      const ghost = document.createElement('img');
      ghost.src = pieceImage(pieceKey(o.victim.color, o.victim.type), 5);
      ghost.className = 'fx-ghost';
      ghost.style.cssText = `width:${real}px;height:${real}px;left:${o.to[0] * real - real / 2}px;top:${o.to[1] * real - real / 2}px`;
      o.board.appendChild(ghost);
      if (canAnimate(ghost)) {
        const dir = Math.sign(ux) || 1;
        const white = 'brightness(0) invert(1)';
        const fly = ghost.animate(
          [
            { filter: 'none', transform: 'none', offset: 0 },
            { filter: white, transform: 'none', offset: 0.15 },
            { filter: white, transform: `translate(${dir * 8}px, -10px)`, offset: 0.5 },
            {
              filter: white,
              transform: `translate(${dir * 16}px, -4px) scale(0.75)`,
              opacity: 1,
              offset: 0.8,
            },
            {
              filter: white,
              transform: `translate(${dir * 20}px, 2px) scale(0.5)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: 520, easing: 'steps(9, end)' },
        );
        fly.onfinish = () => ghost.remove();
      } else ghost.remove();
    }
    o.particles?.add([
      ...captureBurst(b.x, b.y, U),
      ...shatter(b.x, b.y, U, ux, uy, 8 + value * 2),
      ...dustPuff(b.x, b.y, U),
    ]);
    flashBoard(o.board, spec.flash);
    shakeBoard(o.board, spec.shake + Math.round(value * 0.4), ux, uy);
    // Daño: un número pequeño en fuente de píxeles (como el "1" y el "2" del juego de referencia).
    if (o.victim && value > 0) {
      o.stage?.playText(
        `+${value}`,
        { x: Math.round(b.x), y: Math.round(b.y) - 7 },
        value >= 5 ? 2 : 1,
        C.yellow,
        900,
        8,
      );
    }
  }
  return hitMs;
}

/** Remate del jaque mate: el rey se tambalea y cae, parpadea "MATE" y el tablero se sacude fuerte. */
export function mateFlourish(
  board: HTMLElement,
  stage: WeaponStage | null,
  kingEl: HTMLElement | null,
  kingCenter: [number, number],
  particles: ParticleSystem | null,
  color: string,
) {
  const U = UNIT;
  if (kingEl && canAnimate(kingEl)) {
    kingEl.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-14deg) translateY(-8%)', offset: 0.2 },
        { transform: 'rotate(10deg) translateY(-4%)', offset: 0.4 },
        { transform: 'rotate(92deg) translate(20%, 10%)', offset: 0.8 },
        { transform: 'rotate(84deg) translate(20%, 8%)' },
      ],
      { duration: 900, easing: 'steps(12, end)', fill: 'forwards' },
    );
  }
  const x = kingCenter[0] * U;
  const y = kingCenter[1] * U;
  particles?.add([...captureBurst(x, y, U * 1.6), ...shatter(x, y, U, 0, -1, 26)]);
  flashBoard(board, color, 0.7);
  shakeBoard(board, 9, 1, 1, 520);
  stage?.playText('MATE', { x: 64, y: 62 }, 4, C.pink, 1900, 0, true);
}

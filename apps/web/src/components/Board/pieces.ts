/**
 * Piezas en pixel art propias (ver sprites.ts). Se generan al usarlas por primera vez.
 */
import { frameUrl, sheetUrl, type Side } from './sprites';

export const pieceKey = (color: 'w' | 'b', type: string) => `${color}${type.toUpperCase()}`;

const split = (key: string): [string, Side] => [key[1]!.toLowerCase(), key[0] as Side];

/** Imagen fija de una pieza (cuadro de reposo, o 5 = daño) para arrastre, coronación y fantasmas. */
export function pieceImage(key: string, frame = 0): string {
  const [type, side] = split(key);
  return frameUrl(type, side, frame);
}

/** Hoja de animación de 6 cuadros. */
export function pieceSheet(key: string): string {
  const [type, side] = split(key);
  return sheetUrl(type, side);
}

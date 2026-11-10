/**
 * Piezas "Cburnett" (Wikimedia Commons), con triple licencia GFDL / BSD / GPL.
 * Se usan bajo la licencia BSD; ver docs/LEGAL.md y la página "Licencias".
 */
import bB from '../../assets/pieces/Chess_bdt45.svg';
import wB from '../../assets/pieces/Chess_blt45.svg';
import bK from '../../assets/pieces/Chess_kdt45.svg';
import wK from '../../assets/pieces/Chess_klt45.svg';
import bN from '../../assets/pieces/Chess_ndt45.svg';
import wN from '../../assets/pieces/Chess_nlt45.svg';
import bP from '../../assets/pieces/Chess_pdt45.svg';
import wP from '../../assets/pieces/Chess_plt45.svg';
import bQ from '../../assets/pieces/Chess_qdt45.svg';
import wQ from '../../assets/pieces/Chess_qlt45.svg';
import bR from '../../assets/pieces/Chess_rdt45.svg';
import wR from '../../assets/pieces/Chess_rlt45.svg';

export const PIECE_IMAGES: Record<string, string> = {
  wK,
  wQ,
  wR,
  wB,
  wN,
  wP,
  bK,
  bQ,
  bR,
  bB,
  bN,
  bP,
};

export const pieceKey = (color: 'w' | 'b', type: string) => `${color}${type.toUpperCase()}`;

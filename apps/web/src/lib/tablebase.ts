/**
 * Cliente de la tablebase pública de Lichess (Syzygy hasta 7 piezas): https://tablebase.lichess.ovh
 * Da el resultado teórico exacto de finales, ideal para el entrenador de finales.
 */

export type TablebaseCategory =
  | 'win'
  | 'unknown'
  | 'syzygy-win'
  | 'maybe-win'
  | 'cursed-win'
  | 'draw'
  | 'blessed-loss'
  | 'maybe-loss'
  | 'syzygy-loss'
  | 'loss';

export interface TablebaseMove {
  uci: string;
  san: string;
  /** Categoría desde el punto de vista del bando que mueve DESPUÉS de esta jugada (el rival). */
  category: TablebaseCategory;
  dtz: number | null;
  dtm: number | null;
}

export interface TablebaseResult {
  category: TablebaseCategory;
  dtz: number | null;
  dtm: number | null;
  checkmate: boolean;
  stalemate: boolean;
  moves: TablebaseMove[];
}

const ENDPOINT = 'https://tablebase.lichess.ovh/standard';

export function pieceCount(fen: string): number {
  return (fen.split(' ')[0] ?? '').replace(/[^a-zA-Z]/g, '').length;
}

/** Normaliza a "ganado / tablas / perdido" para el bando que mueve. */
export function outcome(category: TablebaseCategory): 'win' | 'draw' | 'loss' | 'unknown' {
  if (category === 'win' || category === 'syzygy-win' || category === 'maybe-win') return 'win';
  if (category === 'loss' || category === 'syzygy-loss' || category === 'maybe-loss') return 'loss';
  if (category === 'draw' || category === 'cursed-win' || category === 'blessed-loss') return 'draw';
  return 'unknown';
}

export async function probeTablebase(fen: string, timeoutMs = 5000): Promise<TablebaseResult | null> {
  if (pieceCount(fen) > 7) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENDPOINT}?fen=${encodeURIComponent(fen)}`, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as TablebaseResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

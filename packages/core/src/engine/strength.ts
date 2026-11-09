/**
 * Ajuste de la fuerza del motor a un Elo objetivo.
 *
 * Stockfish acepta `UCI_LimitStrength` + `UCI_Elo` solo a partir de ~1320 Elo. Por debajo
 * combinamos `Skill Level`, poca profundidad y una elección "humana" entre las mejores
 * jugadas (MultiPV) con una temperatura que crece cuanto menor es el Elo objetivo.
 */

export const MIN_ELO = 400;
export const MAX_ELO = 3000;
export const STOCKFISH_MIN_UCI_ELO = 1320;
export const STOCKFISH_MAX_UCI_ELO = 3190;

export interface EngineStrength {
  elo: number;
  uciOptions: Record<string, string | number | boolean>;
  go: { depth?: number; movetime?: number };
  /** Número de variantes pedidas al motor para elegir una jugada "humana". */
  multipv: number;
  /** Temperatura en centipeones para la elección entre variantes (0 = siempre la mejor). */
  temperatureCp: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function strengthForElo(targetElo: number): EngineStrength {
  const elo = Math.round(clamp(targetElo, MIN_ELO, MAX_ELO));
  if (elo >= STOCKFISH_MIN_UCI_ELO) {
    return {
      elo,
      uciOptions: {
        UCI_LimitStrength: true,
        UCI_Elo: clamp(elo, STOCKFISH_MIN_UCI_ELO, STOCKFISH_MAX_UCI_ELO),
      },
      go: { movetime: elo >= 2200 ? 1000 : 500 },
      multipv: 1,
      temperatureCp: 0,
    };
  }
  // 400 → nivel 0, 1300 → nivel ~5
  const skill = Math.round(((elo - MIN_ELO) / (STOCKFISH_MIN_UCI_ELO - MIN_ELO)) * 5);
  const depth = Math.max(1, Math.round(1 + ((elo - MIN_ELO) / 900) * 5));
  // 400 Elo ≈ 250 cp de temperatura, 1300 Elo ≈ 40 cp.
  const temperatureCp = Math.round(250 - ((elo - MIN_ELO) / 900) * 210);
  return {
    elo,
    uciOptions: { UCI_LimitStrength: false, 'Skill Level': clamp(skill, 0, 20) },
    go: { depth },
    multipv: 5,
    temperatureCp,
  };
}

export interface CandidateMove {
  uci: string;
  /** Centipeones desde el punto de vista del bando que mueve. */
  cp: number;
}

/**
 * Elige una jugada entre candidatas con probabilidad ∝ exp(-(mejor - cp) / T).
 * `random` se inyecta para que la función sea determinista en los tests.
 */
export function pickHumanMove(
  candidates: CandidateMove[],
  temperatureCp: number,
  random: () => number = Math.random,
): CandidateMove | null {
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates.map((c) => c.cp));
  if (temperatureCp <= 0) return candidates.find((c) => c.cp === best) ?? null;
  const weights = candidates.map((c) => Math.exp(-(best - c.cp) / temperatureCp));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

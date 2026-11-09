/**
 * Glicko-2 (Mark Glickman, http://www.glicko.net/glicko/glicko2.pdf).
 * Se usa para la valoración de táctica: cada puzzle es un "rival" con su propio rating y RD.
 */

export interface Rating {
  rating: number;
  rd: number;
  volatility: number;
}

export interface GameResult {
  opponent: Pick<Rating, 'rating' | 'rd'>;
  /** 1 = victoria (puzzle resuelto), 0 = derrota, 0.5 = tablas. */
  score: number;
}

export const DEFAULT_RATING: Rating = { rating: 1500, rd: 350, volatility: 0.06 };

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;
const MIN_RD = 45;
const MAX_RD = 350;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Actualiza un rating con los resultados de un periodo (puede ser un único puzzle). */
export function updateRating(player: Rating, results: GameResult[], tau = TAU): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { ...player, rd: Math.min(MAX_RD, phiStar * SCALE) };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const e = expected(mu, muJ, phiJ);
    vInv += g(phiJ) ** 2 * e * (1 - e);
    deltaSum += g(phiJ) * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Paso 5: nueva volatilidad con el algoritmo de Illinois.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) -
      (x - a) / (tau * tau)
    );
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * SCALE + 1500,
    rd: newPhi * SCALE,
    volatility: newSigma,
  };
}

/** Variante para la app: acota el RD para que el rating no se congele ni se dispare. */
export function updatePuzzleRating(player: Rating, puzzleRating: number, solved: boolean): Rating {
  const next = updateRating(player, [
    { opponent: { rating: puzzleRating, rd: 80 }, score: solved ? 1 : 0 },
  ]);
  return {
    rating: Math.round(next.rating * 10) / 10,
    rd: Math.min(MAX_RD, Math.max(MIN_RD, next.rd)),
    volatility: Math.min(0.1, next.volatility),
  };
}

/**
 * Detección de debilidades y recomendación de lecciones adaptativas.
 *
 * Combina dos fuentes:
 *  - resultados de puzzles por tema (fork, pin, mateIn2, endgame...);
 *  - errores detectados en el análisis de las partidas del usuario (por fase).
 * Las recomendaciones usan una puntuación tipo UCB: priorizan temas con bajo acierto y
 * dejan un pequeño bono de exploración para temas poco practicados.
 */
import type { GamePhase } from '../analysis/phase.js';

export interface ThemeStats {
  attempts: number;
  successes: number;
  /** Media móvil exponencial del acierto (1 = acierto). */
  recent: number;
  lastPracticed?: string;
}

export type ThemeStatsMap = Record<string, ThemeStats>;

export function recordThemeResult(
  stats: ThemeStatsMap,
  themes: string[],
  solved: boolean,
  when: string = new Date().toISOString(),
  alpha = 0.25,
): ThemeStatsMap {
  const next: ThemeStatsMap = { ...stats };
  for (const theme of themes) {
    const prev = next[theme] ?? { attempts: 0, successes: 0, recent: 0.5 };
    next[theme] = {
      attempts: prev.attempts + 1,
      successes: prev.successes + (solved ? 1 : 0),
      recent: prev.recent * (1 - alpha) + (solved ? 1 : 0) * alpha,
      lastPracticed: when,
    };
  }
  return next;
}

export interface Recommendation {
  theme: string;
  score: number;
  successRate: number | null;
  reason: 'lowSuccess' | 'unpracticed' | 'gameErrors' | 'review';
}

export interface RecommendOptions {
  /** Temas disponibles en el banco de ejercicios. */
  catalog: string[];
  /** Errores en partidas por fase (del análisis). */
  phaseErrors?: Partial<Record<GamePhase, number>>;
  limit?: number;
}

/** Tema de ejercicio asociado a cada fase cuando el usuario falla en partidas reales. */
export const PHASE_TO_THEME: Record<GamePhase, string> = {
  opening: 'opening',
  middlegame: 'middlegame',
  endgame: 'endgame',
};

export function recommendThemes(stats: ThemeStatsMap, options: RecommendOptions): Recommendation[] {
  const totalAttempts = Object.values(stats).reduce((a, s) => a + s.attempts, 0);
  const phaseErrors = options.phaseErrors ?? {};
  const totalPhaseErrors = Object.values(phaseErrors).reduce((a, n) => a + (n ?? 0), 0);

  const recs = options.catalog.map((theme): Recommendation => {
    const s = stats[theme];
    // Acierto suavizado con prior Beta(2, 2) para no sobrerreaccionar con pocos intentos.
    const smoothed = s ? (s.successes + 2) / (s.attempts + 4) : 0.5;
    const blended = s ? 0.5 * smoothed + 0.5 * s.recent : 0.5;
    const exploration = Math.sqrt(Math.log(totalAttempts + 2) / ((s?.attempts ?? 0) + 1)) * 0.15;
    let score = 1 - blended + exploration;
    let reason: Recommendation['reason'] = s ? 'lowSuccess' : 'unpracticed';

    const phase = (Object.keys(PHASE_TO_THEME) as GamePhase[]).find(
      (p) => PHASE_TO_THEME[p] === theme,
    );
    if (phase && totalPhaseErrors > 0) {
      const share = (phaseErrors[phase] ?? 0) / totalPhaseErrors;
      if (share > 0.4) {
        score += share * 0.5;
        reason = 'gameErrors';
      }
    }
    if (s && blended > 0.8) reason = 'review';
    return { theme, score, successRate: s ? s.successes / s.attempts : null, reason };
  });

  return recs.sort((a, b) => b.score - a.score).slice(0, options.limit ?? 3);
}

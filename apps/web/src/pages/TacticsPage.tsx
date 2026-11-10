import {
  chooseDifficultyArm,
  dailyIndex,
  pickPuzzle,
  playPuzzleMove,
  puzzleHint,
  startPuzzle,
  uciToMoveObject,
  type DifficultyArm,
  type Puzzle,
  type PuzzleState,
} from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Board, type BoardMove } from '../components/Board/Board';
import puzzleBank from '../data/puzzles.json';
import { THEME_CATALOG } from '../data/themes';
import { track } from '../lib/analytics';
import { api } from '../lib/api';
import { today } from '../lib/storage';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

const BANK = puzzleBank as Puzzle[];
type Mode = 'adaptive' | 'daily' | 'mine';

const applyUci = (fen: string, uci: string) => {
  const chess = new Chess(fen);
  chess.move(uciToMoveObject(uci)!);
  return chess.fen();
};

export default function TacticsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode | null) ?? 'adaptive';
  const theme = params.get('theme') ?? undefined;
  const token = useSettings((s) => s.token);
  const recordPuzzle = useProgress((s) => s.recordPuzzle);
  const removePersonal = useProgress((s) => s.removePersonalPuzzle);
  const personal = useProgress((s) => s.personalPuzzles);
  const rating = useProgress((s) => s.puzzleRating.rating);

  const [state, setState] = useState<PuzzleState | null>(null);
  const [fen, setFen] = useState(new Chess().fen());
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong' | 'solved' | 'failed'>(
    'idle',
  );
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const arm = useRef<DifficultyArm>(0);
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const userMoves = useRef<string[]>([]);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const begin = useCallback((puzzle: Puzzle) => {
    timers.current.forEach(clearTimeout);
    const initial = startPuzzle(puzzle);
    recorded.current = false;
    userMoves.current = [];
    setHint(null);
    setRatingDelta(null);
    setFeedback('idle');
    setBusy(true);
    setState(initial);
    // Primero se ve la posición previa y luego la jugada del rival, como en Lichess.
    setFen(puzzle.fen);
    setLastMove(null);
    later(() => {
      setFen(initial.fen);
      setLastMove([puzzle.moves[0]!.slice(0, 2), puzzle.moves[0]!.slice(2, 4)]);
      setBusy(false);
      startedAt.current = Date.now();
    }, 600);
  }, []);

  const next = useCallback(() => {
    const progress = useProgress.getState();
    let puzzle: Puzzle | null = null;
    if (mode === 'daily') {
      puzzle = BANK[dailyIndex(today(), BANK.length)]!;
    } else if (mode === 'mine') {
      puzzle = progress.personalPuzzles[0] ?? null;
    } else {
      arm.current = chooseDifficultyArm(progress.difficulty);
      const target = progress.puzzleRating.rating + arm.current;
      const seen = new Set(progress.seenPuzzles);
      puzzle =
        pickPuzzle(BANK, target, { theme, exclude: seen }) ?? pickPuzzle(BANK, target, { theme });
    }
    if (puzzle) begin(puzzle);
    else setState(null);
  }, [mode, theme, begin]);

  useEffect(() => {
    next();
  }, [next]);

  async function record(solved: boolean) {
    if (!state || recorded.current) return;
    recorded.current = true;
    const puzzle = state.puzzle;
    const isPersonal = puzzle.id.startsWith('mine-');
    let serverRating;
    if (token && !isPersonal) {
      try {
        serverRating = (
          await api.submitPuzzle(puzzle.id, userMoves.current, Date.now() - startedAt.current)
        ).rating;
      } catch {
        serverRating = undefined;
      }
    }
    const before = useProgress.getState().puzzleRating.rating;
    recordPuzzle(puzzle, solved, isPersonal || mode === 'daily' ? 0 : arm.current, serverRating);
    setRatingDelta(Math.round(useProgress.getState().puzzleRating.rating - before));
    if (isPersonal && solved) removePersonal(puzzle.id);
    track('puzzle_attempt', { solved, rating: puzzle.rating, mode });
  }

  function onMove(move: BoardMove) {
    if (!state || busy || state.status !== 'playing') return;
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    userMoves.current.push(uci);
    const result = playPuzzleMove(state, uci);
    if (!result.correct) {
      setFen(applyUci(state.fen, uci));
      setLastMove([move.from, move.to]);
      setFeedback('wrong');
      setState(result.state);
      void record(false);
      return;
    }
    const afterUser = applyUci(state.fen, uci);
    setFen(afterUser);
    setLastMove([move.from, move.to]);
    setHint(null);
    if (result.state.status === 'solved' && !result.reply) {
      setState(result.state);
      setFeedback('solved');
      void record(!hint);
      return;
    }
    setFeedback('correct');
    setBusy(true);
    later(() => {
      setFen(result.state.fen);
      setLastMove([result.reply!.slice(0, 2), result.reply!.slice(2, 4)]);
      setState(result.state);
      setBusy(false);
      if (result.state.status === 'solved') {
        setFeedback('solved');
        void record(!hint);
      }
    }, 450);
  }

  function showSolution() {
    if (!state) return;
    void record(false);
    const { puzzle } = state;
    // Reproduce la solución completa desde la posición inicial del puzzle.
    let current = applyUci(puzzle.fen, puzzle.moves[0]!);
    setFen(current);
    setFeedback('failed');
    setBusy(true);
    puzzle.moves.slice(1).forEach((uci, i) => {
      later(
        () => {
          current = applyUci(current, uci);
          setFen(current);
          setLastMove([uci.slice(0, 2), uci.slice(2, 4)]);
          if (i === puzzle.moves.length - 2) setBusy(false);
        },
        700 * (i + 1),
      );
    });
    setState({ ...state, status: 'failed' });
  }

  function setMode(next: Mode, nextTheme?: string) {
    const p = new URLSearchParams();
    if (next !== 'adaptive') p.set('mode', next);
    if (nextTheme) p.set('theme', nextTheme);
    setParams(p);
  }

  const finished = state && state.status !== 'playing';
  const playerColor = state?.playerColor ?? 'w';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('tactics.title')}</h1>
          <p>{t('tactics.subtitle')}</p>
        </div>
        <span className="chip" data-testid="tactics-rating">
          {t('tactics.yourRating')}: {Math.round(rating)}
        </span>
      </div>

      <div
        className="row"
        style={{ marginBottom: 12 }}
        role="tablist"
        aria-label={t('tactics.modes')}
      >
        {(['adaptive', 'daily', 'mine'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {t(`tactics.mode.${m}`)}
            {m === 'mine' && personal.length > 0 ? ` (${personal.length})` : ''}
          </button>
        ))}
      </div>

      {mode === 'adaptive' && (
        <details style={{ marginBottom: 12 }}>
          <summary className="small muted" style={{ cursor: 'pointer' }}>
            {t('tactics.themeFilter')}:{' '}
            <strong>{theme ? t(`themes.${theme}`) : t('tactics.allThemes')}</strong>
          </summary>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="chip"
              aria-pressed={!theme}
              onClick={() => setMode('adaptive')}
            >
              {t('tactics.allThemes')}
            </button>
            {THEME_CATALOG.map((th) => (
              <button
                key={th}
                type="button"
                className="chip"
                aria-pressed={theme === th}
                onClick={() => setMode('adaptive', th)}
              >
                {t(`themes.${th}`)}
              </button>
            ))}
          </div>
        </details>
      )}

      {!state && mode === 'mine' ? (
        <section className="card">
          <p>{t('tactics.noMistakes')}</p>
        </section>
      ) : (
        <div className="train-layout">
          <Board
            fen={fen}
            orientation={playerColor}
            movable={state && state.status === 'playing' && !busy ? playerColor : 'none'}
            onMove={onMove}
            lastMove={lastMove}
            highlights={hint ? { [hint]: 'hint' } : {}}
          />
          <div className="panel">
            <section className="card">
              <p
                className={`status ${feedback === 'solved' || feedback === 'correct' ? 'good' : feedback === 'wrong' || feedback === 'failed' ? 'bad' : ''}`}
                aria-live="polite"
                data-testid="puzzle-status"
              >
                {feedback === 'idle' &&
                  t(playerColor === 'w' ? 'tactics.findWhite' : 'tactics.findBlack')}
                {feedback === 'correct' && t('tactics.correct')}
                {feedback === 'wrong' && t('tactics.wrong')}
                {feedback === 'solved' && t('tactics.solved')}
                {feedback === 'failed' && t('tactics.solutionShown')}
              </p>
              {ratingDelta !== null && (
                <p className="small" data-testid="rating-delta">
                  {t('tactics.ratingChange', {
                    delta: `${ratingDelta >= 0 ? '+' : ''}${ratingDelta}`,
                  })}
                </p>
              )}
              {finished && state && (
                <p className="small muted">
                  {t('tactics.puzzleInfo', { rating: state.puzzle.rating })} ·{' '}
                  {state.puzzle.themes
                    .map((th) => t(`themes.${th}`, { defaultValue: th }))
                    .join(', ')}
                </p>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                {!finished && (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !state}
                      onClick={() => state && setHint(puzzleHint(state))}
                    >
                      {t('tactics.hint')}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !state}
                      onClick={showSolution}
                    >
                      {t('tactics.showSolution')}
                    </button>
                  </>
                )}
                {finished && (
                  <button type="button" className="btn primary" onClick={next} disabled={busy}>
                    {t('tactics.next')}
                  </button>
                )}
              </div>
              {finished && state && !state.puzzle.id.startsWith('mine-') && (
                <p className="small muted" style={{ marginTop: 12 }}>
                  {t('tactics.source')}{' '}
                  <a
                    href={`https://lichess.org/training/${state.puzzle.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    lichess.org/training/{state.puzzle.id}
                  </a>
                </p>
              )}
            </section>
            <section className="card small muted">
              <p>{t('tactics.adaptiveHelp')}</p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

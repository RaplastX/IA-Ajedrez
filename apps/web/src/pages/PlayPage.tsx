import { pickHumanMove, scoreToCp, strengthForElo, uciToMoveObject } from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Board, type BoardMove } from '../components/Board/Board';
import { success } from '../lib/feedback';
import { MoveList } from '../components/common';
import { track } from '../lib/analytics';
import { api } from '../lib/api';
import { downloadText } from '../lib/download';
import { engineSupported, getEngine } from '../lib/engine';
import { uid } from '../lib/storage';
import { useProgress, type GameRecord } from '../store/progress';
import { useSettings } from '../store/settings';

interface GameState {
  id: string;
  chess: Chess;
  playerColor: 'w' | 'b';
  elo: number;
}

type Result = { score: GameRecord['result']; reason: string };

export default function PlayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const recordGame = useProgress((s) => s.recordGame);
  const token = useSettings((s) => s.token);
  const [elo, setElo] = useState(1200);
  const [colorChoice, setColorChoice] = useState<'w' | 'b' | 'random'>('w');
  const [game, setGame] = useState<GameState | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const turnStartedAt = useRef(0);
  const [thinkTimes, setThinkTimes] = useState<number[]>([]);
  const cancelled = useRef(false);

  useEffect(() => () => void (cancelled.current = true), []);

  if (!engineSupported()) return <p>{t('engine.unsupported')}</p>;

  function finish(state: GameState, outcome: Result) {
    setResult(outcome);
    const won =
      (outcome.score === '1-0' && state.playerColor === 'w') ||
      (outcome.score === '0-1' && state.playerColor === 'b');
    if (won) success();
    const chess = state.chess;
    chess.setHeader('Event', t('play.pgnEvent'));
    chess.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
    chess.setHeader('White', state.playerColor === 'w' ? t('play.you') : `Stockfish ${state.elo}`);
    chess.setHeader('Black', state.playerColor === 'b' ? t('play.you') : `Stockfish ${state.elo}`);
    chess.setHeader('Result', outcome.score);
    const record: GameRecord = {
      id: state.id,
      date: new Date().toISOString(),
      mode: 'ai',
      pgn: chess.pgn(),
      result: outcome.score,
      playerColor: state.playerColor,
      opponent: `Stockfish ${state.elo}`,
      opponentElo: state.elo,
    };
    recordGame(record);
    track('game_finished', { mode: 'ai', elo: state.elo, result: outcome.score });
    if (token) {
      api
        .uploadGame({
          pgn: record.pgn,
          result: record.result,
          mode: 'ai',
          opponent: record.opponent,
        })
        .catch(() => undefined);
    }
  }

  function checkEnd(state: GameState): boolean {
    const chess = state.chess;
    if (!chess.isGameOver()) return false;
    if (chess.isCheckmate())
      finish(state, { score: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' });
    else if (chess.isStalemate()) finish(state, { score: '1/2-1/2', reason: 'stalemate' });
    else if (chess.isThreefoldRepetition())
      finish(state, { score: '1/2-1/2', reason: 'repetition' });
    else if (chess.isInsufficientMaterial())
      finish(state, { score: '1/2-1/2', reason: 'material' });
    else finish(state, { score: '1/2-1/2', reason: 'fiftyMoves' });
    return true;
  }

  async function engineMove(state: GameState) {
    setThinking(true);
    const engine = getEngine();
    const strength = strengthForElo(state.elo);
    const startedAt = Date.now();
    try {
      await engine.configure(strength.uciOptions);
      const search = await engine.search(state.chess.fen(), {
        ...strength.go,
        multipv: strength.multipv,
      });
      let uci = search.bestmove;
      if (strength.temperatureCp > 0 && search.lines.length > 1) {
        const candidates = search.lines
          .filter((l) => l.pv[0] && l.score)
          .map((l) => ({ uci: l.pv[0]!, cp: scoreToCp(l.score!) }));
        uci = pickHumanMove(candidates, strength.temperatureCp)?.uci ?? uci;
      }
      // Pequeña pausa para que la respuesta no sea instantánea (más natural).
      const elapsed = Date.now() - startedAt;
      if (elapsed < 350) await new Promise((r) => setTimeout(r, 350 - elapsed));
      if (cancelled.current || !uci) return;
      const move = uciToMoveObject(uci);
      if (move) state.chess.move(move);
      rerender();
      turnStartedAt.current = Date.now();
      checkEnd(state);
    } finally {
      setThinking(false);
    }
  }

  async function start() {
    const playerColor = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    const state: GameState = { id: uid(), chess: new Chess(), playerColor, elo };
    setThinkTimes([]);
    setResult(null);
    setGame(state);
    track('game_started', { mode: 'ai', elo });
    await getEngine().newGame();
    turnStartedAt.current = Date.now();
    if (playerColor === 'b') void engineMove(state);
  }

  function onMove(move: BoardMove) {
    if (!game || result || thinking) return;
    try {
      game.chess.move(move);
    } catch {
      return;
    }
    const elapsed = Date.now() - turnStartedAt.current;
    setThinkTimes((times) => [...times, elapsed]);
    rerender();
    if (!checkEnd(game)) void engineMove(game);
  }

  function takeback() {
    if (!game || thinking || result) return;
    const history = game.chess.history();
    if (history.length === 0) return;
    game.chess.undo();
    if (game.chess.turn() !== game.playerColor) game.chess.undo();
    setThinkTimes((times) => times.slice(0, -1));
    rerender();
  }

  function resign() {
    if (!game || result) return;
    finish(game, { score: game.playerColor === 'w' ? '0-1' : '1-0', reason: 'resign' });
  }

  const history = game?.chess.history({ verbose: true }) ?? [];
  const last = history[history.length - 1];
  const avgThink = thinkTimes.length
    ? thinkTimes.reduce((a, b) => a + b, 0) / thinkTimes.length / 1000
    : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('play.title')}</h1>
          <p>{t('play.subtitle')}</p>
        </div>
      </div>
      <div className="train-layout">
        <Board
          fen={game?.chess.fen() ?? new Chess().fen()}
          orientation={game?.playerColor ?? (colorChoice === 'b' ? 'b' : 'w')}
          movable={game && !result && !thinking ? game.playerColor : 'none'}
          onMove={onMove}
          lastMove={last ? [last.from, last.to] : null}
        />
        <div className="panel">
          {!game || result ? (
            <section className="card">
              <h2>{t('play.newGame')}</h2>
              <label className="field">
                <span>
                  {t('play.strength')}: <strong data-testid="elo-value">{elo}</strong> Elo
                </span>
                <input
                  type="range"
                  min={400}
                  max={3000}
                  step={50}
                  value={elo}
                  onChange={(e) => setElo(Number(e.target.value))}
                  aria-label={t('play.strength')}
                />
              </label>
              <p className="small muted">
                {t(elo < 1320 ? 'play.humanizedHelp' : 'play.uciEloHelp')}
              </p>
              <div
                className="row"
                role="radiogroup"
                aria-label={t('play.color')}
                style={{ margin: '8px 0 12px' }}
              >
                {(['w', 'b', 'random'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="chip"
                    aria-pressed={colorChoice === c}
                    onClick={() => setColorChoice(c)}
                  >
                    {t(`play.colors.${c}`)}
                  </button>
                ))}
              </div>
              <button type="button" className="btn primary" onClick={() => void start()}>
                {t('play.start')}
              </button>
            </section>
          ) : null}

          {game && (
            <section className="card">
              <div className="spread">
                <h2 style={{ margin: 0 }}>{t('play.vs', { elo: game.elo })}</h2>
                <span className="chip">{t(`play.colors.${game.playerColor}`)}</span>
              </div>
              <p
                className="status"
                aria-live="polite"
                data-testid="play-status"
                style={{ marginTop: 12 }}
              >
                {result
                  ? t(`play.result.${result.reason}`, { score: result.score })
                  : thinking
                    ? t('play.thinking')
                    : game.chess.turn() === game.playerColor
                      ? t('play.yourTurn')
                      : t('play.waiting')}
              </p>
              <MoveList moves={history.map((m) => ({ san: m.san }))} current={history.length} />
              {avgThink !== null && (
                <p className="small muted">
                  {t('play.avgThink', { seconds: avgThink.toFixed(1) })}
                </p>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                {!result && (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={takeback}
                      disabled={thinking || history.length === 0}
                    >
                      {t('play.takeback')}
                    </button>
                    <button type="button" className="btn danger" onClick={resign}>
                      {t('play.resign')}
                    </button>
                  </>
                )}
                {result && (
                  <>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() =>
                        navigate('/analysis', {
                          state: {
                            pgn: game.chess.pgn(),
                            playerColor: game.playerColor,
                            gameId: game.id,
                          },
                        })
                      }
                    >
                      {t('play.analyze')}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        downloadText(`partida-${game.id.slice(0, 8)}.pgn`, game.chess.pgn())
                      }
                    >
                      {t('common.downloadPgn')}
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

import { scoreToCp, uciToMoveObject } from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board, type BoardMove } from '../components/Board/Board';
import { MoveList } from '../components/common';
import { ENDGAMES, type EndgameDrill } from '../data/endgames';
import { engineSupported, FULL_STRENGTH, getEngine } from '../lib/engine';
import { outcome, probeTablebase } from '../lib/tablebase';
import { useProgress } from '../store/progress';

/** Movimientos del usuario que hay que aguantar para dar por buena una defensa. */
const DRAW_SURVIVAL_MOVES = 12;

type Status = 'playing' | 'thinking' | 'success' | 'failed';

interface Verdict {
  ok: boolean;
  reply: string | null;
  source: 'tablebase' | 'engine' | 'none';
}

/** Juzga la posición tras la jugada del usuario (le toca al rival) y elige la respuesta. */
async function judge(fen: string, goal: EndgameDrill['goal']): Promise<Verdict> {
  const tb = await probeTablebase(fen);
  if (tb) {
    const forOpponent = outcome(tb.category);
    const ok = goal === 'win' ? forOpponent === 'loss' : forOpponent !== 'win';
    return { ok, reply: tb.moves[0]?.uci ?? null, source: 'tablebase' };
  }
  if (!engineSupported()) return { ok: true, reply: null, source: 'none' };
  // Sin conexión: Stockfish con un margen prudente.
  const engine = getEngine();
  await engine.configure(FULL_STRENGTH);
  const r = await engine.search(fen, { depth: 14 });
  const cp = r.lines[0]?.score ? scoreToCp(r.lines[0].score) : 0;
  const ok = goal === 'win' ? cp <= -250 : cp < 300;
  return { ok, reply: r.bestmove, source: 'engine' };
}

export default function EndgamesPage() {
  const { t, i18n } = useTranslation();
  const completed = useProgress((s) => s.completedEndgames);
  const recordEndgame = useProgress((s) => s.recordEndgame);
  const [drill, setDrill] = useState<EndgameDrill | null>(null);
  const [fen, setFen] = useState('');
  const [sans, setSans] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [status, setStatus] = useState<Status>('playing');
  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<Verdict['source']>('none');
  const userMoves = useRef(0);
  const locale = i18n.language === 'en' ? 'en' : 'es';

  function start(d: EndgameDrill) {
    setDrill(d);
    setFen(d.fen);
    setSans([]);
    setLastMove(null);
    setStatus('playing');
    setMessage(null);
    userMoves.current = 0;
  }

  function succeed() {
    setStatus('success');
    if (drill) recordEndgame(drill.id);
  }

  function terminal(chess: Chess, goal: EndgameDrill['goal'], userColor: 'w' | 'b'): boolean {
    if (chess.isCheckmate()) {
      const userWon = chess.turn() !== userColor;
      if (userWon && goal === 'win') succeed();
      else {
        setStatus('failed');
        setMessage(t('endgames.mated'));
      }
      return true;
    }
    if (chess.isDraw()) {
      if (goal === 'draw') succeed();
      else {
        setStatus('failed');
        setMessage(t(chess.isStalemate() ? 'endgames.stalemate' : 'endgames.drawn'));
      }
      return true;
    }
    return false;
  }

  async function onMove(move: BoardMove) {
    if (!drill || status !== 'playing') return;
    const userColor = new Chess(drill.fen).turn();
    const chess = new Chess(fen);
    let played;
    try {
      played = chess.move(move);
    } catch {
      return;
    }
    userMoves.current += 1;
    setFen(chess.fen());
    setSans((s) => [...s, played.san]);
    setLastMove([played.from, played.to]);
    if (terminal(chess, drill.goal, userColor)) return;

    setStatus('thinking');
    const verdict = await judge(chess.fen(), drill.goal);
    setSource(verdict.source);
    if (!verdict.ok) {
      setStatus('failed');
      setMessage(t(drill.goal === 'win' ? 'endgames.lostWin' : 'endgames.lostDraw', { san: played.san }));
      return;
    }
    if (drill.goal === 'draw' && userMoves.current >= DRAW_SURVIVAL_MOVES) {
      succeed();
      return;
    }
    const reply = verdict.reply ? uciToMoveObject(verdict.reply) : null;
    if (!reply) {
      setStatus('playing');
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
    const answered = chess.move(reply);
    setFen(chess.fen());
    setSans((s) => [...s, answered.san]);
    setLastMove([answered.from, answered.to]);
    if (!terminal(chess, drill.goal, userColor)) setStatus('playing');
  }

  if (!drill) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>{t('endgames.title')}</h1>
            <p>{t('endgames.subtitle')}</p>
          </div>
        </div>
        <div className="grid cols-2">
          {ENDGAMES.map((d) => (
            <button key={d.id} type="button" className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => start(d)}>
              <div className="spread">
                <strong>
                  {completed.includes(d.id) ? '✅ ' : ''}
                  {d.title[locale]}
                </strong>
                <span className="chip">{'★'.repeat(d.level)}</span>
              </div>
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                {t(d.goal === 'win' ? 'endgames.goalWin' : 'endgames.goalDraw')}
              </p>
            </button>
          ))}
        </div>
      </>
    );
  }

  const userColor = new Chess(drill.fen).turn();
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{drill.title[locale]}</h1>
          <p>{t(drill.goal === 'win' ? 'endgames.goalWin' : 'endgames.goalDraw')}</p>
        </div>
        <button type="button" className="btn" onClick={() => setDrill(null)}>
          ← {t('endgames.back')}
        </button>
      </div>
      <div className="train-layout">
        <Board fen={fen} orientation={userColor} movable={status === 'playing' ? userColor : 'none'} onMove={(m) => void onMove(m)} lastMove={lastMove} />
        <div className="panel">
          <section className="card">
            <p className={`status ${status === 'success' ? 'good' : status === 'failed' ? 'bad' : ''}`} aria-live="polite" data-testid="endgame-status">
              {status === 'playing' && t('endgames.yourMove')}
              {status === 'thinking' && t('endgames.checking')}
              {status === 'success' && t(drill.goal === 'win' ? 'endgames.won' : 'endgames.held')}
              {status === 'failed' && message}
            </p>
            <details style={{ marginTop: 8 }}>
              <summary className="small" style={{ cursor: 'pointer' }}>{t('endgames.hint')}</summary>
              <p className="small muted">{drill.hint[locale]}</p>
            </details>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => start(drill)}>
                {t('endgames.retry')}
              </button>
            </div>
            {source !== 'none' && (
              <p className="small muted" style={{ marginTop: 8 }}>
                {t(source === 'tablebase' ? 'endgames.sourceTablebase' : 'endgames.sourceEngine')}
              </p>
            )}
          </section>
          <section className="card">
            <MoveList moves={sans.map((san) => ({ san }))} current={sans.length} startPly={userColor === 'b' ? 1 : 0} />
          </section>
        </div>
      </div>
    </>
  );
}

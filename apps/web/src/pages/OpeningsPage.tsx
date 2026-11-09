import { drillSteps, isDue, qualityFromAnswer, type RepertoireLine } from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board, type BoardMove } from '../components/Board/Board';
import { MoveList } from '../components/common';
import { REPERTOIRE } from '../data/repertoire';
import { useProgress } from '../store/progress';

function positionAfter(line: RepertoireLine, plies: number) {
  const chess = new Chess();
  let last: [string, string] | null = null;
  for (const san of line.moves.slice(0, plies)) {
    const m = chess.move(san);
    last = [m.from, m.to];
  }
  return { fen: chess.fen(), last };
}

export default function OpeningsPage() {
  const { t, i18n } = useTranslation();
  const srsCards = useProgress((s) => s.srsCards);
  const recordReview = useProgress((s) => s.recordOpeningReview);
  const [lineId, setLineId] = useState<string | null>(null);
  const [mode, setMode] = useState<'learn' | 'drill'>('learn');
  const [ply, setPly] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'good' | 'bad' | 'done'>('idle');
  const [arrow, setArrow] = useState<{ from: string; to: string } | null>(null);
  const askedAt = useRef(Date.now());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const line = REPERTOIRE.find((l) => l.id === lineId) ?? null;
  const steps = useMemo(() => (line ? drillSteps(line) : []), [line]);
  const locale = i18n.language === 'en' ? 'en' : 'es';

  const dueCount = (l: RepertoireLine) =>
    drillSteps(l).filter((s) => !srsCards[s.cardId] || isDue(srsCards[s.cardId]!)).length;
  const learned = (l: RepertoireLine) => drillSteps(l).filter((s) => (srsCards[s.cardId]?.repetitions ?? 0) >= 2).length;

  /** Avanza las jugadas del rival automáticamente hasta que le toque al usuario. */
  function advanceOpponent(fromPly: number) {
    if (!line) return;
    let p = fromPly;
    const turnOf = (n: number) => (n % 2 === 0 ? 'w' : 'b');
    if (p < line.moves.length && turnOf(p) !== line.color) p += 1;
    setPly(p);
    askedAt.current = Date.now();
    if (p >= line.moves.length) setFeedback('done');
  }

  function startDrill() {
    setMode('drill');
    setFeedback('idle');
    setArrow(null);
    advanceOpponent(0);
  }

  function onDrillMove(move: BoardMove) {
    if (!line || feedback === 'done') return;
    const { fen } = positionAfter(line, ply);
    const chess = new Chess(fen);
    let san: string;
    try {
      san = chess.move(move).san;
    } catch {
      return;
    }
    const expected = line.moves[ply]!;
    const step = steps.find((s) => s.ply === ply);
    const correct = san === expected;
    if (step) recordReview(step.cardId, qualityFromAnswer(correct, Date.now() - askedAt.current));
    if (correct) {
      setFeedback('good');
      setArrow(null);
      advanceOpponent(ply + 1);
      return;
    }
    // Muestra la jugada correcta y continúa.
    const right = new Chess(fen).move(expected);
    setFeedback('bad');
    setArrow({ from: right.from, to: right.to });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setArrow(null);
      advanceOpponent(ply + 1);
    }, 1400);
  }

  if (!line) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>{t('openings.title')}</h1>
            <p>{t('openings.subtitle')}</p>
          </div>
        </div>
        {(['w', 'b'] as const).map((color) => (
          <section key={color} style={{ marginBottom: 16 }}>
            <h2>{t(color === 'w' ? 'openings.asWhite' : 'openings.asBlack')}</h2>
            <div className="grid cols-2">
              {REPERTOIRE.filter((l) => l.color === color).map((l) => (
                <button
                  type="button"
                  key={l.id}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => {
                    setLineId(l.id);
                    setMode('learn');
                    setPly(0);
                    setFeedback('idle');
                  }}
                >
                  <div className="spread">
                    <strong>{l.name}</strong>
                    <span className="chip">{l.eco}</span>
                  </div>
                  <p className="small muted" style={{ margin: '6px 0' }}>{l.ideas?.[locale]}</p>
                  <span className="small">
                    {t('openings.learned', { learned: learned(l), total: drillSteps(l).length })} ·{' '}
                    {t('openings.due', { count: dueCount(l) })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </>
    );
  }

  const { fen, last } = positionAfter(line, ply);
  const sans = line.moves.slice(0, ply).map((san) => ({ san }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>
            {line.name} <span className="chip">{line.eco}</span>
          </h1>
          <p>{line.ideas?.[locale]}</p>
        </div>
        <button type="button" className="btn" onClick={() => setLineId(null)}>
          ← {t('openings.back')}
        </button>
      </div>
      <div className="train-layout">
        <Board
          fen={fen}
          orientation={line.color}
          movable={mode === 'drill' && feedback !== 'done' && !arrow ? line.color : 'none'}
          onMove={onDrillMove}
          lastMove={last}
          arrows={arrow ? [{ ...arrow, color: 'hint' }] : []}
        />
        <div className="panel">
          <section className="card">
            <div className="row" role="tablist">
              <button type="button" className="chip" aria-pressed={mode === 'learn'} onClick={() => { setMode('learn'); setPly(0); setFeedback('idle'); }}>
                {t('openings.learn')}
              </button>
              <button type="button" className="chip" aria-pressed={mode === 'drill'} onClick={startDrill}>
                {t('openings.drill')}
              </button>
            </div>
            {mode === 'learn' ? (
              <>
                <p className="small muted" style={{ marginTop: 12 }}>{t('openings.learnHelp')}</p>
                <div className="row">
                  <button type="button" className="btn small" onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
                  <button type="button" className="btn small" onClick={() => setPly((p) => Math.min(line.moves.length, p + 1))}>▶</button>
                  <span className="small muted">
                    {ply}/{line.moves.length}
                  </span>
                </div>
              </>
            ) : (
              <p className={`status ${feedback === 'good' || feedback === 'done' ? 'good' : feedback === 'bad' ? 'bad' : ''}`} style={{ marginTop: 12 }} aria-live="polite" data-testid="drill-status">
                {feedback === 'idle' && t('openings.yourMove')}
                {feedback === 'good' && t('openings.good')}
                {feedback === 'bad' && t('openings.bad', { san: line.moves[ply] })}
                {feedback === 'done' && t('openings.done')}
              </p>
            )}
            {mode === 'drill' && feedback === 'done' && (
              <button type="button" className="btn primary" onClick={startDrill} style={{ marginTop: 8 }}>
                {t('openings.again')}
              </button>
            )}
          </section>
          <section className="card">
            <MoveList moves={sans} current={ply} onSelect={mode === 'learn' ? setPly : undefined} />
          </section>
        </div>
      </div>
    </>
  );
}

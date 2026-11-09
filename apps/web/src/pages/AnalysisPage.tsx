import {
  buildGameReport,
  buildOpeningIndex,
  buildPgn,
  detectOpening,
  explainMove,
  formatScore,
  parsePgn,
  positionKey,
  renderFacts,
  uciLineToSan,
  MOVE_CLASSES,
  PgnError,
  type GameReport,
  type OpeningEntry,
  type OpeningIndex,
  type ParsedGame,
  type PositionEval,
} from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Board } from '../components/Board/Board';
import { EvalBar, MoveList } from '../components/common';
import { LineChart } from '../components/LineChart';
import { api, ApiError } from '../lib/api';
import { downloadText } from '../lib/download';
import { engineSupported, FULL_STRENGTH, getEngine } from '../lib/engine';
import { puzzlesFromMistakes } from '../lib/mistakes';
import { uid } from '../lib/storage';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

let openingIndexPromise: Promise<OpeningIndex> | null = null;
const loadOpenings = () =>
  (openingIndexPromise ??= import('../data/openings.json').then((m) =>
    buildOpeningIndex(m.default as OpeningEntry[]),
  ));

const SAMPLE_PGN = `[Event "Ejemplo"]
[White "Blancas"]
[Black "Negras"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1`;

interface LocationState {
  pgn?: string;
  playerColor?: 'w' | 'b';
  gameId?: string;
}

export default function AnalysisPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const incoming = (location.state ?? {}) as LocationState;
  const token = useSettings((s) => s.token);
  const rating = useProgress((s) => s.stats.puzzleRating);
  const recordAnalysis = useProgress((s) => s.recordAnalysis);
  const addPersonalPuzzles = useProgress((s) => s.addPersonalPuzzles);
  const pushToast = useProgress((s) => s.pushToast);

  const [pgnText, setPgnText] = useState(incoming.pgn ?? '');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>(incoming.playerColor ?? 'w');
  const [depth, setDepth] = useState(12);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [report, setReport] = useState<GameReport | null>(null);
  const [evals, setEvals] = useState<PositionEval[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function analyze(text = pgnText) {
    setError(null);
    setReport(null);
    setAiAnswer(null);
    let parsed: ParsedGame;
    try {
      parsed = parsePgn(text);
    } catch (e) {
      setError(e instanceof PgnError ? t(`analysis.errors.${e.code}`) : String(e));
      return;
    }
    if (parsed.moves.length === 0) {
      setError(t('analysis.errors.empty'));
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGame(parsed);
    setPly(0);

    const fens = [parsed.startFen, ...parsed.moves.map((m) => m.fenAfter)];
    const index = await loadOpenings();
    // Jugadas de libro: prefijo continuo de posiciones conocidas.
    let inBook = true;
    const moves = parsed.moves.map((m, i) => {
      inBook = inBook && i < 24 && index.has(positionKey(m.fenAfter));
      return { ...m, isBook: inBook };
    });
    setOpening(detectOpening(fens.slice(1), index)?.entry.name ?? null);

    const engine = getEngine();
    await engine.configure(FULL_STRENGTH);
    await engine.newGame();
    const results: PositionEval[] = [];
    setProgress({ done: 0, total: fens.length });
    for (const [i, fen] of fens.entries()) {
      if (controller.signal.aborted) return;
      const chess = new Chess(fen);
      if (chess.isCheckmate()) {
        results.push({ score: { type: 'mate', value: chess.turn() === 'w' ? -1 : 1 } });
      } else if (chess.isDraw()) {
        results.push({ score: { type: 'cp', value: 0 } });
      } else {
        const r = await engine.search(fen, { depth, signal: controller.signal });
        results.push({
          score: r.scoreWhite ?? { type: 'cp', value: 0 },
          bestUci: r.bestmove ?? undefined,
          pv: r.lines[0]?.pv,
          depth: r.depth,
        });
      }
      setProgress({ done: i + 1, total: fens.length });
    }
    if (controller.signal.aborted) return;
    const built = buildGameReport(moves, results);
    setEvals(results);
    setReport(built);
    setProgress(null);
    const own = built.summary[playerColor];
    const gameId = incoming.gameId ?? uid();
    recordAnalysis(own.accuracy, own.errorsByPhase, incoming.gameId);
    const created = addPersonalPuzzles(puzzlesFromMistakes(built, playerColor, gameId, rating));
    if (created > 0) pushToast({ kind: 'info', text: 'analysis.puzzlesCreated', params: { count: created } });
  }

  // Si venimos de una partida contra la IA, se analiza automáticamente.
  useEffect(() => {
    if (incoming.pgn && !autoStarted.current && engineSupported()) {
      autoStarted.current = true;
      void analyze(incoming.pgn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!report) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(report.moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [report]);

  const locale = i18n.language === 'en' ? 'en' : 'es';
  const selected = report && ply > 0 ? report.moves[ply - 1]! : null;
  const facts = useMemo(() => {
    if (!selected) return [];
    return explainMove({
      fenBefore: selected.fenBefore,
      playedUci: selected.uci,
      classification: selected.classification,
      evalBefore: selected.evalBefore,
      evalAfter: selected.evalAfter,
      bestUci: selected.bestUci,
      bestPv: selected.bestPv,
      replyPv: evals[ply]?.pv,
    });
  }, [selected, evals, ply]);

  if (!engineSupported()) return <p>{t('engine.unsupported')}</p>;

  const fen = game ? (ply === 0 ? game.startFen : game.moves[ply - 1]!.fenAfter) : new Chess().fen();
  const isError = selected && ['inaccuracy', 'mistake', 'blunder'].includes(selected.classification);
  const arrows =
    selected && isError && selected.bestUci
      ? [{ from: selected.bestUci.slice(0, 2), to: selected.bestUci.slice(2, 4), color: 'best' as const }]
      : [];

  async function askTutor() {
    if (!selected) return;
    setAiBusy(true);
    setAiAnswer(null);
    try {
      const res = await api.tutor({
        fen: selected.fenBefore,
        playedUci: selected.uci,
        facts,
        bestLine: uciLineToSan(selected.fenBefore, (selected.bestPv ?? []).slice(0, 6)),
        locale,
        question: question.trim() || undefined,
      });
      setAiAnswer(res.text);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown';
      setAiAnswer(t(`tutor.errors.${code === 'premium_required' || code === 'network' ? code : 'generic'}`));
    } finally {
      setAiBusy(false);
    }
  }

  function exportAnnotated() {
    if (!game || !report) return;
    const comments: Record<number, string> = {};
    report.moves.forEach((m) => {
      const parts = [t(`classes.${m.classification}`), formatScore(m.evalAfter)];
      if (m.bestUci && m.bestUci !== m.uci && ['inaccuracy', 'mistake', 'blunder'].includes(m.classification)) {
        parts.push(`${t('analysis.best')}: ${uciLineToSan(m.fenBefore, [m.bestUci])[0]}`);
      }
      comments[m.ply] = parts.join(' · ');
    });
    const pgn = buildPgn(
      game.moves.map((m) => m.uci),
      { headers: { ...game.headers, Annotator: 'IA Ajedrez + Stockfish' }, comments, startFen: game.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w') ? undefined : game.startFen },
    );
    downloadText('analisis.pgn', pgn);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('analysis.title')}</h1>
          <p>{t('analysis.subtitle')}</p>
        </div>
      </div>

      <div className="train-layout">
        <div className="panel">
          <div className="board-with-bar">
            <EvalBar score={evals[ply]?.score} orientation={playerColor} />
            <Board fen={fen} orientation={playerColor} lastMove={selected ? [selected.uci.slice(0, 2), selected.uci.slice(2, 4)] : null} arrows={arrows} />
          </div>
          {report && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn small" onClick={() => setPly(0)} aria-label={t('analysis.first')}>⏮</button>
              <button type="button" className="btn small" onClick={() => setPly((p) => Math.max(0, p - 1))} aria-label={t('analysis.prev')}>◀</button>
              <button type="button" className="btn small" onClick={() => setPly((p) => Math.min(report.moves.length, p + 1))} aria-label={t('analysis.next')}>▶</button>
              <button type="button" className="btn small" onClick={() => setPly(report.moves.length)} aria-label={t('analysis.last')}>⏭</button>
            </div>
          )}
          {report && (
            <section className="card">
              <LineChart
                title={t('analysis.evalGraph')}
                valueHeader={t('analysis.evaluation')}
                points={report.whiteWinPercents.map((y, i) => ({
                  x: i,
                  y,
                  label: i === 0 ? t('analysis.start') : `${Math.ceil(i / 2)}${i % 2 === 1 ? '.' : '…'} ${report.moves[i - 1]!.san}`,
                  display: formatScore(evals[i]!.score),
                }))}
                yDomain={[0, 100]}
                baseline={50}
                current={ply}
                onSelect={setPly}
                formatTick={(v) => `${v}%`}
              />
            </section>
          )}
        </div>

        <div className="panel">
          {!report && (
            <section className="card">
              <label className="field">
                <span>{t('analysis.pgnLabel')}</span>
                <textarea
                  rows={8}
                  value={pgnText}
                  onChange={(e) => setPgnText(e.target.value)}
                  placeholder={t('analysis.pgnPlaceholder')}
                  data-testid="pgn-input"
                />
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>{t('analysis.depth')}</span>
                  <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
                    <option value={8}>{t('analysis.depths.fast')}</option>
                    <option value={12}>{t('analysis.depths.normal')}</option>
                    <option value={16}>{t('analysis.depths.deep')}</option>
                  </select>
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>{t('analysis.iPlayed')}</span>
                  <select value={playerColor} onChange={(e) => setPlayerColor(e.target.value as 'w' | 'b')}>
                    <option value="w">{t('play.colors.w')}</option>
                    <option value="b">{t('play.colors.b')}</option>
                  </select>
                </label>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="btn primary" onClick={() => void analyze()} disabled={!!progress}>
                  {t('analysis.run')}
                </button>
                <button type="button" className="btn" onClick={() => setPgnText(SAMPLE_PGN)}>
                  {t('analysis.loadSample')}
                </button>
                <label className="btn">
                  {t('analysis.upload')}
                  <input
                    type="file"
                    accept=".pgn,text/plain"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void file.text().then(setPgnText);
                    }}
                  />
                </label>
              </div>
              {progress && (
                <div style={{ marginTop: 12 }} aria-live="polite">
                  <p className="small">{t('analysis.progress', progress)}</p>
                  <div className="progress">
                    <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                </div>
              )}
              {error && <p className="status bad" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            </section>
          )}

          {report && game && (
            <>
              <section className="card" data-testid="analysis-summary">
                <div className="spread">
                  <h2 style={{ margin: 0 }}>{t('analysis.summary')}</h2>
                  <button type="button" className="btn small" onClick={() => { setReport(null); setGame(null); setEvals([]); }}>
                    {t('analysis.newAnalysis')}
                  </button>
                </div>
                {opening && <p className="small muted">📖 {opening}</p>}
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th className="num">{t('play.colors.w')}</th>
                      <th className="num">{t('play.colors.b')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>{t('analysis.accuracy')}</strong></td>
                      <td className="num"><strong>{report.summary.w.accuracy?.toFixed(1) ?? '–'}%</strong></td>
                      <td className="num"><strong>{report.summary.b.accuracy?.toFixed(1) ?? '–'}%</strong></td>
                    </tr>
                    <tr>
                      <td>{t('analysis.acpl')}</td>
                      <td className="num">{Math.round(report.summary.w.acpl)}</td>
                      <td className="num">{Math.round(report.summary.b.acpl)}</td>
                    </tr>
                    {MOVE_CLASSES.map((c) => (
                      <tr key={c}>
                        <td>{t(`classes.${c}`)}</td>
                        <td className="num">{report.summary.w.counts[c]}</td>
                        <td className="num">{report.summary.b.counts[c]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="row" style={{ marginTop: 12 }}>
                  <Link className="btn small" to="/tactics?mode=mine">{t('analysis.practiceMistakes')}</Link>
                  <button type="button" className="btn small" onClick={exportAnnotated}>{t('analysis.exportAnnotated')}</button>
                </div>
              </section>

              <section className="card">
                <MoveList
                  moves={report.moves.map((m) => ({ san: m.san, classification: m.classification }))}
                  current={ply}
                  onSelect={setPly}
                  startPly={game.startFen.split(' ')[1] === 'b' ? 1 : 0}
                />
              </section>

              <section className="card" aria-live="polite" data-testid="tutor-panel">
                <h2>{t('tutor.title')}</h2>
                {selected ? (
                  <>
                    <p>
                      <strong>
                        {Math.ceil(selected.ply / 2)}
                        {selected.color === 'w' ? '.' : '…'} {selected.san}
                      </strong>{' '}
                      — <span className={`cls cls-${selected.classification}`}>{t(`classes.${selected.classification}`)}</span>{' '}
                      <span className="muted small">({formatScore(selected.evalAfter)})</span>
                    </p>
                    <p>{renderFacts(facts, locale)}</p>
                    <label className="field" style={{ marginTop: 8 }}>
                      <span>{t('tutor.askLabel')}</span>
                      <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('tutor.askPlaceholder')} />
                    </label>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button type="button" className="btn small" onClick={() => void askTutor()} disabled={aiBusy || !token}>
                        {aiBusy ? t('common.loading') : t('tutor.ask')}
                      </button>
                      {!token && <span className="small muted">{t('tutor.loginRequired')}</span>}
                    </div>
                    {aiAnswer && <p className="status" style={{ marginTop: 8 }}>{aiAnswer}</p>}
                  </>
                ) : (
                  <p className="muted">{t('tutor.selectMove')}</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

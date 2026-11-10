import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Board, type BoardMove } from '../components/Board/Board';
import { failure, success } from '../lib/feedback';
import { LESSONS, type Lesson } from '../data/lessons';
import { useProgress } from '../store/progress';

const strip = (san: string) => san.replace(/[+#]/g, '');

export default function LessonsPage() {
  const { t, i18n } = useTranslation();
  const completed = useProgress((s) => s.completedLessons);
  const recordLesson = useProgress((s) => s.recordLesson);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [fen, setFen] = useState('');
  const [result, setResult] = useState<'idle' | 'good' | 'bad'>('idle');
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [showMe, setShowMe] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);
  const locale = i18n.language === 'en' ? 'en' : 'es';

  function open(l: Lesson, index = 0) {
    setLesson(l);
    setStepIndex(index);
    setFen(l.steps[index]!.fen);
    setResult('idle');
    setLastMove(null);
    setShowMe(false);
    window.clearTimeout(resetTimer.current);
  }

  if (!lesson) {
    const basics = LESSONS.filter((l) => l.topic === 'basics');
    const others = LESSONS.filter((l) => l.topic !== 'basics');
    const doneBasics = basics.filter((l) => completed.includes(l.id)).length;
    const nextBasic = basics.find((l) => !completed.includes(l.id));
    const card = (l: Lesson) => (
      <button
        key={l.id}
        type="button"
        className="card"
        style={{ textAlign: 'left', cursor: 'pointer' }}
        onClick={() => open(l)}
      >
        <div className="spread">
          <strong>
            {completed.includes(l.id) ? '✅ ' : ''}
            {l.title[locale]}
          </strong>
          <span className="chip">{t(`lessons.topics.${l.topic}`)}</span>
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          {t('lessons.steps', { count: l.steps.length })}
        </p>
      </button>
    );
    return (
      <>
        <div className="page-header">
          <div>
            <h1>{t('lessons.title')}</h1>
            <p>{t('lessons.subtitle')}</p>
          </div>
        </div>
        <section className="card" style={{ marginBottom: 16 }} data-testid="basics-course">
          <h2>{t('lessons.basicsTitle')}</h2>
          <p className="small muted">{t('lessons.basicsHelp')}</p>
          <div className="progress" style={{ margin: '8px 0' }}>
            <span style={{ width: `${(doneBasics / basics.length) * 100}%` }} />
          </div>
          <p className="small">
            {t('lessons.basicsProgress', { done: doneBasics, total: basics.length })}
          </p>
          {nextBasic && (
            <button type="button" className="btn primary" onClick={() => open(nextBasic)}>
              {doneBasics === 0 ? t('lessons.startCourse') : t('lessons.continueCourse')}
            </button>
          )}
        </section>
        <div className="grid cols-2">{basics.map(card)}</div>
        <h2 style={{ margin: '24px 0 12px' }}>{t('lessons.moreTitle')}</h2>
        <div className="grid cols-2">{others.map(card)}</div>
      </>
    );
  }

  const step = lesson.steps[stepIndex]!;
  const isTask = !!step.accept?.length;
  const isLast = stepIndex === lesson.steps.length - 1;
  const canContinue = !isTask || result === 'good';
  const turn = new Chess(step.fen).turn();

  // Jugada correcta para el botón "Muéstrame": primera aceptada que sea legal.
  const answer = isTask
    ? new Chess(step.fen).moves({ verbose: true }).find((m) => strip(m.san) === step.accept![0])
    : undefined;

  function onMove(move: BoardMove) {
    if (step.explore) {
      const chess = new Chess(step.fen);
      try {
        const m = chess.move(move);
        setLastMove([m.from, m.to]);
      } catch {
        return;
      }
      setFen(chess.fen());
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => {
        setFen(step.fen);
        setLastMove(null);
      }, 1400);
      return;
    }
    if (!isTask || result === 'good') return;
    const chess = new Chess(step.fen);
    let san: string;
    try {
      const m = chess.move(move);
      san = m.san;
      setLastMove([m.from, m.to]);
    } catch {
      return;
    }
    setFen(chess.fen());
    if (step.accept!.includes(strip(san))) {
      setResult('good');
      success(false);
    } else {
      setResult('bad');
      failure();
      window.setTimeout(() => {
        setFen(step.fen);
        setLastMove(null);
      }, 900);
    }
  }

  function advance() {
    if (!lesson) return;
    if (isLast) {
      recordLesson(lesson.id);
      success();
      setLesson(null);
      return;
    }
    open(lesson, stepIndex + 1);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{lesson.title[locale]}</h1>
          <p>{t('lessons.stepOf', { current: stepIndex + 1, total: lesson.steps.length })}</p>
        </div>
        <button type="button" className="btn" onClick={() => setLesson(null)}>
          ← {t('lessons.back')}
        </button>
      </div>
      <div className="train-layout">
        <Board
          fen={fen}
          orientation={turn}
          movable={(isTask && result !== 'good') || step.explore ? turn : 'none'}
          onMove={onMove}
          lastMove={lastMove}
          arrows={[
            ...(step.arrows ?? []).map((a) => ({ ...a, color: 'hint' as const })),
            ...(showMe && answer && result !== 'good'
              ? [{ from: answer.from, to: answer.to, color: 'best' as const }]
              : []),
          ]}
          highlights={Object.fromEntries((step.highlights ?? []).map((q) => [q, 'hint' as const]))}
        />
        <div className="panel">
          <section className="card">
            <p>{step.text[locale]}</p>
            {step.explore && <p className="status">{t('lessons.explore')}</p>}
            {isTask && (
              <p
                className={`status ${result === 'good' ? 'good' : result === 'bad' ? 'bad' : ''}`}
                aria-live="polite"
                data-testid="lesson-status"
              >
                {result === 'idle' && t('lessons.findMove')}
                {result === 'good' && (step.success?.[locale] ?? t('lessons.correct'))}
                {result === 'bad' && t('lessons.tryAgain')}
              </p>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              {stepIndex > 0 && (
                <button type="button" className="btn" onClick={() => open(lesson, stepIndex - 1)}>
                  ← {t('lessons.prev')}
                </button>
              )}
              {isTask && result !== 'good' && answer && (
                <button type="button" className="btn" onClick={() => setShowMe(true)}>
                  💡 {t('lessons.showMe')}
                </button>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={advance}
                disabled={!canContinue}
              >
                {isLast ? t('lessons.finish') : t('lessons.next')}
              </button>
              {isLast && lesson.practiceTheme && result === 'good' && (
                <Link className="btn" to={`/tactics?theme=${lesson.practiceTheme}`}>
                  {t('lessons.practice')}
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

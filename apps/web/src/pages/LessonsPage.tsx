import { Chess } from 'chess.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Board, type BoardMove } from '../components/Board/Board';
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
  const locale = i18n.language === 'en' ? 'en' : 'es';

  function open(l: Lesson, index = 0) {
    setLesson(l);
    setStepIndex(index);
    setFen(l.steps[index]!.fen);
    setResult('idle');
    setLastMove(null);
  }

  if (!lesson) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>{t('lessons.title')}</h1>
            <p>{t('lessons.subtitle')}</p>
          </div>
        </div>
        <div className="grid cols-2">
          {LESSONS.map((l) => (
            <button key={l.id} type="button" className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => open(l)}>
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
          ))}
        </div>
      </>
    );
  }

  const step = lesson.steps[stepIndex]!;
  const isTask = !!step.accept?.length;
  const isLast = stepIndex === lesson.steps.length - 1;
  const canContinue = !isTask || result === 'good';
  const turn = new Chess(step.fen).turn();

  function onMove(move: BoardMove) {
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
    } else {
      setResult('bad');
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
          movable={isTask && result !== 'good' ? turn : 'none'}
          onMove={onMove}
          lastMove={lastMove}
          arrows={step.arrows?.map((a) => ({ ...a, color: 'hint' as const }))}
        />
        <div className="panel">
          <section className="card">
            <p>{step.text[locale]}</p>
            {isTask && (
              <p className={`status ${result === 'good' ? 'good' : result === 'bad' ? 'bad' : ''}`} aria-live="polite" data-testid="lesson-status">
                {result === 'idle' && t('lessons.findMove')}
                {result === 'good' && (step.success?.[locale] ?? t('lessons.correct'))}
                {result === 'bad' && t('lessons.tryAgain')}
              </p>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn primary" onClick={advance} disabled={!canContinue}>
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

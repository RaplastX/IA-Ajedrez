/** Componentes pequeños compartidos: barra de evaluación, lista de jugadas, barras, toasts. */
import { formatScore, winPercent, type MoveClass, type Score } from '@ia-ajedrez/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

export function EvalBar({ score, orientation = 'w' }: { score?: Score; orientation?: 'w' | 'b' }) {
  const { t } = useTranslation();
  const white = score ? winPercent(score) : 50;
  return (
    <div
      className={`evalbar${orientation === 'b' ? ' flipped' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-label={t('analysis.evalBar', { value: score ? formatScore(score) : '0.00' })}
      title={score ? formatScore(score) : ''}
    >
      <span style={{ height: `${white}%` }} />
    </div>
  );
}

export interface MoveListItem {
  san: string;
  classification?: MoveClass;
}

const CLASS_SYMBOL: Partial<Record<MoveClass, string>> = {
  blunder: '??',
  mistake: '?',
  inaccuracy: '?!',
  best: '★',
  book: '📖',
};

export function MoveList({
  moves,
  current,
  onSelect,
  startPly = 0,
}: {
  moves: MoveListItem[];
  current: number;
  onSelect?: (ply: number) => void;
  /** Jugadas previas (si la partida empieza con negras, el primer ply es impar). */
  startPly?: number;
}) {
  const { t } = useTranslation();
  if (moves.length === 0) return <p className="muted small">{t('common.noMoves')}</p>;
  const cells = [];
  for (let i = 0; i < moves.length; i++) {
    const absolute = startPly + i;
    if (absolute % 2 === 0 || i === 0) {
      cells.push(
        <span className="num" key={`n${i}`}>
          {Math.floor(absolute / 2) + 1}.
        </span>,
      );
      if (absolute % 2 === 1) cells.push(<span key="pad">…</span>);
    }
    const m = moves[i]!;
    const symbol = m.classification ? CLASS_SYMBOL[m.classification] : undefined;
    cells.push(
      <button
        type="button"
        key={i}
        className={current === i + 1 ? 'current' : ''}
        onClick={() => onSelect?.(i + 1)}
        aria-label={`${m.san}${m.classification ? `, ${t(`classes.${m.classification}`)}` : ''}`}
      >
        <span>{m.san}</span>
        {symbol && <span className={`cls cls-${m.classification}`}>{symbol}</span>}
      </button>,
    );
  }
  return <div className="moves">{cells}</div>;
}

export function BarList({
  rows,
  max,
  format = (v) => String(v),
}: {
  rows: { label: string; value: number }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <span>{r.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.value / top) * 100}%` }} />
          </div>
          <span className="bar-value">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Toasts() {
  const { t } = useTranslation();
  const toasts = useProgress((s) => s.toasts);
  const dismiss = useProgress((s) => s.dismissToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => dismiss(toasts[0]!.id), 3500);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>
          <span>
            {toast.kind === 'badge'
              ? t(toast.text, { badge: t(`badges.${toast.params?.badge}.name`) })
              : t(toast.text, toast.params ?? {})}
          </span>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function ConsentBanner() {
  const { t } = useTranslation();
  const consent = useSettings((s) => s.analyticsConsent);
  const setConsent = useSettings((s) => s.setAnalyticsConsent);
  if (consent !== 'unset') return null;
  return (
    <div className="card consent" role="dialog" aria-label={t('consent.title')}>
      <p>
        <strong>{t('consent.title')}</strong>
      </p>
      <p className="small muted">{t('consent.body')}</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => setConsent('granted')}>
          {t('consent.accept')}
        </button>
        <button type="button" className="btn" onClick={() => setConsent('denied')}>
          {t('consent.reject')}
        </button>
      </div>
    </div>
  );
}

/** Aviso cuando una función necesita el servidor y no está conectado. */
export function ServerNotice({ available }: { available: boolean | null }) {
  const { t } = useTranslation();
  if (available !== false) return null;
  return (
    <p className="status" role="status" data-testid="server-notice">
      🔌 {t('server.unavailable')}
    </p>
  );
}

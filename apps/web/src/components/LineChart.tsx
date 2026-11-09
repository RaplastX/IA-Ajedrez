/**
 * Gráfico de líneas de una sola serie (SVG): curva de evaluación, historial de rating, precisión.
 * Línea de 2px, área al 10 %, rejilla fina, punto y etiqueta final, crosshair con tooltip
 * (ratón y teclado) y vista de tabla para accesibilidad.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface ChartPoint {
  x: number;
  y: number;
  /** Etiqueta para tooltip y tabla (p. ej. "12. Nf3" o una fecha). */
  label: string;
  /** Valor formateado para tooltip/tabla. */
  display: string;
}

interface LineChartProps {
  points: ChartPoint[];
  yDomain?: [number, number];
  /** Línea de referencia (p. ej. 50 % en la curva de evaluación). */
  baseline?: number;
  height?: number;
  title: string;
  valueHeader: string;
  current?: number;
  onSelect?: (index: number) => void;
  formatTick?: (v: number) => string;
}

const W = 600;
const PAD = { top: 12, right: 52, bottom: 22, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function LineChart({
  points,
  yDomain,
  baseline,
  height = 180,
  title,
  valueHeader,
  current,
  onSelect,
  formatTick = (v) => String(v),
}: LineChartProps) {
  const { t } = useTranslation();
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.y);
    const [y0, y1] = yDomain ?? [Math.min(...ys), Math.max(...ys)];
    const pad = yDomain ? 0 : Math.max(10, (y1 - y0) * 0.1);
    const minY = y0 - pad;
    const maxY = y1 + pad;
    const plotW = W - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const sx = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const sy = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY || 1)) * plotH;
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const base = sy(baseline ?? minY);
    const area = `${line} L${sx(points.length - 1).toFixed(1)},${base.toFixed(1)} L${sx(0).toFixed(1)},${base.toFixed(1)} Z`;
    return { sx, sy, line, area, ticks: niceTicks(minY, maxY), plotW, minY, maxY };
  }, [points, yDomain, baseline, height]);

  if (!geometry) return <p className="muted small">{t('charts.noData')}</p>;
  const { sx, sy, line, area, ticks } = geometry;
  const last = points[points.length - 1]!;
  const active = hover ?? null;

  function indexFromPointer(event: PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (x - PAD.left) / geometry!.plotW;
    return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = hover ?? current ?? points.length - 1;
    const next = Math.max(0, Math.min(points.length - 1, from + (event.key === 'ArrowRight' ? 1 : -1)));
    setHover(next);
    onSelect?.(next);
  }

  const tooltipPoint = active !== null ? points[active] : null;

  return (
    <figure className="chart" style={{ margin: 0 }} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="small muted" style={{ marginBottom: 4 }}>
        {title}
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={title}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setHover(indexFromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onClick={(e) => {
          const i = indexFromPointer(e as unknown as PointerEvent);
          if (i !== null) onSelect?.(i);
        }}
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} />
            <text className="axis-label" x={PAD.left - 6} y={sy(v) + 4} textAnchor="end">
              {formatTick(v)}
            </text>
          </g>
        ))}
        <path className="series-area" d={area} />
        <path className="series-line" d={line} />
        {current !== undefined && points[current] && (
          <line className="marker-current" x1={sx(current)} x2={sx(current)} y1={PAD.top} y2={height - PAD.bottom} />
        )}
        <circle className="end-dot" cx={sx(points.length - 1)} cy={sy(last.y)} r={4} />
        <text className="end-label" x={sx(points.length - 1) + 8} y={sy(last.y) + 4}>
          {last.display}
        </text>
        {tooltipPoint && active !== null && (
          <>
            <line className="crosshair" x1={sx(active)} x2={sx(active)} y1={PAD.top} y2={height - PAD.bottom} />
            <circle className="end-dot" cx={sx(active)} cy={sy(tooltipPoint.y)} r={4} />
          </>
        )}
      </svg>
      {tooltipPoint && active !== null && (
        <div
          className="tooltip"
          role="status"
          style={{ left: `${(sx(active) / W) * 100}%`, top: `${(sy(tooltipPoint.y) / height) * 100}%` }}
        >
          <strong>{tooltipPoint.display}</strong>
          <span className="muted">{tooltipPoint.label}</span>
        </div>
      )}
      <details className="table-view">
        <summary>{t('charts.showTable')}</summary>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="num">{valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td className="num">{p.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

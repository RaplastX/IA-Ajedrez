import { Chess, type Square } from 'chess.js';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { mateFlourish, playAttack } from '../../lib/attackFx';
import { captureBurst, dustPuff, ParticleSystem } from '../../lib/fx';
import { UNIT, WEAPONS, WeaponStage, type WeaponId } from '../../lib/weapons';
import { tap } from '../../lib/haptics';
import { play } from '../../lib/sound';
import { motionEnabled, useSettings } from '../../store/settings';
import { pieceImage, pieceKey, pieceSheet } from './pieces';
import './board.css';

export interface BoardMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface Arrow {
  from: string;
  to: string;
  color?: 'best' | 'played' | 'hint';
}

export interface BoardProps {
  fen: string;
  orientation?: 'w' | 'b';
  /** Qué color puede mover el usuario. */
  movable?: 'w' | 'b' | 'both' | 'none';
  onMove?: (move: BoardMove) => void;
  lastMove?: [string, string] | null;
  arrows?: Arrow[];
  highlights?: Record<string, 'good' | 'bad' | 'hint'>;
  label?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
/** Personalidad de movimiento de cada pieza. */
/**
 * Movimiento normal: un deslizamiento limpio y rápido con un pequeño rebote al llegar. El caballo
 * describe un arco corto (es la única pieza que salta); sin giros ni deformaciones.
 */
const MOVE_STYLE: Record<string, { arc: number; ms: number }> = {
  p: { arc: 0, ms: 220 },
  n: { arc: 0.32, ms: 300 },
  b: { arc: 0, ms: 240 },
  r: { arc: 0, ms: 260 },
  q: { arc: 0, ms: 260 },
  k: { arc: 0, ms: 240 },
};

function squareAt(col: number, row: number, orientation: 'w' | 'b'): string {
  const file = orientation === 'w' ? FILES[col]! : FILES[7 - col]!;
  const rank = orientation === 'w' ? 8 - row : row + 1;
  return `${file}${rank}`;
}

function squareCenter(square: string, orientation: 'w' | 'b'): [number, number] {
  const file = FILES.indexOf(square[0]!);
  const rank = Number(square[1]);
  const col = orientation === 'w' ? file : 7 - file;
  const row = orientation === 'w' ? 8 - rank : rank - 1;
  return [col + 0.5, row + 0.5];
}

interface DragState {
  from: string;
  piece: string;
  x: number;
  y: number;
  moved: boolean;
  /** Geometría del tablero al empezar el arrastre (no se lee el DOM durante el render). */
  rect: { left: number; top: number; size: number };
}

export function Board({
  fen,
  orientation = 'w',
  movable = 'none',
  onMove,
  lastMove,
  arrows = [],
  highlights = {},
  label,
}: BoardProps) {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.boardTheme);
  const showCoordinates = useSettings((s) => s.showCoordinates);
  const boardRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponCanvasRef = useRef<HTMLCanvasElement>(null);
  const stage = useRef<WeaponStage | null>(null);
  const particles = useRef<ParticleSystem | null>(null);
  const previousFen = useRef<string | null>(null);
  /** Casilla donde se soltó una pieza arrastrada: no se anima el deslizamiento. */
  const droppedAt = useRef<string | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const turn = chess.turn();
  const canMove = movable === 'both' || movable === turn;

  const legalByFrom = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!canMove) return map;
    for (const m of chess.moves({ verbose: true })) {
      if (!map.has(m.from)) map.set(m.from, new Set());
      map.get(m.from)!.add(m.to);
    }
    return map;
  }, [chess, canMove]);

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    return chess.findPiece({ type: 'k', color: turn })[0] ?? null;
  }, [chess, turn]);

  // Efectos al cambiar la posición: deslizamiento de la pieza, partículas al capturar,
  // sonido, vibración y sacudida en el jaque mate. Todo por código, sin assets externos.
  useEffect(() => {
    const before = previousFen.current;
    previousFen.current = fen;
    if (!before || before === fen || !lastMove) return;
    const [from, to] = lastMove;
    let prev: Chess;
    try {
      prev = new Chess(before);
    } catch {
      return;
    }
    const moved = prev.get(from as Square);
    const now = chess.get(to as Square);
    if (!moved || !now || moved.color !== now.color) return; // no es la jugada anterior (p. ej. deshacer)
    const target = prev.get(to as Square);
    const enPassant = moved.type === 'p' && from[0] !== to[0] && !target;
    const isCapture = (!!target && target.color !== moved.color) || enPassant;

    play(chess.inCheck() ? 'check' : isCapture ? 'capture' : 'move');
    tap(isCapture ? 'medium' : 'light');

    const animate = motionEnabled();
    const board = boardRef.current;
    if (!animate || !board) return;
    droppedAt.current = null;
    const size = UNIT; // píxeles de juego por casilla (canvas de 256×256)
    const piece = board.querySelector<HTMLElement>(`[data-square="${to}"] .piece`);
    const [fx, fy] = squareCenter(from, orientation);
    const [tx, ty] = squareCenter(to, orientation);
    const dx = fx - tx;
    const dy = fy - ty;
    const timers: number[] = [];
    const running: Animation[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const canAnimate = (el: Element | null) =>
      !!el && typeof (el as HTMLElement).animate === 'function';
    particles.current ??= canvasRef.current
      ? new ParticleSystem(canvasRef.current, WeaponStage.RES)
      : null;
    stage.current ??= weaponCanvasRef.current ? new WeaponStage(weaponCanvasRef.current) : null;
    const system = particles.current;
    const isMate = chess.isCheckmate();
    const weapon = moved.type as WeaponId;
    const loserKing = isMate ? chess.findPiece({ type: 'k', color: chess.turn() })[0] : undefined;
    let settle = 0; // ms hasta que termina la acción principal

    if (isCapture) {
      // Captura: el atacante usa SU arma sobre la víctima.
      const capturedSquare = enPassant ? `${to[0]}${from[1]}` : to;
      const victim = enPassant
        ? { type: 'p', color: (moved.color === 'w' ? 'b' : 'w') as 'w' | 'b' }
        : { type: target!.type, color: target!.color };
      settle = playAttack({
        board,
        stage: stage.current,
        particles: system,
        weapon,
        from: [fx, fy],
        to: squareCenter(capturedSquare, orientation),
        victim,
        attackerEl: piece,
        defer: later,
      });
    } else {
      // Movimiento normal: deslizamiento limpio con un pequeño rebote al llegar.
      const style = MOVE_STYLE[moved.type] ?? MOVE_STYLE.p!;
      const distance = Math.hypot(dx, dy);
      const ms = style.ms + Math.min(3, distance) * 40;
      if (piece && canAnimate(piece)) {
        const frames: Keyframe[] = [];
        const N = 8;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const lift = style.arc * Math.sin(t * Math.PI) * 100;
          frames.push({
            offset: Number((t * 0.86).toFixed(3)),
            transform: `translate(${dx * (1 - t) * 100}%, ${dy * (1 - t) * 100 - lift}%)`,
            zIndex: 3,
          });
        }
        frames.push(
          { offset: 0.93, transform: 'translate(0, -5%)', zIndex: 3 },
          { offset: 1, transform: 'translate(0, 0)', zIndex: 3 },
        );
        piece.animate(frames, { duration: ms, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' });
      }
      // Una nubecita de polvo al salir y otra al llegar.
      later(() => system?.add(dustPuff(fx * size, fy * size, size)), 30);
      later(() => system?.add(dustPuff(tx * size, ty * size, size)), ms * 0.86);
      settle = ms;
      // Mate sin captura: el atacante dispara su arma contra el rey.
      if (isMate && loserKing) {
        const king = squareCenter(loserKing, orientation);
        later(() => {
          stage.current?.play(
            WEAPONS[weapon],
            { x: tx * size, y: ty * size },
            { x: king[0] * size, y: king[1] * size },
            () => {
              system?.add(captureBurst(king[0] * size, king[1] * size, size * 1.4));
              play('capture');
              tap('heavy');
            },
          );
        }, ms + 40);
        settle = ms + 40 + WEAPONS[weapon].ms * WEAPONS[weapon].hit;
      }
    }

    // Coronación.
    if (moved.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      later(() => system?.add(captureBurst(tx * size, ty * size, size * 1.6)), 300);
    }

    // Jaque mate: remate con el rey cayendo y cartel gigante.
    if (isMate && loserKing) {
      const kingEl = board.querySelector<HTMLElement>(`[data-square="${loserKing}"] .piece`);
      later(
        () =>
          mateFlourish(
            board,
            stage.current,
            kingEl,
            squareCenter(loserKing, orientation),
            system,
            WEAPONS[weapon].flash,
          ),
        settle + 160,
      );
    }
    return () => {
      timers.forEach(clearTimeout);
      running.forEach((a) => a.cancel());
    };
    // Solo reacciona a cambios de posición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  useEffect(
    () => () => {
      particles.current?.dispose();
      stage.current?.dispose();
    },
    [],
  );

  const targets = selected ? (legalByFrom.get(selected) ?? new Set<string>()) : new Set<string>();

  function tryMove(from: string, to: string) {
    if (!legalByFrom.get(from)?.has(to)) return false;
    const piece = chess.get(from as Square);
    const lastRank = to[1] === '8' || to[1] === '1';
    if (piece?.type === 'p' && lastRank) {
      setPromotion({ from, to });
      return true;
    }
    onMove?.({ from, to });
    setSelected(null);
    return true;
  }

  function handleSquareClick(square: string) {
    if (promotion) return;
    if (selected && selected !== square && tryMove(selected, square)) return;
    if (legalByFrom.has(square)) setSelected(square === selected ? null : square);
    else setSelected(null);
  }

  function squareFromPoint(clientX: number, clientY: number): string | null {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return null;
    const col = Math.floor(((clientX - box.left) / box.width) * 8);
    const row = Math.floor(((clientY - box.top) / box.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return squareAt(col, row, orientation);
  }

  function onPointerDown(event: ReactPointerEvent, square: string) {
    if (event.button !== 0 || !legalByFrom.has(square) || promotion) return;
    const piece = chess.get(square as Square);
    const box = boardRef.current?.getBoundingClientRect();
    if (!piece || !box) return;
    setDrag({
      from: square,
      piece: pieceKey(piece.color, piece.type),
      x: event.clientX,
      y: event.clientY,
      moved: false,
      rect: { left: box.left, top: box.top, size: box.width / 8 },
    });
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
    // La captura se activa solo al arrastrar de verdad, para no interferir con los clics.
    if (moved && !drag.moved) boardRef.current?.setPointerCapture(event.pointerId);
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
  }

  function onPointerUp(event: ReactPointerEvent) {
    if (!drag) return;
    const { from, moved } = drag;
    setDrag(null);
    if (!moved) return; // el evento click hará la selección
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const target = squareFromPoint(event.clientX, event.clientY);
    if (target && target !== from) {
      droppedAt.current = target;
      if (!tryMove(from, target)) setSelected(null);
    } else {
      setSelected(from);
    }
  }

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareAt(col, row, orientation);
      const piece = chess.get(square as Square);
      const isLight = (col + row) % 2 === 0;
      const key = piece ? pieceKey(piece.color, piece.type) : null;
      const classes = ['sq', isLight ? 'light' : 'dark'];
      if (selected === square) classes.push('selected');
      if (lastMove && (lastMove[0] === square || lastMove[1] === square)) classes.push('last');
      if (checkSquare === square) classes.push('check');
      const hl = highlights[square];
      if (hl) classes.push(`hl-${hl}`);
      const isTarget = targets.has(square);
      const pieceName = piece ? t(`pieces.${piece.color}${piece.type}`) : t('board.empty');
      squares.push(
        <button
          type="button"
          key={square}
          className={classes.join(' ')}
          data-square={square}
          data-piece={key ?? undefined}
          data-movable={legalByFrom.has(square) || undefined}
          style={{ '--bob-delay': `${((col * 7 + row * 3) % 10) * -0.26}s` } as CSSProperties}
          aria-label={`${square}, ${pieceName}`}
          aria-pressed={selected === square}
          onClick={() => {
            if (suppressClick.current) return;
            handleSquareClick(square);
          }}
          onPointerDown={(e) => onPointerDown(e, square)}
        >
          {showCoordinates && col === 0 && <span className="coord rank">{square[1]}</span>}
          {showCoordinates && row === 7 && <span className="coord file">{square[0]}</span>}
          {key && (
            <span
              className={`piece life-${piece!.type} side-${piece!.color}${drag?.from === square && drag.moved ? ' dragging-origin' : ''}`}
            >
              <span className="sprite" style={{ backgroundImage: `url(${pieceSheet(key)})` }} />
            </span>
          )}
          {isTarget && <span className={piece ? 'target capture' : 'target'} />}
        </button>,
      );
    }
  }

  return (
    <div className={`board-wrap theme-${theme}`}>
      <div
        ref={boardRef}
        className={`board${canMove ? ' can-move' : ''}`}
        role="group"
        aria-label={label ?? t('board.label')}
        data-fen={fen}
        data-turn={turn}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {squares}
        <canvas ref={canvasRef} className="fx-layer" aria-hidden="true" />
        <canvas ref={weaponCanvasRef} className="fx-layer weapon-layer" aria-hidden="true" />
        {arrows.length > 0 && (
          <svg className="arrows" viewBox="0 0 8 8" aria-hidden="true">
            <defs>
              {(['best', 'played', 'hint'] as const).map((c) => (
                <marker
                  key={c}
                  id={`head-${c}`}
                  markerWidth="3"
                  markerHeight="3"
                  refX="1.5"
                  refY="1.5"
                  orient="auto"
                >
                  <path d="M0,0 L3,1.5 L0,3 z" className={`arrow-${c}`} />
                </marker>
              ))}
            </defs>
            {arrows.map((a, i) => {
              const [x1, y1] = squareCenter(a.from, orientation);
              const [x2, y2] = squareCenter(a.to, orientation);
              const len = Math.hypot(x2 - x1, y2 - y1) || 1;
              const shorten = 0.35;
              const color = a.color ?? 'best';
              return (
                <line
                  key={`${a.from}${a.to}${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2 - ((x2 - x1) / len) * shorten}
                  y2={y2 - ((y2 - y1) / len) * shorten}
                  className={`arrow-line arrow-${color}`}
                  markerEnd={`url(#head-${color})`}
                />
              );
            })}
          </svg>
        )}
        {drag?.moved && (
          <img
            className="drag-ghost"
            src={pieceImage(drag.piece)}
            alt=""
            style={{
              width: drag.rect.size,
              height: drag.rect.size,
              left: drag.x - drag.rect.left - drag.rect.size / 2,
              top: drag.y - drag.rect.top - drag.rect.size / 2,
            }}
          />
        )}
        {promotion && (
          <div className="promotion" role="dialog" aria-label={t('board.promote')}>
            {(['q', 'r', 'b', 'n'] as const).map((p) => (
              <button
                type="button"
                key={p}
                aria-label={t(`pieces.${turn}${p}`)}
                onClick={() => {
                  onMove?.({ ...promotion, promotion: p });
                  setPromotion(null);
                  setSelected(null);
                }}
              >
                <img src={pieceImage(pieceKey(turn, p))} alt="" />
              </button>
            ))}
            <button type="button" className="promotion-cancel" onClick={() => setPromotion(null)}>
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

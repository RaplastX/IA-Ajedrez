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
import { captureBurst, dustPuff, ParticleSystem, shatter } from '../../lib/fx';
import { tap } from '../../lib/haptics';
import { play } from '../../lib/sound';
import { motionEnabled, useSettings } from '../../store/settings';
import { PIECE_IMAGES, pieceKey } from './pieces';
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
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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
    const dragged = droppedAt.current === to;
    droppedAt.current = null;
    const size = board.getBoundingClientRect().width / 8;
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
    particles.current ??= canvasRef.current ? new ParticleSystem(canvasRef.current) : null;
    const system = particles.current;

    // 1) Salto en arco con estiramiento en el aire y aplastamiento al aterrizar ("squash & stretch").
    const hop = Math.min(0.75, 0.3 + Math.hypot(dx, dy) * 0.07) * 100;
    const isKnight = moved.type === 'n';
    const impact = dragged ? 0 : 250;
    if (!dragged && piece && canAnimate(piece)) {
      piece.animate(
        [
          { transform: `translate(${dx * 100}%, ${dy * 100}%) scale(1, 1)`, zIndex: 3 },
          {
            transform: `translate(${dx * 50}%, ${dy * 50 - hop}%) scale(0.92, 1.12) rotate(${isKnight ? -14 : 0}deg)`,
            offset: 0.5,
            zIndex: 3,
          },
          { transform: 'translate(0, 0) scale(1.2, 0.8)', offset: 0.82, zIndex: 3 },
          { transform: 'translate(0, -4%) scale(0.95, 1.06)', offset: 0.92, zIndex: 3 },
          { transform: 'translate(0, 0) scale(1, 1)', zIndex: 3 },
        ],
        { duration: 300, easing: 'cubic-bezier(0.33, 0, 0.2, 1)' },
      );
    }
    later(() => system?.add(dustPuff(tx * size, ty * size, size)), impact);

    // 2) Captura: destello, la pieza rival sale volando girando, fragmentos cromados,
    //    número flotante con el material ganado y temblor del tablero según su valor.
    if (isCapture) {
      const capturedSquare = enPassant ? `${to[0]}${from[1]}` : to;
      const capturedPiece = enPassant
        ? { type: 'p', color: moved.color === 'w' ? 'b' : 'w' }
        : target!;
      const [cx, cy] = squareCenter(capturedSquare, orientation);
      const value = PIECE_VALUE[capturedPiece.type] ?? 1;
      const dir = Math.sign(-dx) || 1;
      later(() => {
        const ghost = document.createElement('img');
        ghost.src = PIECE_IMAGES[pieceKey(capturedPiece.color as 'w' | 'b', capturedPiece.type)]!;
        ghost.className = 'fx-ghost';
        ghost.style.cssText = `width:${size}px;height:${size}px;left:${(cx - 0.5) * size}px;top:${(cy - 0.5) * size}px`;
        board.appendChild(ghost);
        if (canAnimate(ghost)) {
          const fly = ghost.animate(
            [
              { transform: 'none', filter: 'brightness(4) drop-shadow(0 0 12px #fff)', opacity: 1 },
              { transform: 'scale(1.15)', filter: 'brightness(1.6)', offset: 0.12 },
              {
                transform: `translate(${dir * 170}%, -150%) rotate(${dir * 300}deg) scale(0.85)`,
                opacity: 1,
                offset: 0.55,
              },
              {
                transform: `translate(${dir * 260}%, 40%) rotate(${dir * 620}deg) scale(0.55)`,
                opacity: 0,
              },
            ],
            { duration: 760, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
          );
          fly.onfinish = () => ghost.remove();
        } else {
          ghost.remove();
        }
        system?.add([
          ...captureBurst(cx * size, cy * size, size),
          ...shatter(cx * size, cy * size, size, -dx, -dy, 10 + value * 2),
        ]);
        const score = document.createElement('span');
        score.className = 'fx-score';
        score.textContent = `+${value}`;
        score.style.cssText = `left:${cx * size}px;top:${(cy - 0.35) * size}px;font-size:${size * 0.38}px`;
        board.appendChild(score);
        if (canAnimate(score)) {
          const rise = score.animate(
            [
              { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
              { transform: 'translate(-50%, -40%) scale(1.25)', opacity: 1, offset: 0.2 },
              { transform: 'translate(-50%, -140%) scale(1)', opacity: 0 },
            ],
            { duration: 950, easing: 'ease-out' },
          );
          rise.onfinish = () => score.remove();
        } else {
          score.remove();
        }
        const amp = 2 + value * 0.9;
        board.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: `translate(${-amp}px, ${amp * 0.5}px)` },
            { transform: `translate(${amp * 0.8}px, ${-amp * 0.4}px)` },
            { transform: `translate(${-amp * 0.4}px, 0)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 260, easing: 'ease-out' },
        );
      }, impact);
    }

    // 3) Coronación: destello y chispas ascendentes.
    if (moved.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      later(() => system?.add(captureBurst(tx * size, ty * size, size * 1.3)), impact);
    }

    // 4) Jaque mate: el rey derrotado cae y el tablero se sacude.
    if (chess.isCheckmate()) {
      const loserKing = chess.findPiece({ type: 'k', color: chess.turn() })[0];
      later(() => {
        const king = loserKing
          ? board.querySelector<HTMLElement>(`[data-square="${loserKing}"] .piece`)
          : null;
        if (king && canAnimate(king)) {
          running.push(
            king.animate(
              [
                { transform: 'rotate(0deg)' },
                { transform: 'rotate(-12deg) translateY(-6%)', offset: 0.25 },
                { transform: 'rotate(88deg) translate(18%, 8%)', offset: 0.8 },
                { transform: 'rotate(80deg) translate(18%, 6%)' },
              ],
              { duration: 700, easing: 'cubic-bezier(0.5, 0, 0.7, 1)', fill: 'forwards' },
            ),
          );
        }
        system?.add(
          captureBurst(
            (loserKing ? squareCenter(loserKing, orientation)[0] : tx) * size,
            ty * size,
            size * 1.6,
          ),
        );
        board.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: 'translate(-9px, 3px) rotate(-0.5deg)' },
            { transform: 'translate(8px, -3px) rotate(0.4deg)' },
            { transform: 'translate(-5px, 1px)' },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 480, easing: 'ease-out' },
        );
      }, impact + 120);
    }
    return () => {
      timers.forEach(clearTimeout);
      running.forEach((a) => a.cancel());
    };
    // Solo reacciona a cambios de posición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  useEffect(() => () => particles.current?.dispose(), []);

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
            <img
              className={`piece${drag?.from === square && drag.moved ? ' dragging-origin' : ''}`}
              src={PIECE_IMAGES[key]}
              alt=""
              draggable={false}
            />
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
            src={PIECE_IMAGES[drag.piece]}
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
                <img src={PIECE_IMAGES[pieceKey(turn, p)]} alt="" />
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

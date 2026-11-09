import { Chess, type Square } from 'chess.js';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../store/settings';
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
    if (!piece) return;
    setDrag({ from: square, piece: pieceKey(piece.color, piece.type), x: event.clientX, y: event.clientY, moved: false });
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
      if (!tryMove(from, target)) setSelected(null);
    } else {
      setSelected(from);
    }
  }

  const box = boardRef.current?.getBoundingClientRect();
  const squareSize = box ? box.width / 8 : 0;

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
        className="board"
        role="group"
        aria-label={label ?? t('board.label')}
        data-fen={fen}
        data-turn={turn}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {squares}
        {arrows.length > 0 && (
          <svg className="arrows" viewBox="0 0 8 8" aria-hidden="true">
            <defs>
              {(['best', 'played', 'hint'] as const).map((c) => (
                <marker key={c} id={`head-${c}`} markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
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
        {drag?.moved && squareSize > 0 && (
          <img
            className="drag-ghost"
            src={PIECE_IMAGES[drag.piece]}
            alt=""
            style={{
              width: squareSize,
              height: squareSize,
              left: drag.x - (box?.left ?? 0) - squareSize / 2,
              top: drag.y - (box?.top ?? 0) - squareSize / 2,
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

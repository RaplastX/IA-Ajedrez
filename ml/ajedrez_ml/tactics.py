"""Generación y etiquetado de ejercicios tácticos a partir de partidas (estilo Lichess, simplificado).

Idea: recorrer las posiciones de partidas reales con un motor UCI. Cuando una jugada hace caer
mucho el % de victoria (error grave), la posición resultante es candidata a puzzle si el rival
tiene una única jugada claramente mejor que las demás. La solución es la variante principal del
motor y los temas se etiquetan con heurísticas (mate en N, horquilla, clavada, pieza colgada...).

La salida es CSV con las columnas de la base de puzzles de Lichess, así que
``scripts/build-puzzles.mjs`` la importa directamente al banco de la app.

Uso (motor nativo o Stockfish WASM vía Node):
    python -m ajedrez_ml.tactics out/positions.jsonl -o out/puzzles.csv --engine /usr/games/stockfish
    python -m ajedrez_ml.tactics out/positions.jsonl -o out/puzzles.csv \
        --engine "node ../node_modules/stockfish/bin/stockfish-19-lite-single.js"
"""

from __future__ import annotations

import argparse
import csv
import math
import shlex
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

import chess
import chess.engine

from .pgn_dataset import read_jsonl

PIECE_VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}


def win_percent(cp: int) -> float:
    """Misma fórmula que @ia-ajedrez/core (Lichess)."""
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def score_cp(score: chess.engine.PovScore, color: chess.Color) -> int:
    return score.pov(color).score(mate_score=10000) or 0


# ---------------------------------------------------------------- etiquetado heurístico


def detect_fork(board: chess.Board, move: chess.Move) -> bool:
    """Tras ``move``, la pieza movida ataca a 2+ piezas más valiosas (o al rey)."""
    after = board.copy()
    after.push(move)
    piece = after.piece_at(move.to_square)
    if piece is None:
        return False
    value = PIECE_VALUE[piece.piece_type]
    targets = 0
    for sq in after.attacks(move.to_square):
        target = after.piece_at(sq)
        if target and target.color != piece.color and (target.piece_type == chess.KING or PIECE_VALUE[target.piece_type] > value):
            targets += 1
    return targets >= 2


def detect_pin(board: chess.Board, move: chess.Move) -> bool:
    """Tras ``move`` hay una pieza rival clavada contra su rey por la pieza movida."""
    after = board.copy()
    after.push(move)
    mover = not after.turn
    for sq, target in after.piece_map().items():
        if target.color == mover or target.piece_type == chess.KING:
            continue
        if after.is_pinned(not mover, sq) and move.to_square in after.pin(not mover, sq):
            return True
    return False


def detect_hanging_capture(board: chess.Board, move: chess.Move) -> bool:
    """La jugada captura una pieza que no estaba defendida."""
    if not board.is_capture(move) or board.is_en_passant(move):
        return False
    return not board.is_attacked_by(not board.turn, move.to_square)


def label_themes(board: chess.Board, solution: list[chess.Move], mate_in: int | None) -> list[str]:
    themes: list[str] = []
    if mate_in is not None:
        themes.append(f"mateIn{min(mate_in, 5)}")
        if mate_in == 1:
            after = board.copy()
            after.push(solution[0])
            king = after.king(after.turn)
            if king is not None and chess.square_rank(king) in (0, 7):
                themes.append("backRankMate")
    first = solution[0]
    if detect_fork(board, first):
        themes.append("fork")
    if detect_pin(board, first):
        themes.append("pin")
    if detect_hanging_capture(board, first):
        themes.append("hangingPiece")
    if first.promotion:
        themes.append("promotion")
    material = sum(PIECE_VALUE[p.piece_type] for p in board.piece_map().values() if p.piece_type != chess.PAWN)
    themes.append("endgame" if material <= 13 else "middlegame" if board.fullmove_number > 10 else "opening")
    return themes


# ---------------------------------------------------------------- generación con motor


@dataclass
class PuzzleCandidate:
    puzzle_id: str
    fen: str
    moves: list[str]
    rating: int
    themes: list[str] = field(default_factory=list)


@dataclass
class GeneratorConfig:
    depth: int = 14
    blunder_drop: float = 15.0
    #: Diferencia mínima de % de victoria entre la mejor y la segunda mejor jugada (solución única).
    uniqueness: float = 20.0
    max_solution_plies: int = 5


def find_puzzle(
    engine: chess.engine.SimpleEngine,
    fen_before: str,
    blunder: str,
    cfg: GeneratorConfig,
    puzzle_id: str,
) -> PuzzleCandidate | None:
    """Comprueba si ``blunder`` en ``fen_before`` deja un puzzle para el rival."""
    board = chess.Board(fen_before)
    mover = board.turn
    limit = chess.engine.Limit(depth=cfg.depth)
    before = engine.analyse(board, limit)
    board.push_uci(blunder)
    infos = engine.analyse(board, limit, multipv=2)
    if not infos:
        return None
    best = infos[0]
    drop = win_percent(score_cp(before["score"], mover)) - win_percent(score_cp(best["score"], mover))
    if drop < cfg.blunder_drop:
        return None
    solver = board.turn
    best_wp = win_percent(score_cp(best["score"], solver))
    if len(infos) > 1 and best_wp - win_percent(score_cp(infos[1]["score"], solver)) < cfg.uniqueness:
        return None
    pv = best.get("pv", [])[: cfg.max_solution_plies]
    if len(pv) % 2 == 0:  # la solución termina en una jugada del que resuelve
        pv = pv[:-1]
    if not pv:
        return None
    mate = best["score"].pov(solver).mate()
    themes = label_themes(board, pv, mate if mate and mate > 0 else None)
    # Rating orientativo: más largo y más tranquilo = más difícil.
    rating = 1000 + 150 * len(pv) + (0 if board.is_capture(pv[0]) or board.gives_check(pv[0]) else 250)
    return PuzzleCandidate(puzzle_id, fen_before, [blunder, *(m.uci() for m in pv)], rating, themes)


def generate(positions: Iterable[tuple[str, str, str]], engine_cmd: str, cfg: GeneratorConfig) -> list[PuzzleCandidate]:
    found: list[PuzzleCandidate] = []
    with chess.engine.SimpleEngine.popen_uci(shlex.split(engine_cmd)) as engine:
        for puzzle_id, fen, move in positions:
            candidate = find_puzzle(engine, fen, move, cfg, puzzle_id)
            if candidate:
                found.append(candidate)
    return found


def write_lichess_csv(puzzles: Iterable[PuzzleCandidate], out: Path) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl", "OpeningTags"])
        for p in puzzles:
            writer.writerow([p.puzzle_id, p.fen, " ".join(p.moves), p.rating, 100, 100, 1000, " ".join(p.themes), "", ""])
            n += 1
    return n


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("positions", type=Path, help="JSONL generado por pgn_dataset")
    parser.add_argument("-o", "--out", type=Path, required=True)
    parser.add_argument("--engine", default="stockfish", help="comando del motor UCI")
    parser.add_argument("--depth", type=int, default=14)
    parser.add_argument("--limit", type=int, default=2000, help="máximo de posiciones a revisar")
    args = parser.parse_args(argv)
    rows = []
    for i, pos in enumerate(read_jsonl(args.positions)):
        if i >= args.limit:
            break
        rows.append((f"g{pos.game_id}p{pos.ply}", pos.fen, pos.move))
    puzzles = generate(rows, args.engine, GeneratorConfig(depth=args.depth))
    print(f"{write_lichess_csv(puzzles, args.out)} puzzles en {args.out}")


if __name__ == "__main__":
    main()

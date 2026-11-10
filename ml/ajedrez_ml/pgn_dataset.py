"""Preprocesado de partidas PGN (Lichess Database, TWIC, PGN Mentor...).

Pasos:
1. Lee uno o varios archivos ``.pgn`` (o ``.pgn.zst`` de Lichess si está instalado ``zstandard``).
2. Filtra: variante estándar, partida completa, Elo mínimo y control de tiempo no bala.
3. Elimina duplicados por la secuencia de jugadas (habitual al mezclar fuentes).
4. Extrae posiciones: FEN, jugada (UCI), resultado desde el bando que mueve y Elo medio.
5. Escribe JSONL (una posición por línea), formato que consumen ``train_policy`` y ``tactics``.

Uso:
    python -m ajedrez_ml.pgn_dataset data/sample.pgn -o out/positions.jsonl --min-elo 1800
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from collections.abc import Iterable, Iterator
from dataclasses import asdict, dataclass
from pathlib import Path

import chess
import chess.pgn

RESULT_SCORE = {"1-0": 1.0, "0-1": 0.0, "1/2-1/2": 0.5}


@dataclass
class Position:
    fen: str
    move: str
    ply: int
    #: Resultado final desde el punto de vista del bando que mueve: 1, 0.5 o 0.
    outcome: float
    elo: int
    game_id: str


@dataclass
class FilterConfig:
    min_elo: int = 0
    min_plies: int = 10
    #: Segundos base mínimos (descarta bala si es 180). 0 = no filtrar.
    min_base_seconds: int = 0
    skip_first_plies: int = 0


def open_pgn(path: Path) -> io.TextIOBase:
    if path.suffix == ".zst":
        import zstandard  # opcional: solo para descargas comprimidas de Lichess

        stream = zstandard.ZstdDecompressor().stream_reader(path.open("rb"))
        return io.TextIOWrapper(stream, encoding="utf-8", errors="replace")
    return path.open(encoding="utf-8", errors="replace")


def _elo(headers: chess.pgn.Headers, key: str) -> int | None:
    try:
        return int(headers.get(key, ""))
    except ValueError:
        return None


def _base_seconds(time_control: str) -> int | None:
    try:
        return int(time_control.split("+")[0])
    except (ValueError, IndexError):
        return None


def game_signature(game: chess.pgn.Game) -> str:
    """Huella de la partida para deduplicar (jugadas + posición inicial)."""
    moves = " ".join(m.uci() for m in game.mainline_moves())
    return hashlib.sha1(f"{game.board().fen()}|{moves}".encode()).hexdigest()


def accept_game(game: chess.pgn.Game, cfg: FilterConfig) -> bool:
    headers = game.headers
    if headers.get("Variant", "Standard").lower() not in ("standard", "chess", ""):
        return False
    if headers.get("Result") not in RESULT_SCORE:
        return False
    if game.errors:
        return False
    white, black = _elo(headers, "WhiteElo"), _elo(headers, "BlackElo")
    if cfg.min_elo and (white is None or black is None or min(white, black) < cfg.min_elo):
        return False
    if cfg.min_base_seconds:
        base = _base_seconds(headers.get("TimeControl", ""))
        if base is not None and base < cfg.min_base_seconds:
            return False
    plies = sum(1 for _ in game.mainline_moves())
    return plies >= cfg.min_plies


def iter_games(paths: Iterable[Path]) -> Iterator[chess.pgn.Game]:
    for path in paths:
        with open_pgn(path) as handle:
            while (game := chess.pgn.read_game(handle)) is not None:
                yield game


def extract_positions(game: chess.pgn.Game, cfg: FilterConfig) -> Iterator[Position]:
    headers = game.headers
    result = RESULT_SCORE[headers["Result"]]
    elos = [e for e in (_elo(headers, "WhiteElo"), _elo(headers, "BlackElo")) if e is not None]
    elo = round(sum(elos) / len(elos)) if elos else 0
    game_id = game_signature(game)[:12]
    board = game.board()
    for ply, move in enumerate(game.mainline_moves()):
        if ply >= cfg.skip_first_plies:
            outcome = result if board.turn == chess.WHITE else 1.0 - result
            yield Position(board.fen(), move.uci(), ply, outcome, elo, game_id)
        board.push(move)


def build_dataset(paths: Iterable[Path], cfg: FilterConfig) -> tuple[list[Position], dict[str, int]]:
    seen: set[str] = set()
    positions: list[Position] = []
    stats = {"games": 0, "accepted": 0, "duplicates": 0, "rejected": 0}
    for game in iter_games(paths):
        stats["games"] += 1
        if not accept_game(game, cfg):
            stats["rejected"] += 1
            continue
        signature = game_signature(game)
        if signature in seen:
            stats["duplicates"] += 1
            continue
        seen.add(signature)
        stats["accepted"] += 1
        positions.extend(extract_positions(game, cfg))
    return positions, stats


def write_jsonl(positions: Iterable[Position], out: Path) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with out.open("w", encoding="utf-8") as fh:
        for pos in positions:
            fh.write(json.dumps(asdict(pos), ensure_ascii=False) + "\n")
            n += 1
    return n


def read_jsonl(path: Path) -> Iterator[Position]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield Position(**json.loads(line))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pgn", nargs="+", type=Path)
    parser.add_argument("-o", "--out", type=Path, required=True)
    parser.add_argument("--min-elo", type=int, default=0)
    parser.add_argument("--min-plies", type=int, default=10)
    parser.add_argument("--min-base-seconds", type=int, default=0)
    parser.add_argument("--skip-first-plies", type=int, default=0)
    args = parser.parse_args(argv)
    cfg = FilterConfig(args.min_elo, args.min_plies, args.min_base_seconds, args.skip_first_plies)
    positions, stats = build_dataset(args.pgn, cfg)
    n = write_jsonl(positions, args.out)
    print(json.dumps({**stats, "positions": n}))


if __name__ == "__main__":
    main()

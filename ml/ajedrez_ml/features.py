"""Representación de posiciones y jugadas para redes neuronales.

- ``board_to_planes``: tensor 18x8x8 (12 planos de piezas, turno, 4 derechos de enroque, al paso).
- ``move_to_index`` / ``index_to_move``: codificación "desde-hasta" (64*64) más 3x64*... para
  subpromociones, simplificada a 4096 + 4 piezas de promoción por casilla de destino.
"""

from __future__ import annotations

import chess
import numpy as np

PIECE_ORDER = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
NUM_PLANES = 18
PROMOTIONS = [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN]
POLICY_SIZE = 64 * 64 + 64 * len(PROMOTIONS)


def board_to_planes(board: chess.Board) -> np.ndarray:
    """Codifica la posición siempre desde el punto de vista del bando que mueve.

    Si juegan negras se voltea el tablero, así la red aprende un único punto de vista
    (técnica habitual en AlphaZero/Leela).
    """
    planes = np.zeros((NUM_PLANES, 8, 8), dtype=np.float32)
    flip = board.turn == chess.BLACK
    for square, piece in board.piece_map().items():
        sq = chess.square_mirror(square) if flip else square
        own = piece.color == board.turn
        plane = PIECE_ORDER.index(piece.piece_type) + (0 if own else 6)
        planes[plane, chess.square_rank(sq), chess.square_file(sq)] = 1.0
    planes[12, :, :] = 1.0 if board.turn == chess.WHITE else 0.0
    us, them = board.turn, not board.turn
    planes[13, :, :] = float(board.has_kingside_castling_rights(us))
    planes[14, :, :] = float(board.has_queenside_castling_rights(us))
    planes[15, :, :] = float(board.has_kingside_castling_rights(them))
    planes[16, :, :] = float(board.has_queenside_castling_rights(them))
    if board.ep_square is not None:
        ep = chess.square_mirror(board.ep_square) if flip else board.ep_square
        planes[17, chess.square_rank(ep), chess.square_file(ep)] = 1.0
    return planes


def move_to_index(move: chess.Move, turn: chess.Color) -> int:
    """Índice de política de una jugada (en el sistema de coordenadas del bando que mueve)."""
    from_sq, to_sq = move.from_square, move.to_square
    if turn == chess.BLACK:
        from_sq, to_sq = chess.square_mirror(from_sq), chess.square_mirror(to_sq)
    if move.promotion and move.promotion != chess.QUEEN:
        return 64 * 64 + to_sq * len(PROMOTIONS) + PROMOTIONS.index(move.promotion)
    return from_sq * 64 + to_sq


def index_to_move(index: int, board: chess.Board) -> chess.Move | None:
    """Inversa de ``move_to_index`` para la posición dada; None si la jugada no es legal."""
    flip = board.turn == chess.BLACK
    for move in board.legal_moves:
        if move_to_index(move, board.turn) == index:
            return move
    del flip
    return None


def legal_mask(board: chess.Board) -> np.ndarray:
    """Máscara booleana de jugadas legales sobre el vector de política."""
    mask = np.zeros(POLICY_SIZE, dtype=bool)
    for move in board.legal_moves:
        mask[move_to_index(move, board.turn)] = True
    return mask

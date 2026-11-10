import random

import chess
import numpy as np

from ajedrez_ml.features import NUM_PLANES, POLICY_SIZE, board_to_planes, index_to_move, legal_mask, move_to_index


def test_forma_y_simetria():
    start = chess.Board()
    planes = board_to_planes(start)
    assert planes.shape == (NUM_PLANES, 8, 8)
    assert planes[:12].sum() == 32
    # Tras 1.e4 e5 2.Nf3 Nf6 3.Nc3 Nc6 la posición es simétrica: blancas y negras ven lo mismo
    # salvo el plano de turno.
    sym = chess.Board()
    for san in ["e4", "e5", "Nf3", "Nf6", "Nc3", "Nc6"]:
        sym.push_san(san)
    mirrored = sym.mirror()
    a, b = board_to_planes(sym), board_to_planes(mirrored)
    assert np.array_equal(a[:12], b[:12])


def test_indices_de_jugada_ida_y_vuelta():
    rng = random.Random(1)
    board = chess.Board()
    for _ in range(60):
        moves = list(board.legal_moves)
        if not moves:
            break
        for move in moves:
            idx = move_to_index(move, board.turn)
            assert 0 <= idx < POLICY_SIZE
            assert index_to_move(idx, board) == move
        assert legal_mask(board).sum() == len(moves)
        board.push(rng.choice(moves))


def test_subpromocion():
    board = chess.Board("8/P7/8/8/8/8/8/k6K w - - 0 1")
    assert chess.Move.from_uci("a7a8n") in board.legal_moves
    knight = chess.Move.from_uci("a7a8n")
    queen = chess.Move.from_uci("a7a8q")
    assert move_to_index(knight, chess.WHITE) != move_to_index(queen, chess.WHITE)
    assert move_to_index(knight, chess.WHITE) >= 64 * 64

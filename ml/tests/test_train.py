import chess
import pytest

from ajedrez_ml.pgn_dataset import FilterConfig, build_dataset
from ajedrez_ml.train_tutor import format_example

torch = pytest.importorskip("torch")


def test_entrena_la_red_y_predice_jugadas_legales(sample_pgn):
    from ajedrez_ml.train_policy import predict, train

    positions, _ = build_dataset([sample_pgn], FilterConfig())
    model, history = train(positions, epochs=8, batch_size=16, channels=16, blocks=1, lr=3e-3)
    assert history[-1]["train_loss"] < history[0]["train_loss"]
    board = chess.Board()
    top = predict(model, board, top_k=3)
    assert len(top) == 3
    assert all(chess.Move.from_uci(uci) in board.legal_moves for uci, _ in top)
    assert abs(sum(p for _, p in predict(model, board, top_k=100)) - 1) < 1e-4


def test_formato_del_dataset_del_tutor():
    ex = format_example({"locale": "en", "fen": "8/8/8/8/8/8/8/K6k w - - 0 1", "move": "a1a2", "facts": "x", "explanation": " Hola "})
    assert "en inglés" in ex["input"] and ex["target"] == "Hola"

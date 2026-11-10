import chess

from ajedrez_ml.tactics import (
    GeneratorConfig,
    detect_fork,
    detect_hanging_capture,
    detect_pin,
    find_puzzle,
    label_themes,
    win_percent,
)


def test_win_percent_coincide_con_core():
    assert round(win_percent(0), 6) == 50
    assert round(win_percent(300) + win_percent(-300), 6) == 100


def test_heuristicas_de_temas():
    fork = chess.Board("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1")
    assert detect_fork(fork, chess.Move.from_uci("d5c7"))
    pin = chess.Board("4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1")
    assert detect_pin(pin, chess.Move.from_uci("f1b5"))
    hanging = chess.Board("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1")
    assert detect_hanging_capture(hanging, chess.Move.from_uci("d1d5"))
    back_rank = chess.Board("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1")
    assert {"mateIn1", "backRankMate", "endgame"} <= set(label_themes(back_rank, [chess.Move.from_uci("a1a8")], 1))


def test_genera_puzzle_con_motor(engine_cmd):
    import shlex

    import chess.engine

    with chess.engine.SimpleEngine.popen_uci(shlex.split(engine_cmd)) as engine:
        # 1...Rd2?? abandona la primera fila: Ra8+ Rd8 Rxd8#.
        puzzle = find_puzzle(engine, "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1", "d8d2", GeneratorConfig(depth=10), "t1")
        assert puzzle is not None
        assert puzzle.moves == ["d8d2", "a1a8", "d2d8", "a8d8"]
        assert "mateIn2" in puzzle.themes
        # Una jugada normal no genera puzzle.
        assert find_puzzle(engine, "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1", "h7h6", GeneratorConfig(depth=10), "t2") is None

from ajedrez_ml.pgn_dataset import FilterConfig, build_dataset, read_jsonl, write_jsonl


def test_filtra_y_deduplica(sample_pgn):
    positions, stats = build_dataset([sample_pgn], FilterConfig())
    # Ópera + Inmortal aceptadas; el duplicado se descarta; sin terminar y la corta se rechazan.
    assert stats == {"games": 5, "accepted": 2, "duplicates": 1, "rejected": 2}
    assert len(positions) == 33 + 45


def test_filtro_por_elo(sample_pgn):
    _, stats = build_dataset([sample_pgn], FilterConfig(min_elo=2400))
    assert stats["accepted"] == 1  # solo Anderssen-Kieseritzky


def test_resultado_desde_el_que_mueve(sample_pgn, tmp_path):
    positions, _ = build_dataset([sample_pgn], FilterConfig())
    first = positions[0]
    assert first.move == "e2e4" and first.outcome == 1.0
    assert positions[1].outcome == 0.0  # negras perdieron
    out = tmp_path / "pos.jsonl"
    assert write_jsonl(positions, out) == len(positions)
    assert next(read_jsonl(out)) == first

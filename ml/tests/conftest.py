import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample.pgn"


@pytest.fixture
def sample_pgn() -> Path:
    return SAMPLE


@pytest.fixture
def engine_cmd() -> str:
    """Stockfish nativo si existe; si no, Stockfish.js (WASM) del monorepo ejecutado con Node."""
    native = shutil.which("stockfish")
    if native:
        return native
    wasm = ROOT / "node_modules" / "stockfish" / "bin" / "stockfish-19-lite-single.js"
    node = shutil.which("node")
    if wasm.exists() and node:
        return f"{node} {wasm}"
    pytest.skip("No hay motor UCI disponible")

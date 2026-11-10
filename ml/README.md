# ajedrez-ml

Herramientas de datos e IA de IA Ajedrez (Python 3.10+).

| Módulo | Qué hace |
| --- | --- |
| `pgn_dataset` | Lee PGN/PGN.zst (Lichess, TWIC, PGN Mentor), filtra por variante, Elo y ritmo, deduplica y extrae posiciones a JSONL |
| `features` | Planos 18×8×8 desde el punto de vista del que mueve e índice de política de cada jugada |
| `tactics` | Genera puzzles con un motor UCI (errores graves con solución única) y etiqueta temas; salida CSV en formato Lichess |
| `bandit` | Dificultad adaptativa con muestreo de Thompson y alumno simulado para comparar políticas |
| `train_policy` | Red de política y valor (ResNet pequeña, PyTorch), exportable a ONNX |
| `train_tutor` | Ajuste fino de un seq2seq (flan-t5) con Transformers para el tutor propio |

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu   # o la build con CUDA
pip install -e ".[dev,train]"            # añade ".[nlp]" para el tutor y ".[lichess]" para .zst
pytest -q && ruff check .

python -m ajedrez_ml.pgn_dataset data/sample.pgn -o out/positions.jsonl
python -m ajedrez_ml.tactics out/positions.jsonl -o out/puzzles.csv --engine /usr/games/stockfish
python -m ajedrez_ml.train_policy --data out/positions.jsonl --epochs 5 --out artifacts/policy.pt
python -m ajedrez_ml.bandit --episodes 100
```

Los tests que necesitan motor usan Stockfish nativo o, si no está instalado, Stockfish.js del
monorepo ejecutado con Node (`npm ci` en la raíz). El pipeline completo está en
[docs/DATOS.md](../docs/DATOS.md).

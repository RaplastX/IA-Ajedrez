"""Red de política y valor (PyTorch) entrenada con partidas de maestros.

Aprende a predecir la jugada humana fuerte en cada posición (útil para el entrenador de
aperturas, para sugerir "la jugada de maestro" y como oponente con estilo humano) y el resultado
esperado. Arquitectura: pequeña ResNet convolucional estilo AlphaZero/Leela.

    python -m ajedrez_ml.train_policy --data out/positions.jsonl --epochs 5 --out artifacts/policy.pt
    # Exportar a ONNX para ejecutarla en el navegador con onnxruntime-web:
    python -m ajedrez_ml.train_policy --data out/positions.jsonl --epochs 5 --out artifacts/policy.pt --onnx artifacts/policy.onnx
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import chess
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from .features import NUM_PLANES, POLICY_SIZE, board_to_planes, legal_mask, move_to_index
from .pgn_dataset import Position, read_jsonl


class PositionDataset(Dataset):
    def __init__(self, positions: list[Position]):
        self.planes = np.stack([board_to_planes(chess.Board(p.fen)) for p in positions])
        self.policy = np.array(
            [move_to_index(chess.Move.from_uci(p.move), chess.Board(p.fen).turn) for p in positions], dtype=np.int64
        )
        self.value = np.array([p.outcome * 2 - 1 for p in positions], dtype=np.float32)

    def __len__(self) -> int:
        return len(self.policy)

    def __getitem__(self, i: int):
        return torch.from_numpy(self.planes[i]), self.policy[i], self.value[i]


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        y = torch.relu(self.bn1(self.conv1(x)))
        y = self.bn2(self.conv2(y))
        return torch.relu(x + y)


class PolicyValueNet(nn.Module):
    def __init__(self, channels: int = 64, blocks: int = 4):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(NUM_PLANES, channels, 3, padding=1, bias=False), nn.BatchNorm2d(channels), nn.ReLU())
        self.body = nn.Sequential(*[ResidualBlock(channels) for _ in range(blocks)])
        self.policy_head = nn.Sequential(nn.Conv2d(channels, 32, 1), nn.ReLU(), nn.Flatten(), nn.Linear(32 * 64, POLICY_SIZE))
        self.value_head = nn.Sequential(
            nn.Conv2d(channels, 8, 1), nn.ReLU(), nn.Flatten(), nn.Linear(8 * 64, 64), nn.ReLU(), nn.Linear(64, 1), nn.Tanh()
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.body(self.stem(x))
        return self.policy_head(h), self.value_head(h).squeeze(-1)


def train(
    positions: list[Position],
    epochs: int = 5,
    batch_size: int = 256,
    lr: float = 1e-3,
    val_fraction: float = 0.1,
    seed: int = 0,
    channels: int = 64,
    blocks: int = 4,
) -> tuple[PolicyValueNet, list[dict[str, float]]]:
    torch.manual_seed(seed)
    random.Random(seed).shuffle(positions)
    # División por partida para no filtrar posiciones de la misma partida entre train y val.
    games = sorted({p.game_id for p in positions})
    val_games = set(games[: max(1, int(len(games) * val_fraction))]) if len(games) > 1 else set()
    train_set = PositionDataset([p for p in positions if p.game_id not in val_games])
    val_positions = [p for p in positions if p.game_id in val_games]
    val_set = PositionDataset(val_positions) if val_positions else None

    model = PolicyValueNet(channels, blocks)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    history: list[dict[str, float]] = []
    for epoch in range(epochs):
        model.train()
        total, n = 0.0, 0
        for planes, policy, value in DataLoader(train_set, batch_size=batch_size, shuffle=True):
            logits, v = model(planes)
            loss = nn.functional.cross_entropy(logits, policy) + nn.functional.mse_loss(v, value)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += loss.item() * len(policy)
            n += len(policy)
        record = {"epoch": epoch + 1, "train_loss": total / n}
        if val_set:
            record["val_top1"] = evaluate(model, val_set)
        history.append(record)
    return model, history


@torch.no_grad()
def evaluate(model: PolicyValueNet, dataset: PositionDataset) -> float:
    model.eval()
    hits = 0
    for planes, policy, _ in DataLoader(dataset, batch_size=512):
        logits, _ = model(planes)
        hits += (logits.argmax(dim=1) == policy).sum().item()
    return hits / len(dataset)


@torch.no_grad()
def predict(model: PolicyValueNet, board: chess.Board, top_k: int = 3) -> list[tuple[str, float]]:
    """Jugadas legales más probables según la red (con sus probabilidades)."""
    model.eval()
    logits, _ = model(torch.from_numpy(board_to_planes(board)).unsqueeze(0))
    mask = torch.from_numpy(legal_mask(board))
    probs = torch.softmax(logits[0].masked_fill(~mask, float("-inf")), dim=0)
    ranked = []
    for move in board.legal_moves:
        ranked.append((move.uci(), float(probs[move_to_index(move, board.turn)])))
    return sorted(ranked, key=lambda r: -r[1])[:top_k]


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--onnx", type=Path)
    args = parser.parse_args(argv)
    positions = list(read_jsonl(args.data))
    model, history = train(positions, epochs=args.epochs, batch_size=args.batch_size)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), args.out)
    if args.onnx:
        dummy = torch.zeros(1, NUM_PLANES, 8, 8)
        torch.onnx.export(model.eval(), dummy, args.onnx, input_names=["planes"], output_names=["policy", "value"])
    print(json.dumps(history))


if __name__ == "__main__":
    main()

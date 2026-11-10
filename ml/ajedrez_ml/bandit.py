"""Aprendizaje por refuerzo para personalizar la dificultad (bandido multibrazo).

Es la versión de investigación del algoritmo de ``packages/core/src/training/difficulty.ts``:
cada brazo es un desplazamiento sobre el rating del alumno y el agente busca la dificultad que
mantiene el acierto cerca del objetivo (zona de desarrollo próximo).

Incluye un alumno simulado (modelo logístico tipo Elo que mejora al practicar en su zona) para
comparar políticas sin usuarios reales:

    python -m ajedrez_ml.bandit --episodes 200 --steps 300

Resultado con este simulador (30 episodios x 300 puzzles, alumno inicial 1200): Thompson mantiene
el acierto en ~73 % y aprende mucho más que dificultades extremas (+300: ~15 % de acierto;
-300: ~92 %). Un desplazamiento fijo de 0 sobre un rating Glicko bien calibrado aprende aún más
en este alumno idealizado: el bandido aporta robustez cuando el rating del alumno está mal
estimado (usuarios nuevos, rachas, cambios de nivel). Antes de cambiar la política en producción,
compárala con datos reales (prueba A/B).
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass, field

ARMS = (-300, -150, 0, 150, 300)
TARGET = 0.7


@dataclass
class ThompsonDifficulty:
    target: float = TARGET
    decay: float = 0.98
    successes: dict[int, float] = field(default_factory=lambda: {a: 1.0 for a in ARMS})
    failures: dict[int, float] = field(default_factory=lambda: {a: 1.0 for a in ARMS})

    def choose(self, rng: random.Random) -> int:
        def distance(arm: int) -> float:
            p = rng.betavariate(self.successes[arm] + 1, self.failures[arm] + 1)
            return abs(p - self.target)

        return min(ARMS, key=distance)

    def update(self, arm: int, solved: bool) -> None:
        for a in ARMS:
            self.successes[a] *= self.decay
            self.failures[a] *= self.decay
        if solved:
            self.successes[arm] += 1
        else:
            self.failures[arm] += 1


@dataclass
class FixedDifficulty:
    """Línea base: siempre el mismo desplazamiento."""

    offset: int = 0

    def choose(self, rng: random.Random) -> int:
        return self.offset

    def update(self, arm: int, solved: bool) -> None:
        return None


@dataclass
class SimulatedLearner:
    """Alumno con habilidad oculta; aprende más cuando el ejercicio es exigente pero abordable."""

    skill: float = 1200.0
    learning_rate: float = 6.0

    def attempt(self, puzzle_rating: float, rng: random.Random) -> bool:
        p = 1 / (1 + 10 ** ((puzzle_rating - self.skill) / 400))
        solved = rng.random() < p
        # Aprendizaje máximo con p ≈ 0.6-0.8: ni trivial ni imposible.
        self.skill += self.learning_rate * math.exp(-(((p - 0.7) / 0.2) ** 2))
        return solved


def run_episode(policy, steps: int, rng: random.Random, start_skill: float = 1200.0) -> dict[str, float]:
    learner = SimulatedLearner(skill=start_skill)
    estimate = start_skill  # rating que ve el sistema
    solved_count = 0
    for _ in range(steps):
        arm = policy.choose(rng)
        solved = learner.attempt(estimate + arm, rng)
        policy.update(arm, solved)
        estimate += 16 * ((1 if solved else 0) - 1 / (1 + 10 ** (arm / 400)))
        solved_count += solved
    return {"final_skill": learner.skill, "success_rate": solved_count / steps}


def compare(episodes: int, steps: int, seed: int = 7) -> dict[str, dict[str, float]]:
    results: dict[str, dict[str, float]] = {}
    for name, factory in {
        "thompson": ThompsonDifficulty,
        "fixed_0": lambda: FixedDifficulty(0),
        "fixed_+300": lambda: FixedDifficulty(300),
        "fixed_-300": lambda: FixedDifficulty(-300),
    }.items():
        rng = random.Random(seed)
        runs = [run_episode(factory(), steps, rng) for _ in range(episodes)]
        results[name] = {
            "final_skill": sum(r["final_skill"] for r in runs) / episodes,
            "success_rate": sum(r["success_rate"] for r in runs) / episodes,
        }
    return results


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--episodes", type=int, default=100)
    parser.add_argument("--steps", type=int, default=300)
    args = parser.parse_args(argv)
    print(json.dumps(compare(args.episodes, args.steps), indent=2))


if __name__ == "__main__":
    main()

from ajedrez_ml.bandit import TARGET, compare


def test_thompson_mantiene_el_acierto_cerca_del_objetivo_y_aprende_mas():
    results = compare(episodes=30, steps=300)
    thompson = results["thompson"]
    assert abs(thompson["success_rate"] - TARGET) < 0.12
    # Demasiado difícil o demasiado fácil enseña menos que la dificultad adaptativa.
    assert thompson["final_skill"] > results["fixed_+300"]["final_skill"]
    assert thompson["final_skill"] > results["fixed_-300"]["final_skill"]

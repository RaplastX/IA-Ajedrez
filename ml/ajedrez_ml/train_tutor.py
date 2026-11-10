"""Ajuste fino de un modelo de lenguaje propio para el tutor (Hugging Face Transformers).

El servidor puede usar Claude (TUTOR_PROVIDER=anthropic) o un modelo propio servido con
Text Generation Inference (TUTOR_PROVIDER=hf-tgi). Este script entrena ese modelo propio:
un seq2seq pequeño (por defecto ``google/flan-t5-small``, Apache-2.0) que aprende a convertir
los hechos del motor en una explicación breve en español o inglés.

Datos (JSONL), una muestra por línea:
    {"locale": "es", "fen": "...", "move": "d8g5", "facts": "Tu dama en g5 queda atacada...",
     "best_line": "Nc6 Bb5", "explanation": "La dama sale demasiado pronto y ..."}

Las explicaciones deben escribirlas o revisarlas entrenadores (o generarse con un modelo
"profesor" y revisarse): sin buenos ejemplos, el modelo solo aprende a parafrasear las plantillas.

    pip install -e ".[nlp]"
    python -m ajedrez_ml.train_tutor --data data/tutor.jsonl --out artifacts/tutor-t5 --epochs 3
    # Servirlo:  docker run -p 8080:80 -v $PWD/artifacts:/data ghcr.io/huggingface/text-generation-inference \
    #            --model-id /data/tutor-t5
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROMPT_TEMPLATE = (
    "Explica la jugada al alumno en {lang}, en menos de 120 palabras.\n"
    "FEN: {fen}\nJugada: {move}\nHechos del motor: {facts}\nMejor variante: {best_line}"
)


def format_example(example: dict) -> dict[str, str]:
    """Convierte una muestra en el par (entrada, salida) que ve el modelo."""
    lang = "español" if example.get("locale", "es") == "es" else "inglés"
    return {
        "input": PROMPT_TEMPLATE.format(
            lang=lang,
            fen=example["fen"],
            move=example["move"],
            facts=example.get("facts", ""),
            best_line=example.get("best_line", ""),
        ),
        "target": example["explanation"].strip(),
    }


def load_examples(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as fh:
        return [format_example(json.loads(line)) for line in fh if line.strip()]


def train(data: Path, out: Path, base_model: str = "google/flan-t5-small", epochs: int = 3, lr: float = 3e-4) -> None:
    # Importaciones perezosas: Transformers solo hace falta para entrenar.
    from datasets import Dataset
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForSeq2SeqLM.from_pretrained(base_model)
    examples = load_examples(data)
    split = Dataset.from_list(examples).train_test_split(test_size=0.1, seed=0)

    def tokenize(batch):
        enc = tokenizer(batch["input"], max_length=384, truncation=True)
        enc["labels"] = tokenizer(text_target=batch["target"], max_length=192, truncation=True)["input_ids"]
        return enc

    tokenized = split.map(tokenize, batched=True, remove_columns=["input", "target"])
    args = Seq2SeqTrainingArguments(
        output_dir=str(out),
        num_train_epochs=epochs,
        learning_rate=lr,
        per_device_train_batch_size=8,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        predict_with_generate=True,
        report_to=[],
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["test"],
        data_collator=DataCollatorForSeq2Seq(tokenizer, model=model),
    )
    trainer.train()
    trainer.save_model(str(out))
    tokenizer.save_pretrained(str(out))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--base-model", default="google/flan-t5-small")
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args(argv)
    train(args.data, args.out, args.base_model, args.epochs)


if __name__ == "__main__":
    main()

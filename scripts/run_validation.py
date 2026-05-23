#!/usr/bin/env python3
"""CLI entry point for running the full validation pipeline."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

# .env overrides system env so learning defaults (mock) always apply locally
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

# Allow running without pip install -e .
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import typer
from ai_validator.runner import ValidationRunner

app = typer.Typer(help="Validate AI/RAG applications with Ragas, DeepEval, and Langfuse")


@app.command()
def run(
    evaluator: str = typer.Option(
        "auto",
        help="Evaluator backend: auto, mock, ragas, or deepeval",
    ),
) -> None:
    """Run golden dataset through RAG pipeline and evaluate."""
    runner = ValidationRunner()
    report = runner.run(evaluator_backend=evaluator)  # type: ignore[arg-type]
    raise typer.Exit(code=0 if report.gate_passed else 1)


@app.command()
def demo() -> None:
    """Quick demo: single question through the RAG pipeline."""
    from rich.console import Console
    from rich.panel import Panel

    from ai_validator.app.rag_pipeline import RAGPipeline

    console = Console()
    pipeline = RAGPipeline()
    question = "What is RAG and why is it used?"

    console.print(Panel(f"[bold]Question:[/bold] {question}", title="RAG Demo"))
    result = pipeline.query(question)

    console.print(f"\n[bold]Retrieved contexts:[/bold] {len(result.retrieved_contexts)} chunks")
    for i, ctx in enumerate(result.retrieved_contexts, 1):
        console.print(f"  {i}. {ctx[:120]}...")

    console.print(f"\n[bold]Answer:[/bold]\n{result.answer}")
    console.print(f"\n[dim]Latency: {result.latency_ms:.1f}ms[/dim]")


if __name__ == "__main__":
    app()

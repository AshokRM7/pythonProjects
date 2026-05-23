"""Golden dataset — ground truth for regression testing your AI app."""

from __future__ import annotations

from ai_validator.models import RAGTestCase

GOLDEN_DATASET: list[RAGTestCase] = [
    RAGTestCase(
        id="tc-001",
        question="What is RAG and why is it used?",
        expected_answer=(
            "RAG combines retrieval with generation to ground answers in documents "
            "and reduce hallucinations."
        ),
        expected_contexts=[
            "Retrieval-Augmented Generation (RAG) combines an information retrieval "
            "component with a text generator."
        ],
        tags=["rag", "basics"],
    ),
    RAGTestCase(
        id="tc-002",
        question="What metrics does Ragas provide for RAG evaluation?",
        expected_answer=(
            "Ragas provides faithfulness, answer relevancy, context precision, "
            "and context recall."
        ),
        expected_contexts=[
            "Ragas is an open-source framework for evaluating RAG pipelines."
        ],
        tags=["ragas", "metrics"],
    ),
    RAGTestCase(
        id="tc-003",
        question="How does DeepEval help with CI/CD for AI apps?",
        expected_answer=(
            "DeepEval provides pytest-style test cases and metrics for quality gates."
        ),
        expected_contexts=[
            "DeepEval is an LLM evaluation framework that provides pytest-style test cases"
        ],
        tags=["deepeval", "cicd"],
    ),
    RAGTestCase(
        id="tc-004",
        question="What is Langfuse used for in LLM applications?",
        expected_answer=(
            "Langfuse provides tracing, monitoring, and evaluation for LLM apps."
        ),
        expected_contexts=[
            "Langfuse is an open-source LLM engineering platform for tracing"
        ],
        tags=["langfuse", "observability"],
    ),
    RAGTestCase(
        id="tc-005",
        question="What are best practices for validating AI applications?",
        expected_answer=(
            "Use golden datasets, metric thresholds, observability, and CI/CD regression tests."
        ),
        expected_contexts=[
            "Production AI apps need automated validation: golden datasets"
        ],
        tags=["validation", "best-practices"],
    ),
    RAGTestCase(
        id="tc-006",
        question="Who created Python and when was it released?",
        expected_answer="Python was created by Guido van Rossum and released in 1991.",
        expected_contexts=["Python is a high-level programming language created by Guido van Rossum"],
        tags=["python", "basics"],
    ),
]


def get_golden_dataset() -> list[RAGTestCase]:
    return list(GOLDEN_DATASET)

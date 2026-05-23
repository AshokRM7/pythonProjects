"""DeepEval pytest-style tests — run with: deepeval test run tests/test_deepeval_rag.py"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

# Skip DeepEval LLM tests in mock mode
pytestmark = pytest.mark.skipif(
    os.getenv("OPENAI_API_KEY", "mock").lower() in ("mock", "test", "none", ""),
    reason="Requires real OPENAI_API_KEY for DeepEval LLM-as-judge metrics",
)


def test_rag_faithfulness():
    from deepeval import assert_test
    from deepeval.metrics import FaithfulnessMetric
    from deepeval.test_case import LLMTestCase

    from ai_validator.app.rag_pipeline import RAGPipeline
    from ai_validator.datasets.golden_dataset import get_golden_dataset

    pipeline = RAGPipeline()
    test_case_data = get_golden_dataset()[0]
    run = pipeline.run_test_case(test_case_data)

    test_case = LLMTestCase(
        input=run.question,
        actual_output=run.answer,
        retrieval_context=run.retrieved_contexts,
    )
    metric = FaithfulnessMetric(threshold=0.5)
    assert_test(test_case, [metric])

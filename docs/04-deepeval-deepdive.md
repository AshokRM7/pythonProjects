# Lesson 4: DeepEval — Pytest for LLMs

[DeepEval](https://deepeval.com/) treats LLM outputs like **unit test assertions**.

## Core object: LLMTestCase

```python
from deepeval.test_case import LLMTestCase

test_case = LLMTestCase(
    input="What is RAG?",
    actual_output=pipeline_answer,
    expected_output="Retrieval augmented generation...",
    retrieval_context=["chunk1", "chunk2"],
)
```

## Metrics

```python
from deepeval.metrics import FaithfulnessMetric, AnswerRelevancyMetric

metric = FaithfulnessMetric(threshold=0.7)
metric.measure(test_case)
print(metric.score, metric.reason)
```

DeepEval uses an **LLM-as-judge** to score outputs — explainable via `metric.reason`.

## Pytest integration

See `tests/test_deepeval_rag.py`:

```bash
deepeval test run tests/test_deepeval_rag.py
```

This fits naturally into CI: failed metric = failed build.

## DeepEval vs Ragas

| | Ragas | DeepEval |
|---|-------|----------|
| Focus | RAG research metrics | General LLM testing |
| Style | Batch `evaluate()` | Pytest + `assert_test` |
| Custom metrics | Limited | G-Eval (describe criteria in English) |
| CI | External script | Native pytest |

## Run DeepEval mode

```bash
set OPENAI_API_KEY=sk-your-key
python scripts/run_validation.py run --evaluator deepeval
```

Next: [05-langfuse-observability.md](05-langfuse-observability.md)

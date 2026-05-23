# Lesson 2: Framework Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR AI APPLICATION                          │
│  src/ai_validator/app/rag_pipeline.py                           │
│  Retriever → LLM Generator → answer + contexts                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GOLDEN DATASET                               │
│  src/ai_validator/datasets/golden_dataset.py                    │
│  question, expected_answer, expected_contexts                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │   Ragas    │   │  DeepEval  │   │   Mock     │
   │ evaluator  │   │ evaluator  │   │ evaluator  │
   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
         │                │                │
         └────────────────┼────────────────┘
                          ▼
              ┌───────────────────────┐
              │    Quality Gate       │
              │  gates/quality_gate.py│
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  CI/CD (GitHub Actions)│
              └───────────────────────┘

Parallel track:
  observability/langfuse_tracer.py → Langfuse dashboard
```

## File map (what to read in order)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `app/sample_knowledge.py` | Fake "vector DB" documents |
| 2 | `app/rag_pipeline.py` | The AI app you are testing |
| 3 | `datasets/golden_dataset.py` | Ground-truth test cases |
| 4 | `evaluators/mock_evaluator.py` | Learn metrics without API keys |
| 5 | `evaluators/ragas_evaluator.py` | Research-backed RAG metrics |
| 6 | `evaluators/deepeval_evaluator.py` | Pytest-style LLM tests |
| 7 | `observability/langfuse_tracer.py` | Production tracing |
| 8 | `gates/quality_gate.py` | Pass/fail for CI |
| 9 | `runner.py` | Orchestrates everything |

## Data flow

1. `ValidationRunner` loads golden test cases
2. For each case, `RAGPipeline.run_test_case()` produces `RAGRunResult`
3. Evaluator compares run output to ground truth → `EvaluationResult`
4. `QualityGate` checks aggregate scores vs thresholds
5. Optional: scores pushed to Langfuse

Next: [03-ragas-deepdive.md](03-ragas-deepdive.md)

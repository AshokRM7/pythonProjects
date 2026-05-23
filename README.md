# AI Validation Framework

A **hands-on learning project** for automating validation of AI/RAG applications using Python, **Ragas**, **DeepEval**, and **Langfuse**.

You get a working RAG demo app, a golden test dataset, three evaluator backends, quality gates for CI/CD, and a 5-lesson tutorial in `docs/`.

## Quick start (no API keys)

```powershell
cd c:\MyFolders\Projects\Cursor_Learning
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e .

# Single-question demo
python scripts/run_validation.py demo

# Full validation run (mock metrics — free, instant)
python scripts/run_validation.py run

# Quality gate (exits 1 on failure — for CI)
python scripts/run_quality_gate.py

# Unit tests
pytest tests/test_framework.py -v
```

Mock mode uses `OPENAI_API_KEY=mock` (default in `.env`). The full pipeline runs end-to-end without calling OpenAI.

## Live evaluation (Ragas / DeepEval)

```powershell
copy .env.example .env
# Edit .env: set OPENAI_API_KEY=sk-...

python scripts/run_validation.py run --evaluator ragas
python scripts/run_validation.py run --evaluator deepeval
deepeval test run tests/test_deepeval_rag.py
```

## Learning path

Read in order:

1. [Why validate AI apps?](docs/01-why-validate-ai.md)
2. [Framework architecture](docs/02-architecture.md)
3. [Ragas metrics deep dive](docs/03-ragas-deepdive.md)
4. [DeepEval pytest tests](docs/04-deepeval-deepdive.md)
5. [Langfuse observability](docs/05-langfuse-observability.md)

## What this framework teaches

### The validation loop

```
Golden Dataset  →  Run AI App  →  Score Metrics  →  Quality Gate  →  CI/CD
                         ↓
                  Langfuse traces (optional)
```

### Three evaluator backends

| Backend | When to use | API key? |
|---------|-------------|----------|
| `mock` | Learn the pipeline, local dev, CI without cost | No |
| `ragas` | Research-backed RAG metrics, batch benchmarks | Yes |
| `deepeval` | Pytest-style tests, G-Eval custom criteria | Yes |

### Key metrics (0.0 – 1.0)

- **Faithfulness** — Is the answer grounded in retrieved context? (hallucination check)
- **Answer relevancy** — Does the answer address the question?
- **Context precision** — Did the retriever fetch the right documents?

Thresholds are configured in `.env`:

```
GATE_FAITHFULNESS_MIN=0.70
GATE_ANSWER_RELEVANCY_MIN=0.70
GATE_CONTEXT_PRECISION_MIN=0.60
```

## Project structure

```
src/ai_validator/
├── app/                    # Sample RAG app (the thing you validate)
│   ├── rag_pipeline.py
│   └── sample_knowledge.py
├── datasets/
│   └── golden_dataset.py   # Ground-truth test cases
├── evaluators/
│   ├── mock_evaluator.py   # Rule-based (no API)
│   ├── ragas_evaluator.py  # Ragas integration
│   └── deepeval_evaluator.py
├── observability/
│   └── langfuse_tracer.py  # Optional tracing
├── gates/
│   └── quality_gate.py     # CI pass/fail
├── runner.py               # Orchestrator
└── config.py               # Settings from .env

scripts/
├── run_validation.py       # CLI
└── run_quality_gate.py     # CI script

tests/
├── test_framework.py       # Always runs (mock)
└── test_deepeval_rag.py    # DeepEval (needs API key)
```

## Exercises (try these yourself)

1. **Add a test case** — Edit `golden_dataset.py` with a new question. Run validation and see scores change.

2. **Break the retriever** — In `rag_pipeline.py`, set `top_k=0` or return empty contexts. Watch faithfulness drop.

3. **Tighten the gate** — Set `GATE_FAITHFULNESS_MIN=0.99` in `.env`. Run quality gate and see CI fail.

4. **Switch to live Ragas** — Add your OpenAI key and compare mock vs Ragas scores on the same dataset.

5. **Add Langfuse** — Sign up at [langfuse.com](https://langfuse.com), add keys to `.env`, re-run and inspect traces.

6. **Custom DeepEval metric** — Add a G-Eval metric for "answer must mention citations" in `test_deepeval_rag.py`.

## How CI uses this

`.github/workflows/ai-validation.yml` runs:

1. Unit tests in mock mode
2. Quality gate script (fails PR if metrics below threshold)

Wire the same pattern into your real project:

```yaml
- run: python scripts/run_quality_gate.py
```

## Extending to your own AI app

Replace `RAGPipeline` with your app — keep the same interface:

```python
# Your app must return RAGRunResult for each test case
result = RAGRunResult(
    test_case_id="...",
    question="...",
    answer="...",
    retrieved_contexts=["chunk1", "chunk2"],
)
```

Then pass your pipeline to `ValidationRunner(pipeline=YourPipeline())`.

## License

MIT — use freely for learning and production.

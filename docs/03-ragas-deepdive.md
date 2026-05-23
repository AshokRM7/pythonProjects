# Lesson 3: Ragas — RAG-Specific Metrics

[Ragas](https://docs.ragas.io/) measures **retriever** and **generator** quality separately.

## Metrics used in this framework

| Metric | What it measures | Needs ground truth? |
|--------|------------------|---------------------|
| **Faithfulness** | Is the answer supported by retrieved context? | No |
| **Answer relevancy** | Does the answer address the question? | No |
| **Context precision** | Are retrieved chunks relevant to the question? | Yes (reference contexts) |

## How faithfulness works (intuition)

1. LLM extracts **claims** from the generated answer
2. LLM checks each claim against retrieved context
3. Score = fraction of claims supported

This catches hallucinations like inventing a release date not in your docs.

## Code path

See `src/ai_validator/evaluators/ragas_evaluator.py`:

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(dataset, metrics=[...], llm=..., embeddings=...)
```

## When to use Ragas

- Benchmarking RAG pipeline changes
- Comparing models (see Ragas docs on LLM comparison)
- Batch evaluation across many test cases

## Run Ragas mode

```bash
# Requires OPENAI_API_KEY (not mock)
set OPENAI_API_KEY=sk-your-key
python scripts/run_validation.py run --evaluator ragas
```

Next: [04-deepeval-deepdive.md](04-deepeval-deepdive.md)

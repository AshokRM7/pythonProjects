# Lesson 5: Langfuse — Observability + Evaluation

Offline evaluation (Ragas/DeepEval) runs on a **golden dataset**. Production users ask **unseen questions**. Langfuse bridges both worlds.

## What Langfuse captures

- **Traces**: Full request lifecycle (input → retrieval → generation → output)
- **Scores**: Evaluation metrics attached to traces
- **Latency & cost**: Per-request performance

## Pattern: external evaluation pipeline

```
Production app → Langfuse (traces)
                      ↓
              Your eval script (this framework)
                      ↓
              langfuse.create_score(trace_id, name, value)
```

See `src/ai_validator/observability/langfuse_tracer.py`.

## Setup

1. Create free account at https://langfuse.com
2. Copy keys to `.env`:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

3. Run validation — scores appear on traces in the Langfuse UI

## Why this matters

- **Debug** bad answers by inspecting retrieval context in the trace
- **Compare** evaluation scores across deployments
- **Alert** when production faithfulness drops below threshold

## Without Langfuse

The framework runs fully without Langfuse keys. Tracing is simply disabled.

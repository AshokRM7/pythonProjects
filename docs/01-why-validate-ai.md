# Lesson 1: Why Validate AI Applications?

Traditional software has **deterministic** outputs: `2 + 2` always equals `4`. LLM applications are **probabilistic**: the same prompt can produce different answers, and models can **hallucinate** facts not in your data.

## The problem

| Traditional app | AI / RAG app |
|-----------------|--------------|
| Unit tests on functions | Answers vary run-to-run |
| Fixed API contracts | Retrieval may miss documents |
| Binary pass/fail | "Good enough" is subjective |

## What can go wrong in a RAG app

1. **Retriever** returns irrelevant chunks → wrong context
2. **Generator** ignores context → hallucination
3. **Generator** answers off-topic → low relevancy
4. **Latency/cost** spikes in production → no one notices until the bill arrives

## The solution: layered validation

```
Golden Dataset → Run AI App → Score with Metrics → Quality Gate → CI/CD
                      ↓
                 Langfuse Traces (production observability)
```

This framework implements each layer so you can learn by running real code.

## Key concepts

- **Golden dataset**: Questions + expected answers + expected contexts (ground truth)
- **Metrics**: Automated scores (0–1) for faithfulness, relevancy, precision
- **Quality gate**: Minimum thresholds; CI fails if scores drop
- **Observability**: Langfuse traces link production runs to evaluation scores

Next: [02-architecture.md](02-architecture.md)

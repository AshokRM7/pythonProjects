"""Sample knowledge base — the 'documents' our demo RAG app retrieves from."""

DOCUMENTS: list[dict[str, str]] = [
    {
        "id": "doc-001",
        "title": "Python Basics",
        "content": (
            "Python is a high-level programming language created by Guido van Rossum "
            "and first released in 1991. It emphasizes code readability with "
            "significant indentation. Python supports multiple paradigms including "
            "procedural, object-oriented, and functional programming."
        ),
    },
    {
        "id": "doc-002",
        "title": "RAG Overview",
        "content": (
            "Retrieval-Augmented Generation (RAG) combines an information retrieval "
            "component with a text generator. The retriever fetches relevant documents "
            "from a knowledge base, and the generator produces answers grounded in "
            "those documents. RAG reduces hallucinations compared to pure LLM generation."
        ),
    },
    {
        "id": "doc-003",
        "title": "Ragas Metrics",
        "content": (
            "Ragas is an open-source framework for evaluating RAG pipelines. Key metrics "
            "include faithfulness (is the answer supported by context?), answer relevancy "
            "(does the answer address the question?), context precision (are retrieved "
            "chunks relevant?), and context recall (did we retrieve all needed info?)."
        ),
    },
    {
        "id": "doc-004",
        "title": "DeepEval",
        "content": (
            "DeepEval is an LLM evaluation framework that provides pytest-style test "
            "cases for AI applications. It includes metrics like G-Eval for custom "
            "criteria, hallucination detection, and integrates with Ragas metrics. "
            "DeepEval is designed for CI/CD quality gates."
        ),
    },
    {
        "id": "doc-005",
        "title": "Langfuse Observability",
        "content": (
            "Langfuse is an open-source LLM engineering platform for tracing, "
            "monitoring, and evaluating AI applications. It captures inputs, outputs, "
            "latency, and costs. External evaluation pipelines can push scores back "
            "to Langfuse traces for production monitoring."
        ),
    },
    {
        "id": "doc-006",
        "title": "AI Validation Best Practices",
        "content": (
            "Production AI apps need automated validation: golden datasets with "
            "expected answers, metric thresholds as quality gates, observability for "
            "production traces, and regression testing in CI/CD. Combine offline "
            "evaluation (Ragas/DeepEval) with online monitoring (Langfuse)."
        ),
    },
]

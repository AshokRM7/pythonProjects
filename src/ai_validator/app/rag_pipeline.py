"""Demo RAG pipeline — the AI application we validate against."""

from __future__ import annotations

import re
import time
from typing import Protocol

from ai_validator.app.sample_knowledge import DOCUMENTS
from ai_validator.config import Settings, get_settings
from ai_validator.models import RAGRunResult, RAGTestCase


class LLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


class MockLLM:
    """Deterministic LLM for learning without API keys."""

    def generate(self, prompt: str) -> str:
        context_match = re.search(r"Context:\n(.*?)\n\nQuestion:", prompt, re.DOTALL)
        question_match = re.search(r"Question: (.*?)\n\nAnswer:", prompt, re.DOTALL)
        context = context_match.group(1).strip() if context_match else ""
        question = question_match.group(1).strip() if question_match else ""

        if not context:
            return "I don't have enough information to answer that question."

        first_sentence = context.split(".")[0].strip() + "."
        return f"Based on the provided context: {first_sentence} This addresses: {question}"


class OpenAILLM:
    def __init__(self, settings: Settings) -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model

    def generate(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return response.choices[0].message.content or ""


def create_llm(settings: Settings | None = None) -> LLMClient:
    settings = settings or get_settings()
    if settings.is_mock_mode:
        return MockLLM()
    return OpenAILLM(settings)


_STOPWORDS = frozenset(
    {"a", "an", "the", "is", "are", "what", "how", "why", "when", "who",
     "and", "or", "it", "in", "on", "to", "of", "for", "with", "does", "do"}
)


class SimpleRetriever:
    """Keyword retriever — intentionally simple so you can see failures."""

    def __init__(self, documents: list[dict[str, str]] | None = None) -> None:
        self.documents = documents or DOCUMENTS

    def retrieve(self, query: str, top_k: int = 2) -> list[str]:
        query_terms = {
            t for t in re.findall(r"\w+", query.lower()) if t not in _STOPWORDS and len(t) > 2
        }
        if not query_terms:
            query_terms = set(re.findall(r"\w+", query.lower()))

        scored: list[tuple[float, str]] = []
        for doc in self.documents:
            title_terms = set(re.findall(r"\w+", doc["title"].lower()))
            content_terms = set(re.findall(r"\w+", doc["content"].lower()))
            title_overlap = len(query_terms & title_terms)
            content_overlap = len(query_terms & content_terms)
            score = title_overlap * 2 + content_overlap
            if score > 0:
                scored.append((score / max(len(query_terms), 1), doc["content"]))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [content for _, content in scored[:top_k]]


class RAGPipeline:
    """End-to-end RAG: retrieve context → generate answer."""

    def __init__(
        self,
        llm: LLMClient | None = None,
        retriever: SimpleRetriever | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm = llm or create_llm(self.settings)
        self.retriever = retriever or SimpleRetriever()

    def _build_prompt(self, question: str, contexts: list[str]) -> str:
        context_block = "\n\n".join(contexts) if contexts else "No context available."
        return (
            "Answer the question using ONLY the context below. "
            "If the context is insufficient, say so.\n\n"
            f"Context:\n{context_block}\n\n"
            f"Question: {question}\n\n"
            "Answer:"
        )

    def query(self, question: str, top_k: int = 2) -> RAGRunResult:
        start = time.perf_counter()
        contexts = self.retriever.retrieve(question, top_k=top_k)
        prompt = self._build_prompt(question, contexts)
        answer = self.llm.generate(prompt)
        latency_ms = (time.perf_counter() - start) * 1000

        return RAGRunResult(
            test_case_id="",
            question=question,
            answer=answer,
            retrieved_contexts=contexts,
            latency_ms=latency_ms,
        )

    def run_test_case(self, test_case: RAGTestCase) -> RAGRunResult:
        result = self.query(test_case.question)
        result.test_case_id = test_case.id
        return result

import os
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import SentenceTransformerEmbeddings

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
VECTOR_INDEX_DIR = os.path.join(DATA_DIR, "vector_index")

_vectorstore = None

def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        if not os.path.exists(VECTOR_INDEX_DIR):
            print(f"Vector index not found at {VECTOR_INDEX_DIR}. Please run ingest.py first.")
            return None
        
        print(f"Loading FAISS index from {VECTOR_INDEX_DIR}...")
        embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        _vectorstore = FAISS.load_local(VECTOR_INDEX_DIR, embeddings, allow_dangerous_deserialization=True)
    return _vectorstore

def get_policy_context(question: str, top_k: int = 4) -> str:
    """
    Given a natural language question about IAM,
    returns a concatenated string of the top-k relevant text chunks.
    """
    vs = get_vectorstore()
    if not vs:
        return "No policy context available (Index not found)."

    docs = vs.similarity_search(question, k=top_k)
    context_parts = [f"--- SOURCE: {d.metadata.get('source', 'Unknown')} ---\n{d.page_content}" for d in docs]
    return "\n\n".join(context_parts)

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
import yaml
import os
from fastapi import APIRouter

router = APIRouter(prefix="/rag", tags=["RAG"])

def load_config():
    with open("app/config.yaml", "r") as f:
        return yaml.safe_load(f)

config = load_config()
INDEX_DIR = config['rag']['index_path']

embeddings = OpenAIEmbeddings()
vectorstore = None

def get_vectorstore():
    global vectorstore
    if vectorstore is None:
        if os.path.exists(INDEX_DIR):
            vectorstore = FAISS.load_local(INDEX_DIR, embeddings, allow_dangerous_deserialization=True)
        else:
            print("Index not found. Please build it first.")
            return None
    return vectorstore

def retrieve(query: str, top_k: int = 3):
    vs = get_vectorstore()
    if not vs:
        return []
    docs = vs.similarity_search(query, k=top_k)
    return [doc.page_content for doc in docs]

@router.post("/rebuild")
async def rebuild_index():
    from app.rag.ingest import build_index
    build_index()
    
    # Reload vectorstore
    global vectorstore
    if os.path.exists(INDEX_DIR):
        vectorstore = FAISS.load_local(INDEX_DIR, embeddings, allow_dangerous_deserialization=True)
        
    return {"status": "success", "message": "Index rebuilt"}

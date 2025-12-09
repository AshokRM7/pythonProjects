import os
import glob
from typing import List
from langchain_community.document_loaders import TextLoader, PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import SentenceTransformerEmbeddings

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
POLICIES_DIR = os.path.join(DATA_DIR, "policies")
VECTOR_INDEX_DIR = os.path.join(DATA_DIR, "vector_index")

def load_documents() -> List:
    documents = []
    # Load .txt files
    for txt_file in glob.glob(os.path.join(POLICIES_DIR, "*.txt")):
        loader = TextLoader(txt_file, encoding="utf-8")
        documents.extend(loader.load())
    
    # Load .pdf files
    for pdf_file in glob.glob(os.path.join(POLICIES_DIR, "*.pdf")):
        loader = PyMuPDFLoader(pdf_file)
        documents.extend(loader.load())
        
    return documents

def build_index():
    print(f"Loading policies from {POLICIES_DIR}...")
    documents = load_documents()
    if not documents:
        print("No policy documents found. Skipping index creation.")
        return

    print(f"Loaded {len(documents)} documents. Splitting...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    texts = text_splitter.split_documents(documents)
    print(f"Created {len(texts)} chunks.")

    print("Initializing embeddings (all-MiniLM-L6-v2)...")
    embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")

    print("Building FAISS index...")
    vectorstore = FAISS.from_documents(texts, embeddings)

    print(f"Saving index to {VECTOR_INDEX_DIR}...")
    vectorstore.save_local(VECTOR_INDEX_DIR)
    print("Index built successfully.")

if __name__ == "__main__":
    build_index()

import os
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import yaml

def load_config():
    with open("app/config.yaml", "r") as f:
        return yaml.safe_load(f)

config = load_config()

DATA_DIR = "app/data/policies"
INDEX_DIR = config['rag']['index_path']

def build_index():
    print("Building FAISS index...")
    documents = []
    
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
         print(f"Directory {DATA_DIR} does not exist.")
         return

    for file in os.listdir(DATA_DIR):
        if file.endswith(".txt"):
            loader = TextLoader(os.path.join(DATA_DIR, file))
            documents.extend(loader.load())
            
    if not documents:
        print("No documents found for indexing.")
        return

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=config['rag']['chunk_size'],
        chunk_overlap=config['rag']['chunk_overlap']
    )
    texts = text_splitter.split_documents(documents)
    
    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(texts, embeddings)
    
    vectorstore.save_local(INDEX_DIR)
    print(f"FAISS index saved to {INDEX_DIR}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    build_index()

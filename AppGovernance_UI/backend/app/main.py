from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yaml
import os
from dotenv import load_dotenv

# Load env vars
load_dotenv()
# Also load from backend/.env if it exists (though user instructions implied root or backend/.env)
load_dotenv(".env")

def load_config():
    with open("app/config.yaml", "r") as f:
        return yaml.safe_load(f)

config = load_config()

app = FastAPI(
    title=config['app']['title'],
    version=config['app']['version']
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "IAM Agentic Demo API is running", "docs": "/docs", "health": "/health"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Import routers
from app.mock_systems import rise, jira, apphq, mail
from app.agent import orchestrator
from app.rag import retriever

# Include routers
app.include_router(rise.router)
app.include_router(jira.router)
app.include_router(apphq.router)
app.include_router(mail.router)
app.include_router(orchestrator.router)
app.include_router(retriever.router)

@app.on_event("startup")
async def startup_event():
    # Build RAG index if not exists
    from app.rag.ingest import build_index
    import os
    if not os.path.exists(config['rag']['index_path']):
        build_index()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config['app']['host'], port=config['app']['port'])

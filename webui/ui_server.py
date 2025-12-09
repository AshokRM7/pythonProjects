
from fastapi import FastAPI, Request, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import requests
import yaml
from dotenv import load_dotenv
from agentic_bot.agents.iam_agent import IamAgent

load_dotenv()

app = FastAPI(title="Agentic IAM Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    cfg = load_config()
    base_url = cfg["mock_server"]["base_url"]
    try:
        resp = requests.get(f"{base_url}/rise/tickets")
        tickets = resp.json()
    except Exception:
        tickets = []
    return templates.TemplateResponse("index.html", {"request": request, "tickets": tickets, "base_url": base_url})

@app.post("/api/draft_email")
async def draft_email_endpoint(data: dict = Body(...)):
    ticket = data.get("ticket")
    owners = data.get("owners")
    
    # Initialize agent (it loads config internally)
    agent = IamAgent()
    
    # Use the agent's logic
    draft = agent.draft_email(ticket, owners)
    
    return JSONResponse({"draft": draft})

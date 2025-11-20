
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path
import requests
import yaml

app = FastAPI(title="Agentic IAM Dashboard")
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

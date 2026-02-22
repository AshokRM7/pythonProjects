# App Governance - Combined Application

A unified application combining a React frontend with signin functionality and a Python backend powered by LangChain agents for intelligent ticket processing.

## 🏗️ Architecture

```
App_Governance_Combined/
├── .env                   # Environment variables
├── .env.example           # Example environment file
├── .gitignore             # Git ignore rules
├── requirements.txt       # Python dependencies
├── start_app.bat          # Startup script
├── README.md              # Documentation
│
├── config/                # Configuration files
│   ├── config.json        # Application configuration
│   └── loader.py          # Config loader (legacy)
│
├── data/                  # Data files
│   ├── ticket_data.json   # Sample ticket data
│   └── apphq_data.json    # AppHQ ownership data
│
├── backend/               # Python FastAPI + LangChain
│   ├── __init__.py
│   ├── api_server.py      # Real mode API server
│   ├── demo_api_server.py # Demo mode API server
│   │
│   ├── core/              # Core business logic
│   │   ├── __init__.py
│   │   ├── orchestrator.py    # Agent pipeline orchestrator
│   │   └── config.py          # Configuration loader
│   │
│   ├── agents/            # LangChain agent implementations
│   │   ├── __init__.py
│   │   ├── ticket_fetcher.py
│   │   ├── category_checker.py
│   │   ├── sla_prioritizer.py
│   │   ├── apphq_portal.py
│   │   ├── app_owner_check.py
│   │   ├── evidence_collector.py
│   │   ├── human_approval.py
│   │   ├── closer.py
│   │   └── logger.py
│   │
│   └── models/            # Pydantic data models
│       ├── __init__.py
│       ├── ticket_context.py
│       └── app_context.py
│
└── frontend/              # React + Vite application
    ├── src/
    │   ├── components/
    │   │   ├── SignIn.tsx      # Authentication page
    │   │   ├── Home.tsx        # Main ticket dashboard
    │   │   ├── Header.tsx      # App header
    │   │   └── Footer.tsx      # App footer
    │   ├── App.tsx             # Main React app with routing
    │   └── main.tsx            # React entry point
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

## 🚀 Features

- **Professional Signin Page**: Beautiful, modern authentication UI
- **Real-time Updates**: WebSocket-based live ticket processing updates
- **8-Stage Agent Pipeline**:
  1. Ticket Fetching
  2. Category Check (IAM filtering)
  3. SLA Prioritization
  4. Ownership Enrichment
  5. App Owner Check
  6. Evidence Collection
  7. Ticket Closure
  8. Logging
- **Interactive Dashboard**: View and manage tickets with live progress tracking

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js 16+** and npm
- **OpenAI API Key** (via OpenRouter) - Get from https://openrouter.ai/

## 🔧 Installation

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate  # On Windows
# source .venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
copy .env.example .env  # On Windows
# cp .env.example .env  # On macOS/Linux

# Edit .env and add your API key
# OPENAI_API_KEY=your_actual_api_key_here
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

## ▶️ Running the Application

### Option 1: Run Both Servers Separately

**Terminal 1 - Backend:**
```bash
# Run from project root directory
python -m backend.api_server
# Server will start on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Server will start on http://localhost:5173
```

### Option 2: Use Startup Script (Windows)

```bash
# From project root
start_app.bat
```

## 🎯 Usage

1. **Open Browser**: Navigate to http://localhost:5173
2. **Create User**: Click "Create New User" and enter a username
3. **Sign In**: Use your username to sign in
4. **View Tickets**: See the ticket dashboard
5. **Start Processing**: Click "Start Processing" to trigger the agent pipeline
6. **Watch Progress**: See real-time updates as agents process each ticket through all 8 stages

## 🔌 API Endpoints

- `GET /` - Health check
- `GET /api/tickets` - Get all tickets
- `POST /api/tickets/process` - Start processing all tickets
- `GET /api/tickets/{ticket_id}` - Get specific ticket
- `WS /ws` - WebSocket for real-time updates

## 🧪 Testing

### Test Backend API
```bash
# Health check
curl http://localhost:8000/

# Get tickets
curl http://localhost:8000/api/tickets

# Start processing
curl -X POST http://localhost:8000/api/tickets/process
```

### Test WebSocket
Open browser console and run:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

## 🛠️ Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- React Router
- Radix UI Components
- Lucide Icons
- TailwindCSS

**Backend:**
- Python 3.8+
- FastAPI
- LangChain
- OpenAI (via OpenRouter)
- WebSockets
- Pydantic

## 📝 Notes

- The application requires an active OpenAI API key to run the LangChain agents
- Tickets are processed through a multi-stage pipeline with real-time updates
- User authentication is stored in browser localStorage (for demo purposes)
- WebSocket connection provides live updates during ticket processing

## 📧 SMTP Email Configuration

The application supports sending real emails for evidence collection. By default, it runs in **simulation mode**.

### 1. Enable Real Sending
In your `.env` file, set:
```env
EMAIL_SENDING_ENABLED=true
```

### 2. Configure SMTP Credentials
Add your SMTP server details to `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

> [!TIP]
> **For Gmail**: You must use an **App Password**. Regular passwords will not work due to security restrictions.
> 1. Enable 2-Factor Authentication on your Google Account.
> 2. Search for "App Passwords" in Google Account settings.
> 3. Create a new app password for "Other (Custom Name)" named "IAM Governance Demo".

## 🐛 Troubleshooting

**Backend won't start:**
- Check if `.env` file exists with valid `OPENAI_API_KEY`
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check if port 8000 is already in use

**Frontend won't start:**
- Verify Node.js is installed: `node --version`
- Install dependencies: `npm install`
- Check if port 5173 is already in use

**WebSocket connection fails:**
- Ensure backend is running on port 8000
- Check browser console for connection errors
- Verify CORS settings in `api_server.py`

## 📄 License

This is a proof-of-concept application for demonstration purposes.

#DEMO Mode: (if dont have an API key)
  - python -m backend.demo_api_server
  - cd UI && npm run dev

#Real mode with Agents (have API key)
  - python -m backend.api_server
  - cd UI && npm run dev


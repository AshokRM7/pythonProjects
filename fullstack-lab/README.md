# Fullstack Lab — learn by building

A project built step by step to deeply understand backend, frontend, APIs,
and later GenAI apps / agents / eval frameworks — all on the same foundation.

**Rule of this repo:** we never move to the next step until the current one
is understood. Every step has code + a concept doc in `docs/`.

## Project layout

```
fullstack-lab/
├── backend/            # Python + FastAPI + uvicorn  (serves DATA on :8000)
│   ├── .venv/          # isolated Python environment (never edit, never commit)
│   ├── main.py         # the API — start reading here
│   └── requirements.txt
├── frontend/           # React + Vite               (serves the UI on :5173)
│   ├── node_modules/   # installed JS packages (never edit, never commit)
│   ├── index.html      # the single HTML page React renders into
│   ├── package.json    # JS dependencies + scripts (npm's requirements.txt)
│   └── src/
│       ├── main.jsx    # entry point: mounts <App /> into index.html
│       ├── App.jsx     # the todo UI — start reading here
│       └── index.css   # styles (skim only)
├── docs/               # one concept document per step
└── README.md           # this file — also the step-by-step usage guide
```

## Roadmap (grows as we go)

- [x] **Step 1** — Minimal FastAPI backend: routes, HTTP, JSON, uvicorn → `docs/01-backend-basics.md`
- [x] **Step 2** — POST, request bodies, Pydantic models, CRUD todo API → `docs/02-post-and-pydantic.md`
- [x] **Step 3** — React frontend calling the API: components, JSX, props, fetch, CORS → `docs/03-react-frontend.md`
- [ ] **Step 4** — Frontend state & hooks (useState, useEffect)
- [ ] **Step 5** — A real database (SQLite + SQLAlchemy)
- [ ] Later — auth, project structure for scale, calling an LLM API, building an agent, an eval harness…

---

## Step 1 — run your first backend (baby steps)

Open **PowerShell** and run these one at a time:

```powershell
# 1. Go into the backend folder
cd C:\MyFolders\Projects\Learning_Projects\fullstack-lab\backend

# 2. Activate the virtual environment (your prompt will show ".venv")
.\.venv\Scripts\Activate.ps1

# 3. Start the server
uvicorn main:app --reload
```

You should see: `Uvicorn running on http://127.0.0.1:8000`.
The window stays busy — that's correct, the server is *running*. Leave it open.

Now open these in your browser, in order:

1. `http://127.0.0.1:8000/` — your first endpoint
2. `http://127.0.0.1:8000/hello/Ashok` — path parameter (try your own name)
3. `http://127.0.0.1:8000/add?a=2&b=3` — query parameters
4. `http://127.0.0.1:8000/add?a=banana&b=3` — watch validation reject bad input
5. `http://127.0.0.1:8000/docs` — the auto-generated interactive docs. Click
   an endpoint → "Try it out" → "Execute".

**Experiment (do this!):** with the server still running, open
`backend/main.py`, change the message in `read_root`, save, and refresh the
browser. `--reload` restarts the server for you.

To stop the server: press `Ctrl+C` in the PowerShell window.

When you can answer the 5 questions at the bottom of
`docs/01-backend-basics.md`, tell Claude you're ready for Step 2.

### If activation fails with a "running scripts is disabled" error

Run this once, then retry step 2:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Step 2 — create/update/delete data (baby steps)

Start the server the same way as Step 1, then open
`http://127.0.0.1:8000/docs`. You'll see the new **todos** endpoints.
The browser address bar can only send GET requests, so use the docs page
to exercise the other methods:

1. **POST /todos** → "Try it out" → body `{"title": "learn fastapi"}` →
   Execute. Note the response: status `201`, and the server assigned `"id": 1`.
2. POST two more todos with different titles.
3. **GET /todos** → Execute — see all three.
4. **GET /todos/{todo_id}** with `todo_id = 2` — fetch just one.
5. **GET /todos/{todo_id}** with `todo_id = 99` — a clean `404` error.
6. **PUT /todos/{todo_id}** with `todo_id = 1` and body
   `{"title": "learn fastapi", "done": true}` — mark it done.
7. **DELETE /todos/{todo_id}** with `todo_id = 3` — returns `204`,
   then GET /todos to confirm it's gone.
8. **Break it on purpose:** POST /todos with body `{"done": true}`
   (no title) — read the `422` response carefully; Pydantic tells you
   exactly which field is missing.
9. **The vanishing act:** stop the server (`Ctrl+C`), start it again,
   GET /todos → `[]`. Data lived in memory only. This is why Step 5
   introduces a database.

Same PowerShell calls without the docs page (optional, shows it's all just HTTP):

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/todos" -ContentType "application/json" -Body '{"title": "learn fastapi"}'
Invoke-RestMethod -Uri "http://127.0.0.1:8000/todos"
```

When you can answer the 5 questions at the bottom of
`docs/02-post-and-pydantic.md`, tell Claude you're ready for Step 3 (React).

---

## Step 3 — run the full stack (baby steps)

You now need **two PowerShell windows** — one per server. This is normal:
every fullstack developer works with multiple terminals.

**Window 1 — backend (data, port 8000):**

```powershell
cd C:\MyFolders\Projects\Learning_Projects\fullstack-lab\backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

**Window 2 — frontend (UI, port 5173):**

```powershell
cd C:\MyFolders\Projects\Learning_Projects\fullstack-lab\frontend
npm run dev
```

Open `http://localhost:5173` in your browser. Then:

1. Add a few todos, check some off, delete one. Watch it just… work.
2. Open **DevTools** (press `F12`) → **Network** tab → add another todo.
   You'll see the actual `POST /todos` request and the `GET /todos` after
   it — click one and inspect the JSON. This is the same traffic you sent
   manually from `/docs` in Step 2, now sent by your own JavaScript.
3. Verify the data is really in the backend: open
   `http://127.0.0.1:8000/todos` directly — same JSON the UI shows.
4. **See HMR:** with both servers running, edit the `<h1>` text in
   `frontend/src/App.jsx`, save — the browser updates instantly, and your
   todos are still there (no reload; state survived).
5. **See why the backend matters:** stop only the backend (`Ctrl+C` in
   window 1), then click Add in the UI — the friendly error appears.
   Restart uvicorn, add a todo again — recovery, no frontend restart needed.
6. **See CORS fail on purpose (optional but recommended):** in
   `backend/main.py`, change `5173` to `5174` in `allow_origins` (both
   lines), save (uvicorn auto-reloads), refresh the UI → todos won't load.
   Open the DevTools **Console** tab and read the CORS error message —
   you'll meet it again in real life. **Change it back** and confirm
   recovery.

When you can answer the questions at the bottom of
`docs/03-react-frontend.md`, tell Claude you're ready for Step 4
(hooks & state, properly).

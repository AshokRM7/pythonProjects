# main.py — Steps 1 & 2: a small backend, growing one concept at a time
#
# Read this file top to bottom. Every line is explained.
# Concept docs: ../docs/01-backend-basics.md and ../docs/02-post-and-pydantic.md

# ── Imports ───────────────────────────────────────────────────────────────
# FastAPI is a Python *framework* (a toolbox of pre-written code) for
# building APIs. HTTPException is how we return error responses on purpose
# (e.g. 404 when a todo doesn't exist).
from fastapi import FastAPI, HTTPException

# BaseModel comes from Pydantic — the data-validation library FastAPI is
# built on. Any class that inherits from BaseModel becomes a *schema*:
# a declared shape that incoming/outgoing data must match.
from pydantic import BaseModel

# ── Create the application ────────────────────────────────────────────────
# This single object IS your backend. Every route (URL) we define gets
# attached to it. When uvicorn runs, it hands every incoming HTTP request
# to this object, and this object decides which of your functions to call.
app = FastAPI(
    title="Learning Lab API",
    description="Step 1: understanding how a backend works.",
    version="0.1.0",
)

# ── Route #1: the root ────────────────────────────────────────────────────
# @app.get("/") is a *decorator*. It tells the app object:
#   "When a GET request arrives for the path '/', call the function below."
#
#   - GET is one of the HTTP *methods* (GET = read data,
#     POST = create, PUT = update, DELETE = remove).
#   - "/" is the *path*: the part of the URL after the domain.
#     http://127.0.0.1:8000/   ← the trailing "/" is this path.
@app.get("/")
def read_root():
    # We return a plain Python dict. FastAPI automatically converts it
    # to JSON (the text format APIs use to exchange data) and wraps it
    # in a proper HTTP response with status code 200 (meaning "OK").
    return {"message": "Hello! Your backend is alive."}


# ── Route #2: a path parameter ────────────────────────────────────────────
# {name} in the path is a *path parameter* — a placeholder.
# Visiting /hello/Ashok makes FastAPI call greet(name="Ashok").
# The `name: str` type hint tells FastAPI to treat it as text.
@app.get("/hello/{name}")
def greet(name: str):
    return {"message": f"Hello, {name}!"}


# ── Route #3: a query parameter ───────────────────────────────────────────
# Parameters that are NOT in the path become *query parameters* —
# the ?key=value part of a URL.
# Visiting /add?a=2&b=3 calls add(a=2, b=3).
# The `int` type hints make FastAPI convert the text "2" to the number 2,
# and automatically return an error if someone sends /add?a=banana.
@app.get("/add")
def add(a: int, b: int):
    return {"a": a, "b": b, "sum": a + b}


# ═════════════════════════════ STEP 2 ═══════════════════════════════════
# A tiny TODO API. New concepts: request bodies, Pydantic models,
# POST/PUT/DELETE methods, status codes, and raising errors on purpose.
# ════════════════════════════════════════════════════════════════════════

# ── Schemas (data shapes) ────────────────────────────────────────────────
# GET requests carry data in the URL. But to CREATE something, the client
# sends JSON in the request *body*. We describe the allowed shape of that
# JSON with a Pydantic model:

class TodoCreate(BaseModel):
    # "A valid TodoCreate has a `title` (text) and a `done` flag
    # (defaults to False if the client doesn't send it)."
    title: str
    done: bool = False


class Todo(TodoCreate):
    # What we *store and return* — same fields as TodoCreate plus an `id`
    # the server assigns. Inheriting from TodoCreate reuses its fields.
    # The client never sends an id; the server owns it. Separating the
    # "input shape" from the "stored shape" is a pattern you'll see in
    # every real backend.
    id: int


# ── "Database" ───────────────────────────────────────────────────────────
# For now, just a list in memory. Restarting the server wipes it — that's
# a feature of Step 2: it makes you FEEL why databases exist (Step 5).
todos: list[Todo] = []

# A counter so every todo gets a unique id (1, 2, 3, ...).
next_id: int = 1


# ── Create: POST /todos ──────────────────────────────────────────────────
# Because `item: TodoCreate` is a Pydantic model (not an int/str), FastAPI
# knows it must come from the JSON request body. Before our function runs,
# FastAPI has already: read the body, checked it matches TodoCreate, and
# rejected it with a 422 if not (missing title, wrong types, etc.).
#
# status_code=201 means "Created" — the conventional success code for POST.
@app.post("/todos", status_code=201)
def create_todo(item: TodoCreate):
    global next_id  # we assign to the module-level counter, so declare it

    # Build the stored Todo from the validated input + a fresh id.
    # model_dump() turns a Pydantic model back into a plain dict,
    # and **dict unpacks it as keyword arguments: Todo(title=..., done=...).
    todo = Todo(id=next_id, **item.model_dump())
    next_id += 1

    todos.append(todo)
    # We return the created todo INCLUDING its new id, so the client
    # immediately knows how to refer to it later.
    return todo


# ── Read all: GET /todos ─────────────────────────────────────────────────
@app.get("/todos")
def list_todos():
    # FastAPI serializes a list of Pydantic models to a JSON array.
    return todos


# ── Read one: GET /todos/{todo_id} ───────────────────────────────────────
@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    for todo in todos:
        if todo.id == todo_id:
            return todo
    # No match: we RAISE (not return) an HTTPException. Raising aborts the
    # function immediately and FastAPI turns it into a proper error
    # response: status 404 + {"detail": "..."} as the JSON body.
    raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")


# ── Update: PUT /todos/{todo_id} ─────────────────────────────────────────
# PUT = "replace this resource with the body I'm sending".
# Note how this combines everything: a path parameter (which todo)
# AND a request body (the new content).
@app.put("/todos/{todo_id}")
def update_todo(todo_id: int, item: TodoCreate):
    for i, todo in enumerate(todos):
        if todo.id == todo_id:
            updated = Todo(id=todo_id, **item.model_dump())
            todos[i] = updated
            return updated
    raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")


# ── Delete: DELETE /todos/{todo_id} ──────────────────────────────────────
# status_code=204 means "No Content": success, but nothing to send back,
# so the function returns None.
@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    for i, todo in enumerate(todos):
        if todo.id == todo_id:
            todos.pop(i)
            return
    raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")

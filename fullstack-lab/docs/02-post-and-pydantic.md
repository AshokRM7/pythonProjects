# Step 2 — POST, Request Bodies, and Pydantic

Step 1 only *read* data (GET). Real apps also **create, update, and delete**
data. This step builds a tiny todo API — the exact API our React frontend
will talk to in Step 3.

---

## 1. CRUD — the four verbs of almost every app

Nearly every application (todo app, chat app, agent config UI…) boils down
to **CRUD** on some "resource":

| Operation | HTTP method | Our route | Success code |
|---|---|---|---|
| **C**reate | `POST` | `POST /todos` | `201 Created` |
| **R**ead | `GET` | `GET /todos`, `GET /todos/{id}` | `200 OK` |
| **U**pdate | `PUT` | `PUT /todos/{id}` | `200 OK` |
| **D**elete | `DELETE` | `DELETE /todos/{id}` | `204 No Content` |

Designing URLs this way — nouns for resources (`/todos`), HTTP methods for
actions — is called **REST style**. It's a convention, not a law, but
following it makes your API instantly understandable to other developers.

## 2. Where data travels: URL vs body

| Channel | Example | Good for |
|---|---|---|
| Path parameter | `/todos/3` | *which* resource |
| Query parameter | `/add?a=2` | small options, filters |
| **Request body** | `{"title": "learn"}` | **the actual data** — any size, nested |

A GET request has no meaningful body; a POST/PUT request carries JSON in
its body plus a header `content-type: application/json` so the server
knows how to parse it.

## 3. Pydantic models = declared data shapes

```python
class TodoCreate(BaseModel):
    title: str
    done: bool = False
```

Read it as a contract: *"valid input has a text `title`; `done` is optional
and defaults to false."*

When a function parameter is a Pydantic model (`item: TodoCreate`), FastAPI:

1. reads the JSON body,
2. **validates** it against the model — wrong/missing fields → automatic
   `422` with an exact explanation of what's wrong,
3. hands your function a clean Python object (`item.title`, `item.done`).

Your function body can therefore trust its inputs completely. This is the
single biggest idea in FastAPI, and it scales all the way up: LLM apps use
these same models to validate agent tool-call arguments and structured
model outputs.

**How FastAPI decides where a parameter comes from:** in the path → path
param; simple type (int/str) → query param; Pydantic model → request body.

## 4. Input shape vs stored shape

```python
class Todo(TodoCreate):   # inherits title + done, adds:
    id: int
```

The client sends a `TodoCreate` (no id — it can't know it). The server
assigns the id and stores/returns a `Todo`. Two schemas, two jobs:

- **input schema** = what the client is allowed to send
- **output schema** = what the server promises to return

Mixing them up leads to classic bugs like clients choosing their own ids.
Real projects often have several schemas per resource (create / update /
public / internal).

## 5. Returning errors on purpose

```python
raise HTTPException(status_code=404, detail="Todo 3 not found")
```

- `raise` (not `return`) — it aborts the function instantly, from anywhere.
- FastAPI catches it and builds the response: status `404`, body
  `{"detail": "Todo 3 not found"}`.

Status code cheat sheet so far:
- `200` OK · `201` Created · `204` No Content (success, empty body)
- `404` Not Found (client asked for something that doesn't exist)
- `422` Unprocessable Entity (client sent invalid data — Pydantic's doing)
- `500` Internal Server Error (OUR code crashed — always a bug to fix)

## 6. Why the data disappears on restart

`todos` is a Python list in the server process's memory. Stop the server →
process dies → memory gone. Databases (Step 5) exist to keep data alive
across restarts and to survive crashes. For now the vanishing act is a
feature: you'll never wonder *why* databases matter.

## 7. Small Python notes from the new code

- `global next_id` — needed because the function *assigns* to a variable
  defined at module level; without it Python would create a local variable.
- `item.model_dump()` — Pydantic model → plain dict, e.g.
  `{"title": "learn", "done": False}`.
- `Todo(id=1, **d)` — `**` unpacks the dict into keyword arguments:
  `Todo(id=1, title="learn", done=False)`.
- `enumerate(todos)` — loop that yields `(index, item)` pairs; we need the
  index to replace/remove the item in the list.

---

## Check yourself before Step 3

1. Why does creating a todo use POST with a body instead of
   `GET /todos?title=...`?
2. What happens, step by step, when a client POSTs `{"done": true}` with
   no title? Which layer rejects it and with which status code?
3. Why do `TodoCreate` and `Todo` exist as two separate classes?
4. What's the difference between `return` and `raise HTTPException(...)`
   in a route function?
5. You create 3 todos, restart the server, and GET /todos returns `[]`.
   Explain exactly why.

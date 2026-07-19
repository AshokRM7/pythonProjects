# Step 1 — Backend Basics: What Actually Happens

This document explains every concept behind the 40 lines in `backend/main.py`.
Read it slowly. Everything we build later stands on this.

---

## 1. What is a backend?

A **backend** is just a program that:

1. sits running on a computer,
2. **listens** on a network port for incoming requests,
3. does some work (compute, read a database, call an AI model…),
4. sends back a **response**.

That's it. A GenAI agent server, a chatbot API, an eval framework service —
all of them are this same loop with different work in step 3.

## 2. What is HTTP?

**HTTP** is the agreed text format browsers and servers use to talk.
When you visit `http://127.0.0.1:8000/hello/Ashok`, your browser sends
roughly this text over the network:

```
GET /hello/Ashok HTTP/1.1
Host: 127.0.0.1:8000
```

And the server replies with text like:

```
HTTP/1.1 200 OK
content-type: application/json

{"message":"Hello, Ashok!"}
```

Key vocabulary:

| Term | Meaning |
|---|---|
| **Method** | The verb: `GET` (read), `POST` (create), `PUT` (update), `DELETE` (remove) |
| **Path** | What you want: `/hello/Ashok` |
| **Status code** | Result summary: `200` OK, `404` not found, `422` bad input, `500` server crashed |
| **Headers** | Metadata lines like `content-type: application/json` |
| **Body** | The actual data (the JSON at the bottom) |

## 3. What are 127.0.0.1 and port 8000?

- **127.0.0.1** (also called `localhost`) is a special IP address meaning
  "this same computer". Nothing leaves your machine.
- A **port** is a numbered mailbox on a computer (1–65535). Many programs can
  use the network at once because each listens on its own port. We chose 8000;
  it's just a convention for dev servers. Your React app will later use 5173.

So `http://127.0.0.1:8000/add?a=2&b=3` reads as:
"on my own machine, mailbox 8000, path `/add`, with query data a=2, b=3".

## 4. What is JSON?

**JSON** (JavaScript Object Notation) is the text format APIs use for data.
It looks almost exactly like a Python dict:

```json
{"name": "Ashok", "skills": ["python", "fastapi"], "level": 1}
```

FastAPI's superpower: you return a normal Python dict, and it converts
(**serializes**) it to JSON automatically.

## 5. The three programs in the stack

When your backend runs, three layers cooperate:

```
Browser ──HTTP──▶ uvicorn ──ASGI──▶ FastAPI (app) ──calls──▶ your function
        ◀──HTTP── uvicorn ◀──ASGI── FastAPI      ◀─return──
```

- **uvicorn** is the **server**. It handles the raw networking: opens port
  8000, accepts connections, parses HTTP text into Python objects. It knows
  nothing about your routes.
- **FastAPI** is the **framework**. It receives the parsed request from
  uvicorn, looks at the method + path, finds the matching function you wrote
  (this matching is called **routing**), validates the inputs, calls your
  function, and converts your return value to a JSON response.
- **Your functions** contain the actual logic. They're plain Python.

**ASGI** is the standard interface (a contract) between the server and the
framework — like a wall socket standard. Because both speak ASGI, you could
swap uvicorn for another ASGI server, or FastAPI for another ASGI framework,
without changing the other side. (The older synchronous version of this
contract is called WSGI, used by Flask/Django classic.)

## 6. What the command `uvicorn main:app --reload` means

- `main:app` → "in the file `main.py`, find the variable named `app`".
- `--reload` → watch my files; when I save a change, restart automatically.
  Dev-only convenience; never used in production.

## 7. What a decorator does

```python
@app.get("/add")
def add(a: int, b: int): ...
```

A **decorator** (`@something`) is Python syntax that wraps or registers the
function defined right below it. Here it means: "register `add` in the app's
routing table under `GET /add`". Nothing runs at this moment — registration
happens once at startup; the function itself runs later, once per request.

## 8. Why the type hints matter (`a: int`)

In plain Python, type hints are just documentation. FastAPI actually **uses**
them at runtime to:

1. **Convert**: URL text `"2"` → integer `2` before calling your function.
2. **Validate**: `/add?a=banana` → automatic `422` error response with a
   clear message — your function is never even called.
3. **Document**: they generate the interactive docs page at `/docs`.

This idea (declare the shape of data, let the framework enforce it) is called
**data validation**, and the library doing it under FastAPI's hood is
**Pydantic**. We'll meet it properly in Step 2 when we send data with POST.

## 9. The free interactive docs — `/docs`

FastAPI reads all your routes and type hints and auto-generates an
**OpenAPI specification** (a machine-readable description of your API), then
serves an interactive page at `http://127.0.0.1:8000/docs` where you can try
every endpoint from the browser. This is not a toy — teams use it daily.

---

## Check yourself before Step 2

You should be able to answer these without looking:

1. What does uvicorn do that FastAPI doesn't, and vice versa?
2. In `http://127.0.0.1:8000/add?a=2&b=3` — which part is the host, the
   port, the path, and the query parameters?
3. Why does `/add?a=banana` return a 422 instead of crashing the server?
4. What does `main:app` mean in the run command?
5. Is `@app.get("/")` executed on every request, or once? What does it do?

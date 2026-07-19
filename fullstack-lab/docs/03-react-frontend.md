# Step 3 — The React Frontend: Two Programs Talking

You now run **two separate programs**: the FastAPI backend (port 8000) and a
React frontend (port 5173). This doc explains the frontend's building blocks
and — crucially — how the two sides are allowed to talk (CORS).

```
Browser tab (localhost:5173)
│
├── loads HTML/JS/CSS from ──▶ Vite dev server  :5173   (serves FILES)
│
└── JavaScript fetch() to ───▶ FastAPI/uvicorn  :8000   (serves DATA/JSON)
```

The frontend server never touches your data; the backend never produces UI.
This separation is the standard architecture of modern web apps.

## 1. Node and npm — Python-world translation

| Python world | JavaScript world | What it is |
|---|---|---|
| `python` | **Node.js** | runs the language outside a browser |
| `pip` | **npm** | installs packages |
| `requirements.txt` | **package.json** | list of dependencies (+ scripts) |
| `.venv/` | **node_modules/** | the installed packages (never commit) |
| — | **package-lock.json** | exact versions actually installed (DO commit — makes installs reproducible) |

Note: Node runs Vite (our *tooling*). The React app itself runs in the
**browser** — the browser is the frontend's "runtime".

## 2. Vite — the frontend dev server

Browsers can't natively run JSX or `import` chains of hundreds of files
efficiently. **Vite** is the tool that bridges this: `npm run dev` starts a
dev server on port 5173 that translates JSX to plain JavaScript on the fly
and serves your files. Save a file → the page updates instantly without a
full reload (**HMR — hot module replacement** — the frontend's `--reload`,
but it even preserves your app's state).

Later, `npm run build` uses Vite to produce `dist/`: plain optimized
HTML/JS/CSS files any static server can host. The dev server is a
development tool only.

## 3. SPA — one HTML file, JavaScript does the rest

`index.html` contains just `<div id="root"></div>` and a script tag.
`main.jsx` tells React to render the `<App />` component into that div.
From then on, all UI is created and updated by JavaScript. That's a
**single-page application**.

## 4. Components, JSX, props

A **component** is a function that returns **JSX** — HTML-like syntax inside
JavaScript. `<App />` and `<TodoItem />` are used like custom HTML tags.
The UI is a tree of components, like functions calling functions.

JSX rules you saw in App.jsx:
- `{expression}` embeds JavaScript inside markup: `<span>{todo.title}</span>`
- `className` instead of `class` (reserved word in JS)
- lists are built with `.map()`: turn each data item into an element
- `key={todo.id}` on list items lets React efficiently match items between
  renders

**Props** are a component's inputs — its function argument.
`<TodoItem todo={t} onDelete={deleteTodo} />` passes data *and functions*
down. The child never edits data itself; it calls the callback the parent
gave it ("data flows down, events flow up").

## 5. State — data that drives the UI (preview; Step 4 goes deep)

```js
const [todos, setTodos] = useState([])
```

**State** is data React watches. Calling the setter (`setTodos(...)`) does
two things: stores the new value, and **re-renders** the component (runs the
function again, producing fresh JSX that React diffs against the page).
You never manipulate the page directly — you change state, and the UI
follows. This is *the* mental model of React:

> UI = f(state) — the page is a function of your data.

The input box is a **controlled input**: its `value` comes from state, and
every keystroke updates state via `onChange`. One source of truth.

## 6. fetch, Promises, async/await

`fetch(url, options)` is the browser's HTTP client — the same requests you
sent from `/docs` and PowerShell in Step 2, now sent by your own code.

Network calls take time. JavaScript is single-threaded and must never
freeze the page, so `fetch` returns a **Promise** — a "result pending"
object — immediately. `await` says "pause *this function* until the result
is ready" (the page stays responsive; other code keeps running). Any
function using `await` is marked `async`. Python has the same feature with
the same keywords — we'll use async in Python when we call LLM APIs.

```js
const response = await fetch(`${API}/todos`)  // wait for HTTP response
const data = await response.json()            // wait for body, parse JSON
```

## 7. CORS — why the backend had to change

**Origin** = scheme + host + port. `http://localhost:5173` and
`http://127.0.0.1:8000` are **different origins** (different port AND host).

Browsers enforce the **same-origin policy**: JavaScript on one origin may
not read responses from another origin unless that other server explicitly
allows it. This protects you: without it, any website you visit could
silently call your bank's API with your logged-in cookies and read the
response.

The mechanism to allow it is **CORS** (Cross-Origin Resource Sharing):

1. The browser attaches `Origin: http://localhost:5173` to the request.
   For "non-simple" requests (like our PUT/DELETE, or JSON POSTs) it first
   sends an automatic **preflight** request (`OPTIONS`) asking permission.
2. Our `CORSMiddleware` answers with headers like
   `access-control-allow-origin: http://localhost:5173`.
3. The browser checks the answer and only then lets our JavaScript proceed.

Key insight: CORS is enforced by the **browser**, not the server — that's
why PowerShell/`/docs` could always call the API freely. And the fix always
belongs on the **backend** (it's the API saying who may use it).

Without the middleware you'd see the classic error in the browser console:
*"blocked by CORS policy: No 'Access-Control-Allow-Origin' header"*.
Every web developer meets this error; now you know exactly what it means.

## 8. The re-fetch pattern

After every create/update/delete, our code calls `loadTodos()` again. The
backend re-sends the list, state updates, UI re-renders. Simple and always
correct — the server stays the single source of truth. (Fancier apps update
local state optimistically to feel faster; we'll discuss trade-offs later.)

---

## Check yourself before Step 4

1. Two servers run in this step. What does each one serve, and which one
   does your data pass through?
2. What is a component? What are props, and in which direction do data and
   events flow?
3. Why does typing in the input box go through React state instead of just
   reading the input's value when submitting?
4. What does `await` do, and why doesn't it freeze the page?
5. Explain to an imaginary colleague what CORS is, who enforces it, and why
   `/docs` never had a CORS problem while the React app did.
6. In useEffect(() => { loadTodos() }, []), what would happen without the
   useEffect wrapper? (Hint: setTodos causes a re-render.)

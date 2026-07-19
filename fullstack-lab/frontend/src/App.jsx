// App.jsx — Step 3: a React UI that talks to our FastAPI todo backend.
//
// Read top to bottom. Concept doc: ../../docs/03-react-frontend.md
//
// Two hooks appear here (useState, useEffect). We use them just enough to
// make the app work and explain them briefly — Step 4 is their deep dive.

import { useState, useEffect } from 'react'

// Where our backend lives. In Step 3 this is hardcoded; real apps put it
// in configuration.
const API = 'http://127.0.0.1:8000'

// ── Child component: one todo row ────────────────────────────────────────
// A *component* is a JavaScript function that returns JSX (HTML-like
// markup). This one renders a single todo. It receives data and callbacks
// from its parent via *props* — the function's single argument.
// { todo, onToggle, onDelete } is destructuring: pulling three named
// values out of the props object.
function TodoItem({ todo, onToggle, onDelete }) {
  return (
    // In JSX, `class` is written `className` (class is a reserved word in
    // JavaScript). The {curly braces} switch from markup back to
    // JavaScript expressions.
    <li className={todo.done ? 'todo done' : 'todo'}>
      {/* checked reflects our data; onChange fires when the user clicks.
          We don't update anything ourselves here — we call the function
          the parent gave us and let the parent handle it. */}
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo)}
      />
      <span>{todo.title}</span>
      <button onClick={() => onDelete(todo.id)}>✕</button>
    </li>
  )
}

// ── Parent component: the whole app ──────────────────────────────────────
export default function App() {
  // useState declares a piece of *state*: data that, when it changes,
  // makes React re-render the UI. It returns [currentValue, setterFn].
  // RULE: never modify state directly (todos.push(...)) — always call the
  // setter with a NEW value, or React won't know anything changed.
  const [todos, setTodos] = useState([])      // the list from the backend
  const [newTitle, setNewTitle] = useState('') // what's typed in the input
  const [error, setError] = useState(null)     // last error message, if any

  // ── Talking to the backend ─────────────────────────────────────────────
  // fetch() is the browser's built-in HTTP client — the JavaScript
  // equivalent of the Invoke-RestMethod calls you made in Step 2.
  // It's *asynchronous*: it returns immediately with a Promise ("result
  // pending"), and `await` pauses THIS function (not the page!) until the
  // response arrives. Functions that use await must be marked `async`.

  async function loadTodos() {
    try {
      const response = await fetch(`${API}/todos`)       // GET by default
      const data = await response.json()                 // parse JSON body
      setTodos(data)                                     // update state → re-render
      setError(null)
    } catch {
      // fetch throws if the server is unreachable (e.g. backend not started)
      setError('Could not reach the backend. Is uvicorn running on :8000?')
    }
  }

  async function addTodo(event) {
    // This runs on form submit. Browsers reload the whole page on submit
    // by default (a leftover from pre-JavaScript days) — stop that:
    event.preventDefault()
    if (!newTitle.trim()) return               // ignore empty input

    // Same POST you did from /docs: method, JSON header, body as text.
    await fetch(`${API}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),  // dict → JSON text
    })
    setNewTitle('')      // clear the input box
    await loadTodos()    // re-fetch the list so the UI shows the new todo
  }

  async function toggleTodo(todo) {
    // PUT replaces the todo with a copy whose `done` is flipped.
    // {...todo, done: !todo.done} = "all of todo's fields, but done flipped"
    await fetch(`${API}/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...todo, done: !todo.done }),
    })
    await loadTodos()
  }

  async function deleteTodo(id) {
    await fetch(`${API}/todos/${id}`, { method: 'DELETE' })
    await loadTodos()
  }

  // ── Loading the list when the app appears ─────────────────────────────
  // We can't just call loadTodos() in the function body — the body runs on
  // EVERY render, and loadTodos changes state, which causes a render:
  // infinite loop. useEffect(fn, []) runs fn only after the first render
  // ("on mount"). The [] is the dependency list — Step 4 explains it fully.
  useEffect(() => {
    loadTodos()
  }, [])

  // ── The UI ─────────────────────────────────────────────────────────────
  return (
    <main>
      <h1>Todos</h1>

      {/* {error && <p>} renders the <p> only when error is not null */}
      {error && <p className="error">{error}</p>}

      {/* A "controlled input": its value always mirrors our state, and
          typing updates the state (event.target.value = current text).
          The input shows exactly what React state contains — one source
          of truth. */}
      <form onSubmit={addTodo}>
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="What needs doing?"
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {/* .map() turns each todo object into a <TodoItem> element —
            this is how lists are rendered in React. `key` helps React
            match old and new list items across re-renders. */}
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
        ))}
      </ul>

      {todos.length === 0 && !error && <p className="empty">Nothing yet — add one!</p>}
    </main>
  )
}

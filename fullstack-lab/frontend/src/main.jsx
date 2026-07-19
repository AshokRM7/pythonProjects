// main.jsx — the JavaScript entry point (the frontend's "uvicorn moment":
// the glue that boots everything, which you write once and rarely touch).

// `import` is JavaScript's version of Python's import. Named imports use
// curly braces: { StrictMode }. Default imports don't: App.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Importing a CSS file tells Vite to include these styles on the page.
import './index.css'

// Our own top-level component, defined in App.jsx.
import App from './App.jsx'

// Find the empty <div id="root"> in index.html and hand it to React:
// "this is your territory — render the <App /> component inside it."
// <StrictMode> adds extra development-only checks (it renders twice in dev
// to surface bugs — you'll see its effect later; it does nothing in
// production builds).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

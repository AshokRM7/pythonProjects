import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'
import CustomerDetailPage from './pages/CustomerDetailPage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import { api } from './api.js'

export default function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api.get('/health').then(setHealth).catch(() => setHealth({ status: 'down' }))
  }, [])

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">CrediSight</div>
            <div className="brand-sub">Bank Statement Analyzer</div>
          </div>
        </div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span>⚡</span> Quick scan
        </NavLink>
        <NavLink to="/customers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span>👥</span> Customers
        </NavLink>
        <div className="sidebar-foot">
          <div style={{ marginBottom: 6 }}>
            AI enrichment:{' '}
            {health === null ? '…' : health.llm_configured
              ? <span className="badge-llm on">ON · {health.llm_model}</span>
              : <span className="badge-llm off">rules-only</span>}
          </div>
          {health?.status === 'down' && (
            <div style={{ color: '#e66767' }}>⚠ Backend not reachable on :8000</div>
          )}
          <div>v1.0 · for credit appraisal use</div>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/analyses/:id" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  )
}

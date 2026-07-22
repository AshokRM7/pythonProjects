import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtMoney } from '../api.js'

const EMPTY = { name: '', pan: '', phone: '', email: '', employment_type: 'salaried', declared_monthly_income: '' }

export default function CustomersPage() {
  const [customers, setCustomers] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/customers').then(setCustomers).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Customer name is required.'); return }
    setBusy(true); setErr('')
    try {
      await api.post('/customers', {
        ...form,
        declared_monthly_income: Number(form.declared_monthly_income) || 0,
      })
      setForm(EMPTY); setShowForm(false); load()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">Create a customer, attach bank accounts &amp; statements, then run the credit analysis.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : '+ New customer'}
        </button>
      </div>

      {err && <div className="err">{err}</div>}

      {showForm && (
        <div className="card">
          <h3>New customer</h3>
          <p className="card-sub">Profile details used in the CAM report and capacity analysis.</p>
          <form onSubmit={submit}>
            <div className="form-row">
              <div><label className="f">Full name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. Arjun Mehta" /></div>
              <div><label className="f">PAN</label><input value={form.pan} onChange={set('pan')} placeholder="ABCDE1234F" /></div>
              <div><label className="f">Phone</label><input value={form.phone} onChange={set('phone')} /></div>
              <div><label className="f">Email</label><input value={form.email} onChange={set('email')} /></div>
            </div>
            <div className="form-row">
              <div>
                <label className="f">Employment type</label>
                <select value={form.employment_type} onChange={set('employment_type')}>
                  <option value="salaried">Salaried</option>
                  <option value="self_employed">Self-employed professional</option>
                  <option value="business">Business owner</option>
                </select>
              </div>
              <div><label className="f">Declared monthly income (₹)</label>
                <input type="number" min="0" value={form.declared_monthly_income} onChange={set('declared_monthly_income')} placeholder="85000" /></div>
            </div>
            <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Create customer'}</button>
          </form>
        </div>
      )}

      <div className="card">
        {customers === null ? (
          <div className="empty">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="empty">No customers yet. Click <b>+ New customer</b> to get started.</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Name</th><th>PAN</th><th>Employment</th><th className="num">Declared income</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/customers/${c.id}`} style={{ fontWeight: 650 }}>{c.name}</Link></td>
                  <td>{c.pan || <span className="muted">—</span>}</td>
                  <td><span className="pill gray">{c.employment_type.replace('_', ' ')}</span></td>
                  <td className="num">{fmtMoney(c.declared_monthly_income)}</td>
                  <td className="muted">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td><Link className="btn ghost sm" to={`/customers/${c.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

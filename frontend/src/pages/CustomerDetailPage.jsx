import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, fmtMoney } from '../api.js'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [statements, setStatements] = useState({}) // accountId -> list
  const [loans, setLoans] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  const loadAll = useCallback(async () => {
    try {
      const [c, a, l, an] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/accounts`),
        api.get(`/customers/${id}/loans`),
        api.get(`/customers/${id}/analyses`),
      ])
      setCustomer(c); setAccounts(a); setLoans(l); setAnalyses(an)
      const stmtEntries = await Promise.all(
        a.map(async (acc) => [acc.id, await api.get(`/accounts/${acc.id}/statements`)]),
      )
      setStatements(Object.fromEntries(stmtEntries))
    } catch (e) { setErr(e.message) }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  if (err && !customer) return <div className="err">{err}</div>
  if (!customer) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link to="/customers">← Customers</Link></div>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-sub">
            <span className="pill gray">{customer.employment_type.replace('_', ' ')}</span>
            {'  '}{customer.pan && <span className="pill blue">PAN {customer.pan}</span>}
            {'  '}Declared income: <b>{fmtMoney(customer.declared_monthly_income)}/mo</b>
          </p>
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      {note && <div className="ok-note">{note}</div>}

      <AccountsSection
        customerId={id} accounts={accounts} statements={statements}
        onChange={loadAll} onError={setErr} onNote={setNote}
      />
      <LoansSection customerId={id} loans={loans} onChange={loadAll} onError={setErr} />
      <AnalyzeSection
        customerId={id} accounts={accounts} statements={statements}
        onError={setErr} onDone={(a) => navigate(`/analyses/${a.id}`)}
      />
      <PastAnalyses analyses={analyses} />
    </>
  )
}

/* ─────────────────────────── accounts + uploads ─────────────────────────── */
function AccountsSection({ customerId, accounts, statements, onChange, onError, onNote }) {
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_type: 'savings' })
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(0)

  const addAccount = async (e) => {
    e.preventDefault()
    if (!form.bank_name.trim()) { onError('Bank name is required.'); return }
    try {
      await api.post(`/customers/${customerId}/accounts`, form)
      setForm({ bank_name: '', account_number: '', account_type: 'savings' })
      setShowForm(false); onError(''); onChange()
    } catch (e2) { onError(e2.message) }
  }

  const removeStatement = async (stmt) => {
    if (!window.confirm(`Remove "${stmt.filename}" and its ${stmt.txn_count} transactions?`)) return
    try {
      await api.del(`/statements/${stmt.id}`)
      onError(''); onNote(`Removed ${stmt.filename}.`); onChange()
    } catch (e) { onError(e.message) }
  }

  const uploadFiles = async (accountId, files) => {
    onError(''); onNote('')
    setUploading((n) => n + files.length)
    let okCount = 0
    for (const file of files) {
      try {
        const stmt = await api.upload(`/accounts/${accountId}/statements`, file)
        okCount += 1
        onNote(`Parsed ${stmt.filename}: ${stmt.txn_count} transactions (${stmt.period_start} → ${stmt.period_end})`)
      } catch (e) {
        onError(`${file.name}: ${e.message}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (okCount) onChange()
  }

  return (
    <div className="card">
      <div className="spread">
        <div>
          <h3>Bank accounts &amp; statements</h3>
          <p className="card-sub mb0">Add each bank account, then upload its statements (PDF / XLSX / XLS / CSV). Multiple accounts are analyzed together.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : '+ Add account'}</button>
      </div>

      {showForm && (
        <form onSubmit={addAccount} style={{ marginTop: 14 }}>
          <div className="form-row">
            <div><label className="f">Bank name *</label><input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="HDFC Bank" /></div>
            <div><label className="f">Account number</label><input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div>
              <label className="f">Type</label>
              <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                <option value="savings">Savings</option><option value="current">Current</option><option value="od">Overdraft / CC</option>
              </select>
            </div>
          </div>
          <button className="btn sm primary">Add account</button>
        </form>
      )}

      {accounts.length === 0 && <div className="empty">No accounts yet — add the customer's bank account first.</div>}

      {accounts.map((acc) => (
        <div key={acc.id} style={{ marginTop: 18 }}>
          <div className="spread">
            <div style={{ fontWeight: 650 }}>
              🏦 {acc.bank_name} <span className="muted">…{(acc.account_number || '').slice(-4)}</span>{' '}
              <span className="pill gray">{acc.account_type}</span>
            </div>
            <UploadButton onFiles={(files) => uploadFiles(acc.id, files)} busy={uploading > 0} />
          </div>
          {(statements[acc.id] || []).length > 0 && (
            <table className="data" style={{ marginTop: 8 }}>
              <thead><tr><th>File</th><th>Period</th><th className="num">Transactions</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {statements[acc.id].map((s) => (
                  <tr key={s.id}>
                    <td>{s.filename}</td>
                    <td className="muted">{s.period_start} → {s.period_end}</td>
                    <td className="num">{s.txn_count}</td>
                    <td>
                      <span className={`pill ${s.parse_status === 'parsed' ? 'green' : s.parse_status === 'partial' ? 'yellow' : 'red'}`}>
                        {s.parse_status}
                      </span>
                      {s.parse_notes && <div className="muted small">{s.parse_notes}</div>}
                    </td>
                    <td><button className="btn danger sm" onClick={() => removeStatement(s)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

function UploadButton({ onFiles, busy }) {
  return (
    <label className="btn sm" style={{ background: 'var(--s1)' }}>
      {busy ? <span className="spinner" /> : '⬆ Upload statements'}
      <input
        type="file" multiple accept=".pdf,.xlsx,.xls,.csv" style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) onFiles([...e.target.files]); e.target.value = '' }}
      />
    </label>
  )
}

/* ─────────────────────────── loans ─────────────────────────── */
function LoansSection({ customerId, loans, onChange, onError }) {
  const EMPTY = { lender: '', loan_type: 'personal', sanctioned_amount: '', outstanding_amount: '', emi_amount: '', remaining_tenure_months: '' }
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/customers/${customerId}/loans`, {
        ...form,
        sanctioned_amount: Number(form.sanctioned_amount) || 0,
        outstanding_amount: Number(form.outstanding_amount) || 0,
        emi_amount: Number(form.emi_amount) || 0,
        remaining_tenure_months: Number(form.remaining_tenure_months) || 0,
      })
      setForm(EMPTY); setShowForm(false); onError(''); onChange()
    } catch (e2) { onError(e2.message) }
  }

  return (
    <div className="card">
      <div className="spread">
        <div>
          <h3>Existing loan obligations (declared)</h3>
          <p className="card-sub mb0">Loans the customer has declared. The engine also auto-detects EMIs from the statements and reconciles both.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : '+ Add loan'}</button>
      </div>

      {showForm && (
        <form onSubmit={add} style={{ marginTop: 14 }}>
          <div className="form-row">
            <div><label className="f">Lender</label><input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} placeholder="HDFC Ltd" /></div>
            <div>
              <label className="f">Type</label>
              <select value={form.loan_type} onChange={(e) => setForm({ ...form, loan_type: e.target.value })}>
                <option value="personal">Personal</option><option value="home">Home</option><option value="auto">Auto</option>
                <option value="business">Business</option><option value="gold">Gold</option><option value="credit_card">Credit card</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="f">EMI (₹/month)</label><input type="number" min="0" value={form.emi_amount} onChange={(e) => setForm({ ...form, emi_amount: e.target.value })} /></div>
            <div><label className="f">Outstanding (₹)</label><input type="number" min="0" value={form.outstanding_amount} onChange={(e) => setForm({ ...form, outstanding_amount: e.target.value })} /></div>
            <div><label className="f">Sanctioned (₹)</label><input type="number" min="0" value={form.sanctioned_amount} onChange={(e) => setForm({ ...form, sanctioned_amount: e.target.value })} /></div>
            <div><label className="f">Tenure left (months)</label><input type="number" min="0" value={form.remaining_tenure_months} onChange={(e) => setForm({ ...form, remaining_tenure_months: e.target.value })} /></div>
          </div>
          <button className="btn sm primary">Add loan</button>
        </form>
      )}

      {loans.length === 0 ? (
        <div className="empty">No declared loans. Add them here to strengthen the obligation analysis.</div>
      ) : (
        <table className="data" style={{ marginTop: 10 }}>
          <thead><tr><th>Lender</th><th>Type</th><th className="num">EMI</th><th className="num">Outstanding</th><th className="num">Tenure left</th></tr></thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.lender || '—'}</td>
                <td><span className="pill gray">{l.loan_type.replace('_', ' ')}</span></td>
                <td className="num">{fmtMoney(l.emi_amount)}</td>
                <td className="num">{fmtMoney(l.outstanding_amount)}</td>
                <td className="num">{l.remaining_tenure_months} mo</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ─────────────────────────── analyze ─────────────────────────── */
function AnalyzeSection({ customerId, accounts, statements, onError, onDone }) {
  const [form, setForm] = useState({ proposed_loan_amount: '', proposed_emi: '', proposed_tenure_months: '' })
  const [busy, setBusy] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const totalTxns = Object.values(statements).flat().reduce((n, s) => n + (s.txn_count || 0), 0)

  const run = async () => {
    setBusy(true); onError('')
    try {
      const a = await api.post(`/customers/${customerId}/analyze`, {
        proposed_loan_amount: Number(form.proposed_loan_amount) || 0,
        proposed_emi: Number(form.proposed_emi) || 0,
        proposed_tenure_months: Number(form.proposed_tenure_months) || 0,
        use_llm: true,
      })
      onDone(a)
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  const enrich = async () => {
    setEnriching(true); onError('')
    try {
      const r = await api.post(`/customers/${customerId}/enrich`, {})
      onError('')
      alert(r.llm ? `AI categorized ${r.enriched} of ${r.candidates} unclassified transactions.` : r.message)
    } catch (e) { onError(e.message) } finally { setEnriching(false) }
  }

  return (
    <div className="card">
      <h3>Run credit analysis</h3>
      <p className="card-sub">
        {totalTxns > 0
          ? `${totalTxns} transactions loaded across ${accounts.length} account(s). Optionally enter the proposed loan to get FOIR with the new EMI.`
          : 'Upload at least one statement above to enable analysis.'}
      </p>
      <div className="form-row">
        <div><label className="f">Proposed loan amount (₹)</label><input type="number" min="0" value={form.proposed_loan_amount} onChange={(e) => setForm({ ...form, proposed_loan_amount: e.target.value })} placeholder="500000" /></div>
        <div><label className="f">Proposed EMI (₹/month)</label><input type="number" min="0" value={form.proposed_emi} onChange={(e) => setForm({ ...form, proposed_emi: e.target.value })} placeholder="12500" /></div>
        <div><label className="f">Tenure (months)</label><input type="number" min="0" value={form.proposed_tenure_months} onChange={(e) => setForm({ ...form, proposed_tenure_months: e.target.value })} placeholder="48" /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={run} disabled={busy || totalTxns === 0}>
          {busy ? <><span className="spinner" /> Analyzing…</> : '⚡ Analyze & generate CAM report'}
        </button>
        <button className="btn ghost" onClick={enrich} disabled={enriching || totalTxns === 0} title="Uses your OpenAI key to classify transactions the rule engine could not">
          {enriching ? <><span className="spinner dark" /> Enriching…</> : '✨ AI-classify unknown transactions'}
        </button>
      </div>
    </div>
  )
}

function PastAnalyses({ analyses }) {
  if (!analyses.length) return null
  return (
    <div className="card">
      <h3>Past analyses</h3>
      <table className="data">
        <thead><tr><th>Run at</th><th>AI narrative</th><th></th></tr></thead>
        <tbody>
          {analyses.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.llm_used ? <span className="pill green">LLM</span> : <span className="pill gray">template</span>}</td>
              <td><Link className="btn ghost sm" to={`/analyses/${a.id}`}>View report</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

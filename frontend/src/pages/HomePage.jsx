import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, Cell,
} from 'recharts'
import { api, fmtMoney, fmtMonth } from '../api.js'
import { buildQuickReportHtml } from '../quickReportHtml.js'

const C = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', red: '#e34948', grid: '#e1e0d9', muted: '#898781' }
const axisStyle = { fontSize: 11, fill: C.muted }
const moneyTick = (v) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)

export default function HomePage() {
  const [files, setFiles] = useState([])
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const reportRef = useRef(null)

  const addFiles = (list) => {
    const allowed = [...list].filter((f) => /\.(pdf|xlsx|xls|csv)$/i.test(f.name))
    const rejected = [...list].length - allowed.length
    if (rejected > 0) setErr(`${rejected} file(s) skipped — only PDF, XLSX, XLS, CSV are supported.`)
    else setErr('')
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...allowed.filter((f) => !names.has(f.name))]
    })
  }

  const scan = async () => {
    if (!files.length) return
    setBusy(true); setErr(''); setReport(null)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/quick-scan', { method: 'POST', body: fd })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        const d = body?.detail
        throw new Error(typeof d === 'string' ? d : d?.message || `Scan failed (${res.status})`)
      }
      setReport(body)
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const reset = () => { setFiles([]); setReport(null); setErr('') }

  // report file name: <statement name>_<timestamp>_report — e.g.
  // "canara_epassbook_2026-07-23_18-45-02_report.html"
  const reportBaseName = () => {
    const names = (report?.files || []).map((f) => f.filename).filter(Boolean)
    let base = (names[0] || 'statement').replace(/\.[^.]+$/, '')          // strip extension
    base = base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() // filesystem-safe
    if (names.length > 1) base += `_and_${names.length - 1}_more`
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
    return `${base}_${ts}_report`
  }

  const downloadHtml = () => {
    const html = buildQuickReportHtml(report, (report?.files || []).map((f) => f.filename))
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${reportBaseName()}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // browsers use the page title as the suggested "save as PDF" filename
  const printReport = () => {
    const original = document.title
    document.title = reportBaseName()
    const restore = () => { document.title = original; window.removeEventListener('afterprint', restore) }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <>
      <div className="hero no-print">
        <h1>Instant statement <span className="grad">Quick Scan</span></h1>
        <p>
          Drop a bank statement and get an immediate credit snapshot — total credits &amp; debits,
          month-wise cash flow, bounce record and red flags. No customer setup, nothing stored.
          For the full CAM workflow, use <Link to="/customers" style={{ color: '#6db3ff' }}>Customers</Link>.
        </p>
        <div className="steps">
          <div className="step"><b>1</b> Upload statement (PDF / Excel / CSV)</div>
          <div className="step"><b>2</b> Scan runs in seconds</div>
          <div className="step"><b>3</b> Preview, print or download the report</div>
        </div>

        <div
          className={`dropzone-hero${drag ? ' drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
        >
          <div className="dz-icon">📄</div>
          <div className="dz-title">{drag ? 'Drop to add' : 'Drag & drop statements here'}</div>
          <div className="dz-sub">or click to browse · PDF, XLSX, XLS, CSV · multiple files allowed</div>
          <input
            ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {files.map((f) => (
              <span key={f.name} className="file-chip">
                {f.name}
                <button title="Remove" onClick={() => setFiles(files.filter((x) => x !== f))}>✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="btn hero-cta" onClick={scan} disabled={busy || files.length === 0}>
            {busy ? <><span className="spinner" /> Scanning…</> : '⚡ Run quick scan'}
          </button>
          {(files.length > 0 || report) && (
            <button className="btn ghost" style={{ color: '#dfe6ec', borderColor: 'rgba(255,255,255,.25)' }} onClick={reset}>
              Clear
            </button>
          )}
          <span className="hint">Files are analyzed in memory and deleted immediately — nothing is saved.</span>
        </div>
      </div>

      {err && <div className="err no-print">{err}</div>}

      {report && (
        <div ref={reportRef}>
          <div className="qs-report-head">
            <h2>Quick scan report</h2>
            <div style={{ display: 'flex', gap: 10 }} className="no-print">
              <button className="btn ghost" onClick={printReport}>🖨 Print / save PDF</button>
              <button className="btn primary" onClick={downloadHtml}>⬇ Download report</button>
            </div>
          </div>
          <QuickReport report={report} />
        </div>
      )}
    </>
  )
}

/* ─────────────────────────── report preview ─────────────────────────── */
function QuickReport({ report }) {
  const s = report.summary
  const monthly = report.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }))
  const flags = report.red_flags

  return (
    <>
      <div className="card" style={{ padding: '14px 22px' }}>
        {report.files.map((f) => (
          <div key={f.filename} className="spread" style={{ padding: '4px 0' }}>
            <span style={{ fontWeight: 600 }}>📄 {f.filename}</span>
            <span>
              <span className={`pill ${f.status === 'parsed' ? 'green' : f.status === 'partial' ? 'yellow' : 'red'}`}>
                {f.status} · {f.txn_count} txns
              </span>
            </span>
          </div>
        ))}
        <div className="muted small" style={{ marginTop: 6 }}>
          Period {s.period_start} → {s.period_end} · {s.months_covered} month(s) · {s.txn_count} transactions
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="tile"><div className="t-label">Total credits</div>
          <div className="t-value pos">{fmtMoney(s.total_inflow)}</div>
          <div className="t-foot">{fmtMoney(s.avg_monthly_inflow)}/mo average</div></div>
        <div className="tile"><div className="t-label">Total debits</div>
          <div className="t-value">{fmtMoney(s.total_outflow)}</div>
          <div className="t-foot">{fmtMoney(s.avg_monthly_outflow)}/mo average</div></div>
        <div className="tile"><div className="t-label">Net cash flow</div>
          <div className={`t-value ${s.net_flow >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(s.net_flow)}</div>
          <div className="t-foot">{s.negative_balance_days > 0 ? `⚠ ${s.negative_balance_days} negative-balance day(s)` : 'no negative-balance days'}</div></div>
        <div className="tile"><div className="t-label">Average balance</div>
          <div className="t-value">{fmtMoney(s.average_balance)}</div>
          <div className="t-foot">min {fmtMoney(s.min_balance)} · max {fmtMoney(s.max_balance)}</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Monthly credits vs debits</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barGap={2}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
              <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total_credit" name="Credits" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="total_debit" name="Debits" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Net cash flow by month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
              <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
              <Bar dataKey="net_flow" name="Net flow" radius={[4, 4, 0, 0]} maxBarSize={30}>
                {monthly.map((m) => (
                  <Cell key={m.month} className={m.net_flow >= 0 ? 'netflow-pos' : 'netflow-neg'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="muted small">Green = surplus month, red = deficit month.</div>
        </div>
      </div>

      {report.balance_series?.length > 0 && (
        <div className="card">
          <h3>Balance trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={report.balance_series}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }}
                tickFormatter={(d) => d?.slice(5)} minTickGap={40} />
              <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Line type="monotone" dataKey="balance" name="Balance" stroke={C.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <BounceCard bounce={report.bounce} monthly={monthly} />

      <div className="grid cols-2">
        <div className="card">
          <h3>Red flags ({flags.length})</h3>
          {flags.length === 0 ? (
            <div className="ok-note">No red flags detected. ✓</div>
          ) : flags.map((f, i) => (
            <div key={i} className={`flag ${f.severity}`}>
              <div className="sev">{f.severity}</div>
              <div className="msg">{f.message}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Cash &amp; obligations snapshot</h3>
          <table className="data">
            <tbody>
              <tr><td>Cash deposits</td><td className="num">{fmtMoney(report.cash.cash_deposit_total)} <span className="muted">({report.cash.cash_deposit_pct_of_inflow}% of inflow)</span></td></tr>
              <tr><td>Cash withdrawals</td><td className="num">{fmtMoney(report.cash.cash_withdrawal_total)} <span className="muted">({report.cash.cash_withdrawal_pct_of_outflow}% of outflow)</span></td></tr>
              <tr><td>Estimated monthly income</td><td className="num">{fmtMoney(report.income_brief.estimated_monthly_income)} <span className="muted">({report.income_brief.income_regularity_pct}% regular)</span></td></tr>
              <tr><td>Detected EMI outgo</td><td className="num">{fmtMoney(report.emi_brief.estimated_monthly_emi_outgo)}/mo <span className="muted">({report.emi_brief.detected_count} EMI pattern(s))</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Top credits</h3>
          <MiniTxnTable rows={report.major_transactions.top_credits} amtKey="credit" />
        </div>
        <div className="card">
          <h3>Top debits</h3>
          <MiniTxnTable rows={report.major_transactions.top_debits} amtKey="debit" />
        </div>
      </div>

      <div className="muted small no-print" style={{ marginBottom: 20 }}>
        Quick Scan is a screening snapshot. For salary sources, FOIR/repayment capacity, AI narrative and the full CAM
        report, create the customer under <Link to="/customers">Customers</Link> and upload statements there.
      </div>
    </>
  )
}

/* ───────── bounce / return month-wise report ───────── */
function BounceCard({ bounce, monthly }) {
  const all = [...bounce.cheque_bounces, ...bounce.ecs_nach_bounces]
  const penalties = bounce.penalty_charges || []

  // group bounce + penalty transactions by month (YYYY-MM from the txn date)
  const byMonth = {}
  for (const t of all) {
    const m = t.date.slice(0, 7)
    byMonth[m] = byMonth[m] || { bounces: 0, amount: 0, penalty: 0, txns: [] }
    byMonth[m].bounces += 1
    byMonth[m].amount += t.debit || t.credit || 0
    byMonth[m].txns.push(t)
  }
  for (const t of penalties) {
    const m = t.date.slice(0, 7)
    byMonth[m] = byMonth[m] || { bounces: 0, amount: 0, penalty: 0, txns: [] }
    byMonth[m].penalty += t.debit || 0
  }

  // chart across ALL statement months so clean months visibly read as zero
  const chartData = monthly.map((m) => ({
    label: m.label,
    bounces: byMonth[m.month]?.bounces || 0,
  }))
  const monthRows = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="card">
      <h3>Bounce / return transactions — month-wise</h3>
      <p className="card-sub">
        <b style={{ color: bounce.bounce_count ? 'var(--critical)' : 'var(--good-text)' }}>
          {bounce.bounce_count} bounce/return event(s)
        </b>
        {' '}across {monthRows.filter(([, v]) => v.bounces > 0).length} month(s) ·
        penalty charges {fmtMoney(bounce.total_penalty_amount)} ({penalties.length} charge(s))
      </p>

      {bounce.bounce_count === 0 && penalties.length === 0 ? (
        <div className="ok-note">Clean record — no cheque/ECS/NACH returns in any month. ✓</div>
      ) : (
        <div className="grid cols-2">
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                <Bar dataKey="bounces" name="Bounces" fill={C.red} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
            <div className="muted small">Bounce count per statement month.</div>
          </div>
          <table className="data">
            <thead>
              <tr><th>Month</th><th className="num">Bounces</th><th className="num">Amount</th><th className="num">Penalties</th></tr>
            </thead>
            <tbody>
              {monthRows.map(([m, v]) => (
                <tr key={m}>
                  <td style={{ fontWeight: 600 }}>{fmtMonth(m)}</td>
                  <td className="num" style={{ color: v.bounces ? 'var(--critical)' : undefined, fontWeight: 600 }}>{v.bounces}</td>
                  <td className="num">{fmtMoney(v.amount)}</td>
                  <td className="num">{fmtMoney(v.penalty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {all.length > 0 && (
        <table className="data" style={{ marginTop: 12 }}>
          <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {all.slice(0, 10).map((t) => (
              <tr key={`${t.id}-${t.date}`}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                <td>{t.description.slice(0, 90)}</td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(t.debit || t.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function MiniTxnTable({ rows, amtKey }) {
  return (
    <table className="data">
      <tbody>
        {rows.slice(0, 5).map((t) => (
          <tr key={`${t.id}-${t.date}`}>
            <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
            <td>{t.description.slice(0, 60)}</td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(t[amtKey])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

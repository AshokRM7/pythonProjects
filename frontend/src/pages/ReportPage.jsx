import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line,
} from 'recharts'
import { api, fmtMoney, fmtMonth } from '../api.js'

const C = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', grid: '#e1e0d9', muted: '#898781' }

export default function ReportPage() {
  const { id } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get(`/analyses/${id}`).then(setAnalysis).catch((e) => setErr(e.message))
  }, [id])

  if (err) return <div className="err">{err}</div>
  if (!analysis) return <div className="empty">Loading report…</div>
  const r = analysis.result

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small no-print"><Link to={`/customers/${analysis.customer_id}`}>← Back to {r.customer?.name}</Link></div>
          <h1 className="page-title">Credit Appraisal Report — {r.customer?.name}</h1>
          <p className="page-sub">
            Generated {new Date(analysis.created_at).toLocaleString()} ·{' '}
            {r.summary.months_covered} months · {r.summary.txn_count} transactions ·{' '}
            {r.accounts?.length} account(s) ·{' '}
            {analysis.llm_used ? <span className="pill green">AI narrative</span> : <span className="pill gray">template narrative</span>}
          </p>
        </div>
        <button className="btn ghost no-print" onClick={() => window.print()}>🖨 Print / save PDF</button>
      </div>

      <ScoreCard score={r.score} capacity={r.capacity} />
      <SummaryTiles s={r.summary} />
      <MonthlyCard monthly={r.monthly} />
      <BalanceCard series={r.balance_series} s={r.summary} />
      <div className="grid cols-2">
        <IncomeCard income={r.income} />
        <EmiCard emi={r.emi} declared={r.declared_loans} />
      </div>
      <div className="grid cols-2">
        <BounceCard bounce={r.bounce} />
        <CashCard cash={r.cash} />
      </div>
      {r.loan_disbursements && <DisbursementsCard disb={r.loan_disbursements} />}
      <RedFlagsCard flags={r.red_flags} />
      <CapacityCard cap={r.capacity} proposal={r.proposal} />
      <PatternsCard patterns={r.patterns} />
      <MajorTxnsCard major={r.major_transactions} unusual={r.unusual} />
      <NarrativeCard r={r} />
    </>
  )
}

/* ───────── score ───────── */
function ScoreCard({ score, capacity }) {
  const pct = Math.min(100, Math.max(0, score.total))
  const ring = 2 * Math.PI * 56
  const color = pct >= 75 ? '#0ca30c' : pct >= 55 ? '#eda100' : pct >= 35 ? '#ec835a' : '#d03b3b'
  return (
    <div className="card">
      <div className="score-wrap">
        <div className="score-ring">
          <svg width="132" height="132">
            <circle cx="66" cy="66" r="56" fill="none" stroke={C.grid} strokeWidth="12" />
            <circle cx="66" cy="66" r="56" fill="none" stroke={color} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={`${(pct / 100) * ring} ${ring}`} />
          </svg>
          <div className="score-num"><div className="n">{score.total}</div><div className="d">/ 100</div></div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3 className="mt0">Banking behaviour score: <span className="score-band" style={{ color }}>{score.band}</span></h3>
          <table className="data" style={{ maxWidth: 440 }}>
            <tbody>
              {Object.entries(score.breakdown).map(([k, v]) => (
                <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k.replaceAll('_', ' ')}</td><td className="num">{v}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="muted small" style={{ marginTop: 8 }}>{score.disclaimer}</div>
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="t-label" style={{ color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Capacity verdict</div>
          <div style={{ fontSize: 20, fontWeight: 750, textTransform: 'capitalize', color }}>{capacity.verdict.replaceAll('_', ' ')}</div>
          <div className="small" style={{ marginTop: 4 }}>{capacity.rationale}</div>
        </div>
      </div>
    </div>
  )
}

/* ───────── summary tiles ───────── */
function SummaryTiles({ s }) {
  return (
    <div className="grid cols-4" style={{ marginBottom: 18 }}>
      <Tile label="Total inflow" value={fmtMoney(s.total_inflow)} foot={`${fmtMoney(s.avg_monthly_inflow)}/mo avg`} />
      <Tile label="Total outflow" value={fmtMoney(s.total_outflow)} foot={`${fmtMoney(s.avg_monthly_outflow)}/mo avg`} />
      <Tile label="Average balance" value={fmtMoney(s.average_balance)} foot={`min ${fmtMoney(s.min_balance)} · max ${fmtMoney(s.max_balance)}`} />
      <Tile label="Net flow" value={fmtMoney(s.net_flow)} cls={s.net_flow >= 0 ? 'pos' : 'neg'}
        foot={s.negative_balance_days > 0 ? `⚠ ${s.negative_balance_days} negative-balance day(s)` : 'no negative-balance days'} />
    </div>
  )
}
const Tile = ({ label, value, foot, cls = '' }) => (
  <div className="tile"><div className="t-label">{label}</div><div className={`t-value ${cls}`}>{value}</div>{foot && <div className="t-foot">{foot}</div>}</div>
)

const axisStyle = { fontSize: 11, fill: C.muted }
const moneyTick = (v) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)
const tooltipFmt = (v) => fmtMoney(v)

/* ───────── monthly ───────── */
function MonthlyCard({ monthly }) {
  const data = monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }))
  return (
    <div className="card">
      <h3>Month-wise credits &amp; debits</h3>
      <p className="card-sub">Inflow vs outflow per month with closing and average daily balances.</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
          <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
          <Tooltip formatter={tooltipFmt} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total_credit" name="Credits" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Bar dataKey="total_debit" name="Debits" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
      <table className="data" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>Month</th><th className="num">Credits</th><th className="num">#</th><th className="num">Debits</th>
            <th className="num">#</th><th className="num">Net</th><th className="num">Avg daily bal</th><th className="num">Closing bal</th></tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.month}>
              <td style={{ fontWeight: 600 }}>{m.label}</td>
              <td className="num pos-amt">{fmtMoney(m.total_credit)}</td>
              <td className="num muted">{m.credit_count}</td>
              <td className="num">{fmtMoney(m.total_debit)}</td>
              <td className="num muted">{m.debit_count}</td>
              <td className="num" style={{ color: m.net_flow >= 0 ? 'var(--good-text)' : 'var(--critical)', fontWeight: 600 }}>{fmtMoney(m.net_flow)}</td>
              <td className="num">{fmtMoney(m.avg_daily_balance)}</td>
              <td className="num">{fmtMoney(m.closing_balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────── balance trend ───────── */
function BalanceCard({ series, s }) {
  if (!series?.length) return null
  return (
    <div className="card">
      <h3>Daily balance trend</h3>
      <p className="card-sub">End-of-day combined balance across all accounts. Average balance: <b>{fmtMoney(s.average_balance)}</b></p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }}
            tickFormatter={(d) => d?.slice(5)} minTickGap={40} />
          <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
          <Tooltip formatter={tooltipFmt} />
          <Line type="monotone" dataKey="balance" name="Balance" stroke={C.blue} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ───────── income ───────── */
function IncomeCard({ income }) {
  return (
    <div className="card">
      <h3>Income &amp; salary tracking</h3>
      <p className="card-sub">
        Estimated monthly income <b>{fmtMoney(income.estimated_monthly_income)}</b> ·
        regularity <b>{income.income_regularity_pct}%</b> ({income.months_with_income}/{income.months_covered} months)
      </p>
      {income.salary_sources.length === 0 ? (
        <div className="empty">No regular income pattern identified.</div>
      ) : (
        <table className="data">
          <thead><tr><th>Source</th><th>Type</th><th className="num">Avg</th><th className="num">Count</th><th className="num">Day</th></tr></thead>
          <tbody>
            {income.salary_sources.slice(0, 6).map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.source}</td>
                <td><span className={`pill ${s.detection === 'salary_keyword' ? 'green' : 'blue'}`}>{s.detection === 'salary_keyword' ? 'salary' : 'recurring'}</span></td>
                <td className="num">{fmtMoney(s.avg_amount)}</td>
                <td className="num muted">{s.occurrences}</td>
                <td className="num muted">~{s.typical_day_of_month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ───────── EMI ───────── */
function EmiCard({ emi, declared }) {
  return (
    <div className="card">
      <h3>EMI / loan obligations</h3>
      <p className="card-sub">
        Detected from statements: <b>{fmtMoney(emi.estimated_monthly_emi_outgo)}/mo</b> ·
        Declared: <b>{fmtMoney((declared || []).reduce((n, l) => n + (l.emi_amount || 0), 0))}/mo</b>
      </p>
      {emi.detected_emis.length === 0 ? (
        <div className="empty">No EMI debits detected.</div>
      ) : (
        <table className="data">
          <thead><tr><th>Lender (from narration)</th><th className="num">EMI</th><th className="num">Paid</th><th>Recurring</th></tr></thead>
          <tbody>
            {emi.detected_emis.slice(0, 8).map((e, i) => (
              <tr key={i}>
                <td style={{ textTransform: 'capitalize' }}>{e.lender_hint}</td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(e.emi_amount)}</td>
                <td className="num muted">{e.occurrences}×</td>
                <td>{e.recurring ? <span className="pill green">yes</span> : <span className="pill gray">ad-hoc</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ───────── bounce ───────── */
const BOUNCE_KIND_LABEL = {
  cheque: 'cheque return',
  ecs_nach: 'ACH/ECS return',
  inferred_from_charge: 'inferred from return charge',
}

function BounceCard({ bounce }) {
  const all = bounce.bounce_events
    || [...bounce.cheque_bounces, ...bounce.ecs_nach_bounces].map((t) => ({ ...t, kind: 'cheque' }))
  const inferredCount = bounce.inferred_bounce_count
    ?? all.filter((t) => t.kind === 'inferred_from_charge').length
  return (
    <div className="card">
      <h3>Bounces &amp; penalties</h3>
      <p className="card-sub">
        <b style={{ color: bounce.bounce_count ? 'var(--critical)' : 'var(--good-text)' }}>{bounce.bounce_count} bounce/return event(s)</b>
        {' '}· penalty charges {fmtMoney(bounce.total_penalty_amount)} ({bounce.penalty_charges.length} charge(s))
        {inferredCount > 0 && <> · {inferredCount} inferred from return charges</>}
      </p>
      {all.length === 0 ? (
        <div className="empty">Clean record — no cheque/ECS/NACH returns found. ✓</div>
      ) : (
        <table className="data">
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {all.slice(0, 8).map((t) => (
              <tr key={t.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                <td>{t.description.slice(0, 90)}</td>
                <td><span className={`pill ${t.kind === 'inferred_from_charge' ? 'yellow' : 'red'}`}>{BOUNCE_KIND_LABEL[t.kind] || 'return'}</span></td>
                <td className="num">{fmtMoney(t.debit || t.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ───────── cash ───────── */
function CashCard({ cash }) {
  const months = Object.entries(cash.by_month || {}).map(([m, v]) => ({ label: fmtMonth(m), ...v }))
  return (
    <div className="card">
      <h3>Cash deposit &amp; withdrawal analysis</h3>
      <p className="card-sub">
        Deposits <b>{fmtMoney(cash.cash_deposit_total)}</b> ({cash.cash_deposit_pct_of_inflow}% of inflow) ·
        Withdrawals <b>{fmtMoney(cash.cash_withdrawal_total)}</b> ({cash.cash_withdrawal_pct_of_outflow}% of outflow)
      </p>
      {months.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={months} barGap={2}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
            <YAxis tick={axisStyle} tickFormatter={moneyTick} axisLine={false} tickLine={false} />
            <Tooltip formatter={tooltipFmt} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="deposits" name="Cash deposits" fill={C.aqua} radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="withdrawals" name="Cash withdrawals" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/* ───────── red flags ───────── */
function RedFlagsCard({ flags }) {
  return (
    <div className="card">
      <h3>Red flags ({flags.length})</h3>
      <p className="card-sub">Suspicious or credit-negative patterns detected in the statements.</p>
      {flags.length === 0 ? (
        <div className="ok-note">No red flags detected. ✓</div>
      ) : flags.map((f, i) => (
        <div key={i} className={`flag ${f.severity}`}>
          <div className="sev">{f.severity}</div>
          <div>
            <div className="msg">{f.message}</div>
            {f.evidence?.length > 0 && (
              <div className="ev">
                {f.evidence.slice(0, 3).map((e, j) => (
                  <div key={j}>· {e.date || e.credit?.date} — {(e.description || e.credit?.description || '').slice(0, 90)} ({fmtMoney(e.debit || e.credit?.credit || e.credit)})</div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────── loan disbursements ───────── */
function DisbursementsCard({ disb }) {
  return (
    <div className="card">
      <h3>New loan disbursements</h3>
      <p className="card-sub">Lump-sum loan credits received during the statement period.</p>
      {disb.count === 0 ? (
        <div className="ok-note">No loan disbursement credits detected. ✓</div>
      ) : (
        <>
          <p className="small" style={{ marginTop: 0 }}>
            <b style={{ color: 'var(--critical)' }}>{disb.count} disbursement credit(s)</b> totalling{' '}
            <b>{fmtMoney(disb.total_amount)}</b>
            {disb.probable_count > 0 && <> · {disb.probable_count} inferred from lender-name + lump-sum pattern</>}
          </p>
          <table className="data">
            <thead><tr><th>Date</th><th>Narration</th><th>Detection</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {disb.events.slice(0, 10).map((e) => (
                <tr key={`${e.id}-${e.date}`}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td>{e.description.slice(0, 80)}</td>
                  <td><span className={`pill ${e.confidence === 'explicit' ? 'red' : 'yellow'}`}>{e.confidence}</span></td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(e.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/* ───────── capacity ───────── */
function CapacityCard({ cap, proposal }) {
  const Row = ({ l, v, strong }) => (
    <tr><td>{l}</td><td className="num" style={strong ? { fontWeight: 700 } : {}}>{v}</td></tr>
  )
  return (
    <div className="card">
      <h3>Repayment capacity (FOIR)</h3>
      <p className="card-sub">Fixed-Obligation-to-Income Ratio against a policy cap of {cap.foir_policy_cap_pct}%.</p>
      <div className="grid cols-2">
        <table className="data">
          <tbody>
            <Row l="Estimated monthly income" v={fmtMoney(cap.estimated_monthly_income)} strong />
            <Row l="EMIs detected in statements" v={fmtMoney(cap.detected_monthly_emi)} />
            <Row l="EMIs declared by customer" v={fmtMoney(cap.declared_monthly_emi)} />
            <Row l="Obligations used (conservative)" v={fmtMoney(cap.existing_obligations_used)} strong />
            <Row l="Average monthly surplus" v={fmtMoney(cap.avg_monthly_surplus)} />
          </tbody>
        </table>
        <table className="data">
          <tbody>
            <Row l="FOIR (existing)" v={cap.foir_existing_pct != null ? `${cap.foir_existing_pct}%` : '—'} />
            {proposal?.proposed_emi > 0 && <Row l={`FOIR with proposed EMI (${fmtMoney(proposal.proposed_emi)})`} v={`${cap.foir_with_proposed_pct}%`} strong />}
            <Row l="Eligible additional EMI headroom" v={fmtMoney(cap.eligible_additional_emi)} strong />
            {proposal?.proposed_loan_amount > 0 && <Row l="Proposed loan amount" v={fmtMoney(proposal.proposed_loan_amount)} />}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────── patterns ───────── */
function PatternsCard({ patterns }) {
  const cats = Object.entries(patterns.by_category || {}).slice(0, 10)
  const maxV = Math.max(...cats.map(([, v]) => v.debit + v.credit), 1)
  return (
    <div className="card">
      <h3>Transaction pattern analysis</h3>
      <p className="card-sub">
        Inflow trend: <b style={{ textTransform: 'capitalize' }}>{patterns.inflow_trend}</b> ·
        volatility {patterns.inflow_volatility} ·
        expense/income ratio {patterns.expense_to_income_ratio ?? '—'}
      </p>
      <table className="data">
        <thead><tr><th>Category</th><th style={{ width: '40%' }}></th><th className="num">Count</th><th className="num">Debits</th><th className="num">Credits</th></tr></thead>
        <tbody>
          {cats.map(([k, v]) => (
            <tr key={k}>
              <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{k.replaceAll('_', ' ')}</td>
              <td><div style={{ height: 8, borderRadius: 4, background: '#2a78d6', width: `${(100 * (v.debit + v.credit)) / maxV}%`, minWidth: 2 }} /></td>
              <td className="num muted">{v.count}</td>
              <td className="num">{fmtMoney(v.debit)}</td>
              <td className="num pos-amt">{fmtMoney(v.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────── major + unusual ───────── */
function MajorTxnsCard({ major, unusual }) {
  const TxnTable = ({ rows, amtKey }) => (
    <table className="data">
      <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th></tr></thead>
      <tbody>
        {rows.slice(0, 6).map((t) => (
          <tr key={`${t.id}-${t.date}`}>
            <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
            <td>{t.description} <span className="pill gray">{t.account}</span></td>
            <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(t[amtKey])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <>
      <div className="grid cols-2">
        <div className="card"><h3>Major credits</h3><TxnTable rows={major.top_credits} amtKey="credit" /></div>
        <div className="card"><h3>Major debits</h3><TxnTable rows={major.top_debits} amtKey="debit" /></div>
      </div>
      <div className="card">
        <h3>Unusual / high-value transaction alerts ({unusual.alert_count})</h3>
        <p className="card-sub">Statistical outliers, threshold breaches and round-figure cash movements.</p>
        {unusual.alerts.length === 0 ? <div className="ok-note">None detected. ✓</div> : (
          <table className="data">
            <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th><th>Reason</th></tr></thead>
            <tbody>
              {unusual.alerts.slice(0, 12).map((a, i) => (
                <tr key={i}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{a.date}</td>
                  <td>{a.description}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(a.debit || a.credit)}</td>
                  <td><span className="pill yellow">{a.reason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

/* ───────── narrative ───────── */
function NarrativeCard({ r }) {
  return (
    <div className="card">
      <h3>Analyst narrative (CAM banking section)</h3>
      <p className="card-sub">
        {r.narrative_source === 'llm' ? 'Drafted by AI from the computed metrics — review before use.' : 'Template summary (add an OpenAI key in backend/.env for an AI-drafted narrative).'}
      </p>
      <div className="narrative">{r.narrative}</div>
    </div>
  )
}

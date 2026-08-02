// Builds a fully self-contained HTML report file for the Quick Scan feature.
// No external assets — safe to email, archive, or open offline.

const money = (v) =>
  v === null || v === undefined ? '—' : '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const monthLabel = (m) => {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, mo] = m.split('-')
  return `${names[Number(mo) - 1]} ${y}`
}

// simple inline SVG bar chart (credits vs debits per month)
function monthlySvg(monthly) {
  if (!monthly.length) return ''
  const W = 720, H = 200, pad = 36
  const max = Math.max(...monthly.map((m) => Math.max(m.total_credit, m.total_debit)), 1)
  const bw = Math.min(26, (W - pad * 2) / (monthly.length * 2.6))
  const groups = monthly.map((m, i) => {
    const x = pad + (i + 0.5) * ((W - pad * 2) / monthly.length)
    const hc = (m.total_credit / max) * (H - 60)
    const hd = (m.total_debit / max) * (H - 60)
    return `
      <rect x="${x - bw - 1}" y="${H - 30 - hc}" width="${bw}" height="${hc}" rx="3" fill="#2a78d6"/>
      <rect x="${x + 1}" y="${H - 30 - hd}" width="${bw}" height="${hd}" rx="3" fill="#eb6834"/>
      <text x="${x}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#898781">${esc(monthLabel(m.month).slice(0, 3))}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">
    <line x1="${pad}" y1="${H - 30}" x2="${W - pad}" y2="${H - 30}" stroke="#c3c2b7"/>
    ${groups}
    <g font-size="11" fill="#52514e">
      <rect x="${pad}" y="8" width="10" height="10" rx="2" fill="#2a78d6"/><text x="${pad + 15}" y="17">Credits</text>
      <rect x="${pad + 75}" y="8" width="10" height="10" rx="2" fill="#eb6834"/><text x="${pad + 90}" y="17">Debits</text>
    </g>
  </svg>`
}

const KIND_LABEL = {
  cheque: 'cheque return',
  ecs_nach: 'ACH/ECS return',
  inferred_from_charge: 'inferred from return charge',
}

function bounceSection(report) {
  const bounce = report.bounce
  const all = bounce.bounce_events
    || [...(bounce.cheque_bounces || []), ...(bounce.ecs_nach_bounces || [])].map((t) => ({ ...t, kind: 'cheque' }))
  const penalties = bounce.penalty_charges || []
  const inferredCount = bounce.inferred_bounce_count
    ?? all.filter((t) => t.kind === 'inferred_from_charge').length

  const byMonth = {}
  for (const t of all) {
    const m = t.date.slice(0, 7)
    byMonth[m] = byMonth[m] || { bounces: 0, amount: 0, hasExplicit: false, penalty: 0 }
    byMonth[m].bounces += 1
    if (t.kind !== 'inferred_from_charge') {
      byMonth[m].amount += t.debit || t.credit || 0
      byMonth[m].hasExplicit = true
    }
  }
  for (const t of penalties) {
    const m = t.date.slice(0, 7)
    byMonth[m] = byMonth[m] || { bounces: 0, amount: 0, hasExplicit: false, penalty: 0 }
    byMonth[m].penalty += t.debit || 0
  }
  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))

  if (!all.length && !penalties.length) {
    return `<div class="card"><h2>Bounce / return transactions — month-wise</h2>
      <div class="okline">Clean record — no cheque/ECS/NACH returns in any month ✓</div></div>`
  }
  const monthRows = months.map(([m, v]) => `
    <tr><td>${esc(monthLabel(m))}</td>
      <td class="num neg">${v.bounces}</td>
      <td class="num">${v.hasExplicit ? money(v.amount) : '<span class="mut">—</span>'}</td>
      <td class="num">${money(v.penalty)}</td></tr>`).join('')
  const txnRows = all.slice(0, 10).map((t) => `
    <tr><td class="mut">${esc(t.date)}</td><td>${esc(t.description.slice(0, 80))}</td>
    <td class="mut">${esc(KIND_LABEL[t.kind] || 'return')}</td>
    <td class="num">${money(t.debit || t.credit)}</td></tr>`).join('')

  const inferredNote = inferredCount > 0
    ? ` · ${inferredCount} event(s) inferred from return charges — this bank shows only the fee, not the returned instrument`
    : ''
  return `<div class="card"><h2>Bounce / return transactions — month-wise</h2>
    <div class="tf" style="margin-bottom:8px">${bounce.bounce_count} bounce/return event(s) across
      ${months.filter(([, v]) => v.bounces > 0).length} month(s) ·
      penalty charges ${money(bounce.total_penalty_amount)} (${penalties.length} charge(s))${inferredNote}</div>
    <table><thead><tr><th>Month</th><th class="num">Bounces</th><th class="num">Returned amt</th><th class="num">Penalties</th></tr></thead>
    <tbody>${monthRows}</tbody></table>
    ${txnRows ? `<h2 style="margin-top:14px">Bounce events${all.length > 10 ? ` (first 10 of ${all.length})` : ''}</h2>
      <table><tbody>${txnRows}</tbody></table>` : ''}
  </div>`
}

function emiSection(report) {
  const emi = report.emi
  if (!emi) return ''
  const debits = emi.emi_debits || []
  if (!debits.length) {
    return `<div class="card"><h2>EMI / loan repayments — month-wise</h2>
      <div class="okline">No EMI/loan-repayment debits detected in the narrations ✓</div></div>`
  }
  const monthRows = Object.entries(emi.by_month || {}).map(([m, v]) => `
    <tr><td>${esc(monthLabel(m))}</td><td class="num">${v.count}</td><td class="num">${money(v.total)}</td></tr>`).join('')
  const patternRows = (emi.detected_emis || []).slice(0, 8).map((e) => `
    <tr><td>${esc(e.lender_hint)}</td><td class="num">${money(e.emi_amount)}</td>
    <td class="num">${e.occurrences}×</td><td>${e.recurring ? 'recurring' : 'ad-hoc'}</td></tr>`).join('')
  const debitRows = debits.slice(0, 15).map((t) => `
    <tr><td class="mut">${esc(t.date)}</td><td>${esc(t.lender_hint)}</td>
    <td class="mut">${esc(t.description.slice(0, 60))}</td>
    <td class="num">${money(t.debit)}</td></tr>`).join('')
  return `<div class="card"><h2>EMI / loan repayments — month-wise</h2>
    <div class="tf" style="margin-bottom:8px">${debits.length} EMI/loan debit(s) totalling ${money(emi.total_emi_debits)} ·
      estimated recurring outgo ${money(emi.estimated_monthly_emi_outgo)}/mo · ${(emi.detected_emis || []).length} lender pattern(s)</div>
    <div class="cols">
      <div><table><thead><tr><th>Month</th><th class="num">Debits</th><th class="num">EMI outgo</th></tr></thead>
        <tbody>${monthRows}</tbody></table></div>
      <div><table><thead><tr><th>Lender</th><th class="num">EMI</th><th class="num">Paid</th><th>Type</th></tr></thead>
        <tbody>${patternRows}</tbody></table></div>
    </div>
    <h2 style="margin-top:14px">EMI debits${debits.length > 15 ? ` (first 15 of ${debits.length})` : ''}</h2>
    <table><tbody>${debitRows}</tbody></table>
  </div>`
}

function disbursementSection(report) {
  const disb = report.loan_disbursements
  if (!disb) return ''
  if (!disb.count) {
    return `<div class="card"><h2>New loan disbursements</h2>
      <div class="okline">No loan disbursement credits detected during the period ✓</div></div>`
  }
  const rows = disb.events.slice(0, 10).map((e) => `
    <tr><td class="mut">${esc(e.date)}</td><td>${esc(e.description.slice(0, 80))}</td>
    <td class="mut">${esc(e.confidence)}</td><td class="num">${money(e.credit)}</td></tr>`).join('')
  return `<div class="card"><h2>New loan disbursements</h2>
    <div class="tf" style="margin-bottom:8px">${disb.count} disbursement credit(s) totalling ${money(disb.total_amount)}
      during the period${disb.probable_count ? ` · ${disb.probable_count} inferred from lender-name + lump-sum pattern` : ''} —
      new borrowing highlighted separately from trading/income credits.</div>
    <table><thead><tr><th>Date</th><th>Narration</th><th>Detection</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`
}

export function buildQuickReportHtml(report, fileNames) {
  const s = report.summary
  const flags = report.red_flags
  const now = new Date().toLocaleString()

  const flagRows = flags.length
    ? flags.map((f) => `
        <div class="flag ${f.severity}">
          <span class="sev">${esc(f.severity.toUpperCase())}</span>
          <span>${esc(f.message)}</span>
        </div>`).join('')
    : '<div class="okline">No red flags detected ✓</div>'

  const bouncesByMonth = report.bounce.bounces_by_month || {}
  const monthRows = report.monthly.map((m) => `
    <tr><td>${esc(monthLabel(m.month))}</td>
      <td class="num pos">${money(m.total_credit)}</td>
      <td class="num">${money(m.total_debit)}</td>
      <td class="num ${m.net_flow >= 0 ? 'pos' : 'neg'}">${money(m.net_flow)}</td>
      <td class="num">${money(m.avg_daily_balance)}</td>
      <td class="num">${money(m.closing_balance)}</td>
      <td class="num ${bouncesByMonth[m.month] ? 'neg' : ''}">${bouncesByMonth[m.month] || 0}</td></tr>`).join('')

  const txnRows = (rows, key) => rows.slice(0, 5).map((t) => `
    <tr><td class="mut">${esc(t.date)}</td><td>${esc(t.description.slice(0, 70))}</td>
    <td class="num">${money(t[key])}</td></tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quick Scan Report — ${esc(fileNames.filter(Boolean).join(', ') || 'statement')} (${esc(s.period_start)} to ${esc(s.period_end)})</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b0b0b;background:#f9f9f7;margin:0;padding:32px;font-size:14px;line-height:1.5}
  .wrap{max-width:880px;margin:0 auto}
  h1{font-size:22px;letter-spacing:-.4px;margin:0 0 2px}
  .sub{color:#52514e;font-size:12.5px;margin-bottom:22px}
  .card{background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:12px;padding:18px 20px;margin-bottom:14px}
  h2{font-size:15px;margin:0 0 10px}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px}
  .tile{background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:12px;padding:14px 16px}
  .tl{color:#52514e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .tv{font-size:20px;font-weight:750;margin-top:2px}
  .tf{color:#898781;font-size:11.5px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;color:#898781;font-size:11px;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;border-bottom:1px solid #e1e0d9}
  td{padding:6px 8px;border-bottom:1px solid #e1e0d9}
  tr:last-child td{border-bottom:none}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .pos{color:#006300;font-weight:600}.neg{color:#d03b3b;font-weight:600}.mut{color:#898781;white-space:nowrap}
  .flag{display:flex;gap:10px;align-items:baseline;padding:8px 12px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(11,11,11,.08)}
  .flag.high{background:#fdf2f2}.flag.medium{background:#fef8ec}.flag.low{background:#f5f5f2}
  .sev{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;color:#fff;white-space:nowrap}
  .high .sev{background:#d03b3b}.medium .sev{background:#b97a00}.low .sev{background:#898781}
  .okline{background:#e2f4e2;color:#006300;border-radius:8px;padding:9px 12px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:700px){.cols{grid-template-columns:1fr}}
  .foot{color:#898781;font-size:11.5px;margin-top:18px}
  @media print{body{background:#fff;padding:0}.card,.tile{break-inside:avoid}}
</style></head><body><div class="wrap">
  <h1>CrediSight — Quick Scan Report</h1>
  <div class="sub">Generated ${esc(now)} · Files: ${esc(fileNames.join(', '))} ·
    Period ${esc(s.period_start)} → ${esc(s.period_end)} · ${s.months_covered} month(s) · ${s.txn_count} transactions</div>

  <div class="tiles">
    <div class="tile"><div class="tl">Total credits</div><div class="tv pos">${money(s.total_inflow)}</div><div class="tf">${money(s.avg_monthly_inflow)}/mo avg</div></div>
    <div class="tile"><div class="tl">Total debits</div><div class="tv">${money(s.total_outflow)}</div><div class="tf">${money(s.avg_monthly_outflow)}/mo avg</div></div>
    <div class="tile"><div class="tl">Net cash flow</div><div class="tv ${s.net_flow >= 0 ? 'pos' : 'neg'}">${money(s.net_flow)}</div><div class="tf">${s.negative_balance_days} negative-balance day(s)</div></div>
    <div class="tile"><div class="tl">Average balance</div><div class="tv">${money(s.average_balance)}</div><div class="tf">min ${money(s.min_balance)} · max ${money(s.max_balance)}</div></div>
  </div>

  <div class="card"><h2>Monthly credits vs debits</h2>${monthlySvg(report.monthly)}
    <table style="margin-top:10px"><thead><tr><th>Month</th><th class="num">Credits</th><th class="num">Debits</th><th class="num">Net</th><th class="num">Avg daily bal</th><th class="num">Closing</th><th class="num">Bounces</th></tr></thead>
    <tbody>${monthRows}</tbody></table></div>

  ${bounceSection(report)}

  ${emiSection(report)}

  ${disbursementSection(report)}

  <div class="card"><h2>Red flags (${flags.length})</h2>${flagRows}</div>

  <div class="card"><h2>Cash &amp; obligations snapshot</h2><table><tbody>
    <tr><td>Cash deposits</td><td class="num">${money(report.cash.cash_deposit_total)} (${report.cash.cash_deposit_pct_of_inflow}% of inflow)</td></tr>
    <tr><td>Cash withdrawals</td><td class="num">${money(report.cash.cash_withdrawal_total)} (${report.cash.cash_withdrawal_pct_of_outflow}% of outflow)</td></tr>
    <tr><td>Estimated monthly income</td><td class="num">${money(report.income_brief.estimated_monthly_income)} (${report.income_brief.income_regularity_pct}% regular)</td></tr>
    <tr><td>Detected EMI outgo</td><td class="num">${money(report.emi_brief.estimated_monthly_emi_outgo)}/mo (${report.emi_brief.detected_count} pattern(s))</td></tr>
  </tbody></table></div>

  <div class="cols">
    <div class="card"><h2>Top credits</h2><table><tbody>${txnRows(report.major_transactions.top_credits, 'credit')}</tbody></table></div>
    <div class="card"><h2>Top debits</h2><table><tbody>${txnRows(report.major_transactions.top_debits, 'debit')}</tbody></table></div>
  </div>

  <div class="foot">Quick Scan is a heuristic screening snapshot generated by CrediSight — not a credit bureau report.
  For full FOIR / repayment-capacity analysis use the complete CAM workflow.</div>
</div></body></html>`
}

// Thin fetch wrapper for the CrediSight API (proxied to :8000 by Vite).
const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const detail = body?.detail
    const msg = typeof detail === 'string'
      ? detail
      : detail?.message || detail?.notes?.join('; ') || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.detail = detail
    throw err
  }
  return body
}

const json = (method) => (path, data) =>
  request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const api = {
  get: (path) => request(path),
  post: json('POST'),
  put: json('PUT'),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(path, { method: 'POST', body: fd })
  },
}

export const fmtMoney = (v, opts = {}) => {
  if (v === null || v === undefined) return '—'
  return '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0, ...opts })
}

export const fmtMonth = (m) => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[Number(mo) - 1]} ${y.slice(2)}`
}

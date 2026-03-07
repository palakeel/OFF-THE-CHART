import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronUp, ChevronDown, Search, X, Star } from 'lucide-react'

const PAGE_SIZE = 50

function fmtDate(str) {
  if (!str) return '—'
  const [, m, d] = str.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function fmtSigned(n) {
  const v = n || 0
  return (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHold(mins) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h >= 24) { const d = Math.floor(h / 24); const rh = h % 24; return rh > 0 ? `${d}d ${rh}h` : `${d}d` }
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StatusBadge({ trade }) {
  if (trade.trade_status === 'OPEN')
    return <span style={{ background: 'rgba(255,255,255,0.06)', color: '#666', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>OPEN</span>
  if (trade.status === 'WIN')
    return <span style={{ background: 'rgba(0,201,167,0.12)', color: '#00c9a7', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>WIN</span>
  if (trade.status === 'LOSS')
    return <span style={{ background: 'rgba(233,69,96,0.12)', color: '#e94560', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>LOSS</span>
  return <span style={{ background: 'rgba(255,255,255,0.06)', color: '#555', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>BE</span>
}

function RatingStars({ rating }) {
  if (!rating) return <span style={{ color: '#2a2a2a', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={10} fill={rating >= n ? '#00c9a7' : 'none'} stroke={rating >= n ? '#00c9a7' : '#2a2a2a'} strokeWidth={1.5} />
      ))}
    </div>
  )
}

const COLUMNS = [
  { key: 'open_date',          label: 'Date',   align: 'left',   sortable: true  },
  { key: 'trade',              label: 'Trade',  align: 'left',   sortable: false },
  { key: 'contracts',          label: 'Qty',    align: 'right',  sortable: true  },
  { key: 'avg_entry_price',    label: 'Entry',  align: 'right',  sortable: true  },
  { key: 'avg_exit_price',     label: 'Exit',   align: 'right',  sortable: true  },
  { key: 'net_pnl',            label: 'P&L',    align: 'right',  sortable: true  },
  { key: 'net_roi_pct',        label: 'ROI',    align: 'right',  sortable: true  },
  { key: 'hold_time_minutes',  label: 'Hold',   align: 'right',  sortable: true  },
  { key: 'rating',             label: 'Rating', align: 'center', sortable: true  },
  { key: 'status',             label: 'Status', align: 'center', sortable: true  },
]

const INPUT = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 7,
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
}

const SELECT = {
  ...INPUT,
  appearance: 'none',
  paddingRight: 28,
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23444' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
}

export default function TradeViewPage({ session }) {
  const navigate = useNavigate()
  const [trades, setTrades]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState({ col: 'open_date', dir: 'desc' })
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [typeFilter, setType]       = useState('All')
  const [page, setPage]             = useState(0)

  useEffect(() => {
    supabase.from('trades').select('*')
      .eq('user_id', session.user.id)
      .order('open_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setTrades(data || [])
        setLoading(false)
      })
  }, [session.user.id])

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })
    setPage(0)
  }

  const filtered = useMemo(() => {
    let r = [...trades]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(t => t.symbol?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'All') {
      if (statusFilter === 'OPEN') r = r.filter(t => t.trade_status === 'OPEN')
      else r = r.filter(t => t.trade_status === 'CLOSED' && t.status === statusFilter)
    }
    if (typeFilter !== 'All') r = r.filter(t => t.option_type === typeFilter)

    r.sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sort.dir === 'asc' ? av - bv : bv - av
    })
    return r
  }, [trades, search, statusFilter, typeFilter, sort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const hasFilters = search.trim() || statusFilter !== 'All' || typeFilter !== 'All'

  const clearFilters = () => { setSearch(''); setStatus('All'); setType('All'); setPage(0) }

  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronDown size={10} style={{ color: '#2a2a2a', marginLeft: 3 }} />
    return sort.dir === 'asc'
      ? <ChevronUp size={10} style={{ color: '#00c9a7', marginLeft: 3 }} />
      : <ChevronDown size={10} style={{ color: '#00c9a7', marginLeft: 3 }} />
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Trades</h1>
        <p style={{ color: '#444', fontSize: 14, marginTop: 6 }}>
          {loading ? 'Loading…' : `${filtered.length} of ${trades.length} trade${trades.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Symbol…"
            style={{ ...INPUT, paddingLeft: 30, width: 140 }}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(0) }} style={{ ...SELECT, width: 130 }}>
          <option value="All">All Results</option>
          <option value="WIN">Win</option>
          <option value="LOSS">Loss</option>
          <option value="BREAKEVEN">Breakeven</option>
          <option value="OPEN">Open</option>
        </select>
        <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(0) }} style={{ ...SELECT, width: 120 }}>
          <option value="All">All Types</option>
          <option value="Call">Call</option>
          <option value="Put">Put</option>
          <option value="Stock">Stock</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#1a1a1a', border: '1px solid #1f1f1f', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 28px', textAlign: 'center', color: '#333', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 28px', textAlign: 'center', color: '#333', fontSize: 13 }}>No trades match your filters.</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      style={{
                        padding: '12px 20px',
                        textAlign: col.align,
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: sort.col === col.key ? '#00c9a7' : '#444',
                        cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {col.label}
                        {col.sortable && <SortIcon col={col.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map(t => {
                  const pnlColor = (t.net_pnl || 0) >= 0 ? '#00c9a7' : '#e94560'
                  const roiColor = (t.net_roi_pct || 0) >= 0 ? '#00c9a7' : '#e94560'
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/trades/${t.id}`)}
                      style={{ borderBottom: '1px solid #1f1f1f', cursor: 'pointer' }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td style={{ padding: '13px 20px', color: '#555', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(t.open_date)}</td>
                      <td style={{ padding: '13px 20px', color: '#e2e8f0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {t.symbol}
                        {t.option_type && t.option_type !== 'Stock' && ` ${t.strike} ${t.option_type}`}
                        {t.expiration_date && <span style={{ color: '#444', fontWeight: 400, marginLeft: 4, fontSize: 12 }}>{fmtDate(t.expiration_date)}</span>}
                      </td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', color: '#555', fontSize: 12 }}>{t.contracts ?? '—'}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', color: '#555', fontSize: 12 }}>${parseFloat(t.avg_entry_price || 0).toFixed(2)}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', color: '#555', fontSize: 12 }}>
                        {t.trade_status === 'OPEN' ? <span style={{ color: '#333', fontStyle: 'italic' }}>Open</span> : `$${parseFloat(t.avg_exit_price || 0).toFixed(2)}`}
                      </td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: pnlColor }}>{fmtSigned(t.net_pnl || 0)}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', fontSize: 12, color: roiColor }}>
                        {t.net_roi_pct != null ? `${t.net_roi_pct >= 0 ? '+' : ''}${parseFloat(t.net_roi_pct).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '13px 20px', textAlign: 'right', color: '#555', fontSize: 12 }}>{fmtHold(t.hold_time_minutes)}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'center' }}><RatingStars rating={t.rating} /></td>
                      <td style={{ padding: '13px 20px', textAlign: 'center' }}><StatusBadge trade={t} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #1f1f1f' }}>
                <span style={{ fontSize: 12, color: '#444' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{ padding: '5px 12px', background: '#222', border: '1px solid #1f1f1f', borderRadius: 6, color: page === 0 ? '#2a2a2a' : '#888', fontSize: 12, cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                  >← Prev</button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    style={{ padding: '5px 12px', background: '#222', border: '1px solid #1f1f1f', borderRadius: 6, color: page >= totalPages - 1 ? '#2a2a2a' : '#888', fontSize: 12, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
                  >Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronRight } from 'lucide-react'

const CARD_STYLE = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,201,167,0.06)',
}

function fmtMoney(n) {
  const v = n || 0
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSigned(n) {
  const v = n || 0
  return (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(str) {
  if (!str) return ''
  const [, m, d] = str.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function fmtFull(str) {
  if (!str) return ''
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
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

export default function DayViewPage({ session }) {
  const navigate = useNavigate()
  const [trades, setTrades]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase.from('trades').select('*')
      .eq('user_id', session.user.id)
      .order('open_date', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setTrades(data || [])
        setLoading(false)
      })
  }, [session.user.id])

  const days = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      if (!map[t.open_date]) map[t.open_date] = []
      map[t.open_date].push(t)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayTrades]) => {
      const closed = dayTrades.filter(t => t.trade_status === 'CLOSED')
      const wins   = closed.filter(t => t.status === 'WIN').length
      const losses = closed.filter(t => t.status === 'LOSS').length
      const netPnl = closed.reduce((s, t) => s + (t.net_pnl || 0), 0)
      return { date, trades: dayTrades, wins, losses, netPnl }
    })
  }, [trades])

  if (loading) {
    return <div style={{ padding: '32px 36px', color: '#333', fontSize: 14 }}>Loading…</div>
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Day View</h1>
        <p style={{ color: '#444', fontSize: 14, marginTop: 8 }}>{days.length} trading day{days.length !== 1 ? 's' : ''}</p>
      </div>

      {days.length === 0 ? (
        <div style={{ ...CARD_STYLE, minHeight: 300, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p className="text-sm mb-3" style={{ color: '#444' }}>No trades yet.</p>
          <a href="#/add-trade" style={{ color: '#00c9a7', fontSize: 14 }}>Add your first trade →</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {days.map(({ date, trades: dayTrades, wins, losses, netPnl }) => {
            const isOpen = expanded === date
            const pnlColor = netPnl >= 0 ? '#00c9a7' : '#e94560'

            return (
              <div key={date} style={CARD_STYLE}>
                {/* Day header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : date)}
                  className="w-full flex items-center gap-4 transition-colors hover:bg-white/[0.015]"
                  style={{
                    padding: '18px 28px',
                    borderRadius: isOpen ? '12px 12px 0 0' : 12,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {isOpen
                    ? <ChevronDown size={13} style={{ color: '#444', flexShrink: 0 }} />
                    : <ChevronRight size={13} style={{ color: '#333', flexShrink: 0 }} />}

                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, width: 200, flexShrink: 0 }}>
                    {fmtFull(date)}
                  </span>

                  <span style={{ color: '#444', fontSize: 12, width: 80, flexShrink: 0 }}>
                    {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                  </span>

                  <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                    {wins   > 0 && <span style={{ color: '#00c9a7', fontSize: 12, fontWeight: 700 }}>{wins}W</span>}
                    {losses > 0 && <span style={{ color: '#e94560', fontSize: 12, fontWeight: 700 }}>{losses}L</span>}
                  </div>

                  <span style={{ color: pnlColor, fontWeight: 700, fontSize: 15 }}>
                    {fmtSigned(netPnl)}
                  </span>
                </button>

                {/* Trade rows */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #1f1f1f' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                          {['Time', 'Trade', 'Qty', 'Entry', 'Exit', 'P&L', 'ROI', 'Status'].map((h, i) => (
                            <th key={h} style={{
                              padding: '10px 28px',
                              textAlign: i < 2 ? 'left' : i === 7 ? 'center' : 'right',
                              fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
                              letterSpacing: '0.05em', color: '#444',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...dayTrades]
                          .sort((a, b) => (a.open_time || '').localeCompare(b.open_time || ''))
                          .map(t => (
                            <tr
                              key={t.id}
                              onClick={() => navigate(`/trades/${t.id}`)}
                              style={{ borderBottom: '1px solid #1f1f1f', cursor: 'pointer' }}
                              className="hover:bg-white/[0.02] transition-colors"
                            >
                              <td style={{ padding: '13px 28px', color: '#444', fontSize: 12 }}>
                                {t.open_time ? t.open_time.slice(0, 5) : '—'}
                              </td>
                              <td style={{ padding: '13px 28px', color: '#e2e8f0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                                {t.symbol}{t.option_type && ` ${t.strike} ${t.option_type}`}
                                {t.expiration_date && <span style={{ color: '#444', fontWeight: 400, marginLeft: 4 }}>{fmtShort(t.expiration_date)}</span>}
                              </td>
                              <td style={{ padding: '13px 28px', textAlign: 'right', color: '#555', fontSize: 12 }}>{t.contracts}</td>
                              <td style={{ padding: '13px 28px', textAlign: 'right', color: '#555', fontSize: 12 }}>${parseFloat(t.avg_entry_price || 0).toFixed(2)}</td>
                              <td style={{ padding: '13px 28px', textAlign: 'right', color: '#555', fontSize: 12 }}>
                                {t.trade_status === 'OPEN'
                                  ? <span style={{ color: '#333', fontStyle: 'italic' }}>Open</span>
                                  : `$${parseFloat(t.avg_exit_price || 0).toFixed(2)}`}
                              </td>
                              <td style={{ padding: '13px 28px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: (t.net_pnl || 0) >= 0 ? '#00c9a7' : '#e94560' }}>
                                {fmtSigned(t.net_pnl || 0)}
                              </td>
                              <td style={{ padding: '13px 28px', textAlign: 'right', fontSize: 12, color: (t.net_roi_pct || 0) >= 0 ? '#00c9a7' : '#e94560' }}>
                                {t.net_roi_pct != null ? `${t.net_roi_pct >= 0 ? '+' : ''}${parseFloat(t.net_roi_pct).toFixed(1)}%` : '—'}
                              </td>
                              <td style={{ padding: '13px 28px', textAlign: 'center' }}><StatusBadge trade={t} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

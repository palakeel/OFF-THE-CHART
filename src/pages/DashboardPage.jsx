import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const RANGES = [
  { key: 'Today', label: 'Today' },
  { key: 'Week',  label: 'Week'  },
  { key: 'Month', label: 'Month' },
  { key: 'YTD',   label: 'YTD'   },
  { key: 'All',   label: 'All'   },
]

function getDateBounds(range) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const str = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = str(now)
  switch (range) {
    case 'Today': return { start: today, end: today }
    case 'Week': { const s = new Date(now); s.setDate(s.getDate() - 6); return { start: str(s), end: today } }
    case 'Month': return { start: str(new Date(now.getFullYear(), now.getMonth(), 1)), end: today }
    case 'YTD':   return { start: `${now.getFullYear()}-01-01`, end: today }
    default:      return { start: null, end: null }
  }
}

function fmtMoney(n) {
  const v = n || 0
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSigned(n) {
  const v = n || 0
  return (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtAxisDate(str) {
  if (!str) return ''
  const [, m, d] = str.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

const CARD_STYLE = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,201,167,0.06)',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1a1a1a',
    border: '1px solid #1f1f1f',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

function RangeButton({ active, onClick, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        background: active ? '#00c9a7' : 'transparent',
        color: active ? '#000' : hovered ? '#e2e8f0' : '#666',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s, background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '24px 28px' }}>
      <div className="section-label mb-3">{label}</div>
      <div className="font-bold leading-none mb-2" style={{ fontSize: 28, color }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: '#444' }}>{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '24px 28px' }}>
      <div className="section-label mb-5">{title}</div>
      {children}
    </div>
  )
}

function DailyPnLTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pnl = payload[0].value
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 4 }}>{fmtAxisDate(label)}</div>
      <div style={{ color: pnl >= 0 ? '#00c9a7' : '#e94560', fontSize: 13, fontWeight: 700 }}>{fmtSigned(pnl)}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center text-[#333] text-sm" style={{ height: 200 }}>
      No data for this period
    </div>
  )
}

function StatusBadge({ trade }) {
  if (trade.trade_status === 'OPEN')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#888' }}>OPEN</span>
  if (trade.status === 'WIN')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(0,201,167,0.12)', color: '#00c9a7' }}>WIN</span>
  if (trade.status === 'LOSS')
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(233,69,96,0.12)', color: '#e94560' }}>LOSS</span>
  return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#555' }}>BE</span>
}

export default function DashboardPage({ session }) {
  const navigate = useNavigate()
  const [trades, setTrades]   = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState('Month')

  useEffect(() => {
    const { start, end } = getDateBounds(range)
    setLoading(true)
    let q = supabase
      .from('trades').select('*')
      .eq('user_id', session.user.id)
      .order('open_date', { ascending: true })
    if (start) q = q.gte('open_date', start)
    if (end)   q = q.lte('open_date', end)
    q.then(({ data, error }) => {
      if (!error) setTrades(data || [])
      setLoading(false)
    })
  }, [range, session.user.id])

  const closed = useMemo(() => trades.filter(t => t.trade_status === 'CLOSED'), [trades])

  const stats = useMemo(() => {
    const wins      = closed.filter(t => t.status === 'WIN')
    const losses    = closed.filter(t => t.status === 'LOSS')
    const netPnl    = closed.reduce((s, t) => s + (t.net_pnl || 0), 0)
    const totalWins = wins.reduce((s, t) => s + (t.net_pnl || 0), 0)
    const totalLoss = Math.abs(losses.reduce((s, t) => s + (t.net_pnl || 0), 0))
    const avgWin    = wins.length   ? totalWins / wins.length   : 0
    const avgLoss   = losses.length ? losses.reduce((s, t) => s + (t.net_pnl || 0), 0) / losses.length : 0
    const winRate   = closed.length ? (wins.length / closed.length) * 100 : 0
    const pf        = totalLoss > 0 ? totalWins / totalLoss : totalWins > 0 ? 999 : 0
    const exp       = (winRate / 100 * avgWin) + ((1 - winRate / 100) * avgLoss)
    return { netPnl, winRate, avgWin, avgLoss, pf, exp, total: closed.length, wins: wins.length, losses: losses.length }
  }, [closed])

  const cumulativeData = useMemo(() => {
    let run = 0
    return closed.map(t => { run += (t.net_pnl || 0); return { date: t.open_date, value: +run.toFixed(2) } })
  }, [closed])

  const dailyData = useMemo(() => {
    const map = {}
    closed.forEach(t => { map[t.open_date] = (map[t.open_date] || 0) + (t.net_pnl || 0) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, pnl]) => ({ date, pnl: +pnl.toFixed(2) }))
  }, [closed])

  const recent = useMemo(() =>
    [...trades].sort((a, b) => {
      const da = `${a.open_date}T${a.open_time || '00:00'}`
      const db = `${b.open_date}T${b.open_time || '00:00'}`
      return db.localeCompare(da)
    }).slice(0, 10)
  , [trades])

  const winBarPct = stats.avgWin + Math.abs(stats.avgLoss) > 0
    ? (stats.avgWin / (stats.avgWin + Math.abs(stats.avgLoss))) * 100 : 50

  const pnlColor = (n) => (n || 0) >= 0 ? '#00c9a7' : '#e94560'

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1400 }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: 40 }}>
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#444' }}>
            {stats.total} trade{stats.total !== 1 ? 's' : ''} in range
          </p>
        </div>

        {/* Range filter — floats right with its own left margin so it never crowds the title */}
        <div style={{
          display: 'flex',
          marginLeft: 32,
          flexShrink: 0,
          background: '#1a1a1a',
          border: '1px solid #1f1f1f',
          borderRadius: 8,
          padding: 4,
          gap: 2,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,201,167,0.06)',
        }}>
          {RANGES.map(({ key, label }) => (
            <RangeButton key={key} active={range === key} onClick={() => setRange(key)}>
              {label}
            </RangeButton>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Net P&L"
          value={fmtSigned(stats.netPnl)}
          sub={`${stats.wins}W · ${stats.losses}L`}
          color={stats.total === 0 ? '#e2e8f0' : pnlColor(stats.netPnl)}
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.total} closed trade${stats.total !== 1 ? 's' : ''}`}
          color={stats.total === 0 ? '#e2e8f0' : stats.winRate >= 50 ? '#00c9a7' : '#e94560'}
        />
        <StatCard
          label="Profit Factor"
          value={stats.pf >= 999 ? '—' : stats.pf.toFixed(2)}
          sub="gross wins / gross losses"
          color={stats.total === 0 ? '#e2e8f0' : stats.pf >= 1 ? '#00c9a7' : '#e94560'}
        />
        <StatCard
          label="Expectancy"
          value={fmtSigned(stats.exp)}
          sub="avg per trade"
          color={stats.total === 0 ? '#e2e8f0' : pnlColor(stats.exp)}
        />
      </div>

      {/* Avg win vs loss bar */}
      <div style={{ ...CARD_STYLE, padding: '24px 28px', marginBottom: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Avg Win vs Avg Loss</span>
          <div className="flex gap-6 text-xs">
            <span style={{ color: '#00c9a7' }}>Avg Win&nbsp;&nbsp;<span className="font-semibold">{fmtMoney(stats.avgWin)}</span></span>
            <span style={{ color: '#e94560' }}>Avg Loss&nbsp;&nbsp;<span className="font-semibold">{fmtMoney(stats.avgLoss)}</span></span>
          </div>
        </div>
        {stats.avgWin === 0 && stats.avgLoss === 0 ? (
          <div className="h-2.5 rounded-full" style={{ background: '#1f1f1f' }} />
        ) : (
          <div className="flex h-2.5 rounded-full overflow-hidden" style={{ gap: 1 }}>
            <div className="rounded-l-full transition-all" style={{ background: '#00c9a7', width: `${winBarPct}%` }} />
            <div className="rounded-r-full transition-all" style={{ background: '#e94560', width: `${100 - winBarPct}%` }} />
          </div>
        )}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
        <ChartCard title="Cumulative P&L">
          {cumulativeData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00c9a7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00c9a7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fill: '#333', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#333', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={65} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [fmtMoney(v), 'Cum. P&L']} labelFormatter={fmtAxisDate} />
                <Area type="monotone" dataKey="value" stroke="#00c9a7" strokeWidth={2} fill="url(#cumGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Daily P&L">
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fill: '#333', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#333', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={65} />
                <Tooltip content={<DailyPnLTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {dailyData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#00c9a7' : '#e94560'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Recent trades */}
      <div style={CARD_STYLE}>
        <div
          className="flex items-center justify-between"
          style={{ padding: '20px 28px', borderBottom: '1px solid #1f1f1f' }}
        >
          <span className="section-label">Recent Trades</span>
          <span className="text-xs" style={{ color: '#333' }}>{trades.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center text-sm" style={{ padding: '48px 28px', color: '#333' }}>
            Loading…
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center" style={{ padding: '48px 28px' }}>
            <p className="text-sm mb-3" style={{ color: '#444' }}>No trades yet.</p>
            <a href="#/add-trade" className="text-sm hover:underline" style={{ color: '#00c9a7' }}>
              Add your first trade →
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                {['Date', 'Trade', 'Qty', 'Entry', 'Exit', 'P&L', 'ROI', 'Status'].map((h, i) => (
                  <th
                    key={h}
                    className="section-label"
                    style={{
                      padding: '12px 28px',
                      textAlign: i < 2 ? 'left' : i === 7 ? 'center' : 'right',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(t => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/trades/${t.id}`)}
                  style={{ borderBottom: '1px solid #1f1f1f', cursor: 'pointer' }}
                  className="transition-colors hover:bg-white/[0.02]"
                >
                  <td style={{ padding: '14px 28px', color: '#555', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtAxisDate(t.open_date)}</td>
                  <td style={{ padding: '14px 28px', color: '#e2e8f0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {t.symbol}{t.option_type && ` ${t.strike} ${t.option_type}`}
                    {t.expiration_date && <span style={{ color: '#444', fontWeight: 400, marginLeft: 4 }}>{fmtAxisDate(t.expiration_date)}</span>}
                  </td>
                  <td style={{ padding: '14px 28px', color: '#555', fontSize: 12, textAlign: 'right' }}>{t.contracts}</td>
                  <td style={{ padding: '14px 28px', color: '#555', fontSize: 12, textAlign: 'right' }}>${parseFloat(t.avg_entry_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '14px 28px', color: '#555', fontSize: 12, textAlign: 'right' }}>
                    {t.trade_status === 'OPEN'
                      ? <span style={{ color: '#333', fontStyle: 'italic' }}>Open</span>
                      : `$${parseFloat(t.avg_exit_price || 0).toFixed(2)}`}
                  </td>
                  <td style={{ padding: '14px 28px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: pnlColor(t.net_pnl) }}>
                    {fmtSigned(t.net_pnl || 0)}
                  </td>
                  <td style={{ padding: '14px 28px', textAlign: 'right', fontSize: 12, color: pnlColor(t.net_roi_pct) }}>
                    {t.net_roi_pct != null ? `${t.net_roi_pct >= 0 ? '+' : ''}${parseFloat(t.net_roi_pct).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '14px 28px', textAlign: 'center' }}><StatusBadge trade={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

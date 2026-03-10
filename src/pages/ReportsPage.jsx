import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Design tokens ───────────────────────────────────────────────────────────
const CARD = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
}
const WIN  = '#00c9a7'
const LOSS = '#e94560'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

function fmtMoney(n) {
  const v = n ?? 0
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtSigned(n) {
  const v = n ?? 0
  return (v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtHoldTime(min) {
  if (!min) return '—'
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function fmtCalPnl(pnl) {
  const abs = Math.abs(pnl)
  const sign = pnl >= 0 ? '+' : '-'
  return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(1)}k` : `${sign}$${Math.round(abs)}`
}
function fmtAxisVal(v) {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(0)}k`
  return `$${v}`
}
const pnlColor = n => ((n ?? 0) >= 0 ? WIN : LOSS)

// ─── Date range ──────────────────────────────────────────────────────────────
const RANGE_OPTS = ['Today', 'Week', 'Month', 'YTD', 'All', 'Custom']

function getDateBounds(range, custom) {
  const now = new Date()
  const today = dateStr(now)
  switch (range) {
    case 'Today':  return { start: today,                                                          end: today }
    case 'Week':   { const s = new Date(now); s.setDate(s.getDate() - 6); return { start: dateStr(s), end: today } }
    case 'Month':  return { start: dateStr(new Date(now.getFullYear(), now.getMonth(), 1)),         end: today }
    case 'YTD':    return { start: `${now.getFullYear()}-01-01`,                                   end: today }
    case 'Custom': return { start: custom.start || null,                                           end: custom.end || null }
    default:       return { start: null,                                                           end: null }
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function computeStats(trades) {
  const closed = trades.filter(t => t.trade_status === 'CLOSED')
  if (!closed.length) return null

  const wins   = closed.filter(t => t.status === 'WIN')
  const losses = closed.filter(t => t.status === 'LOSS')
  const bes    = closed.filter(t => t.status === 'BREAKEVEN')

  const netPnl    = closed.reduce((s, t) => s + (t.net_pnl  || 0), 0)
  const grossWins = wins.reduce((s, t)   => s + (t.net_pnl  || 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.net_pnl || 0), 0))
  const avgWin    = wins.length   ? grossWins / wins.length   : 0
  const avgLoss   = losses.length ? losses.reduce((s, t) => s + (t.net_pnl || 0), 0) / losses.length : 0
  const winRate   = (wins.length / closed.length) * 100
  const pf        = grossLoss > 0 ? grossWins / grossLoss : grossWins > 0 ? 999 : 0
  const exp       = (winRate / 100 * avgWin) + ((1 - winRate / 100) * avgLoss)

  // Consecutive streaks (sorted by date + time)
  const sorted = [...closed].sort((a, b) =>
    `${a.open_date}${a.open_time || ''}`.localeCompare(`${b.open_date}${b.open_time || ''}`)
  )
  let maxCW = 0, maxCL = 0, cw = 0, cl = 0
  for (const t of sorted) {
    if      (t.status === 'WIN')  { cw++; cl = 0; if (cw > maxCW) maxCW = cw }
    else if (t.status === 'LOSS') { cl++; cw = 0; if (cl > maxCL) maxCL = cl }
    else                          { cw = 0; cl = 0 }
  }

  const netPnls    = closed.map(t => t.net_pnl || 0)
  const bestTrade  = Math.max(...netPnls)
  const worstTrade = Math.min(...netPnls)

  const dailyMap = {}
  closed.forEach(t => { dailyMap[t.open_date] = (dailyMap[t.open_date] || 0) + (t.net_pnl || 0) })
  const dayVals    = Object.values(dailyMap)
  const bestDay    = dayVals.length ? Math.max(...dayVals) : 0
  const worstDay   = dayVals.length ? Math.min(...dayVals) : 0
  const tradingDays = dayVals.length

  const withHold = closed.filter(t => t.hold_time_minutes != null)
  const avgHold  = withHold.length ? withHold.reduce((s, t) => s + t.hold_time_minutes, 0) / withHold.length : 0

  const grossPnls   = closed.map(t => t.gross_pnl ?? t.net_pnl ?? 0)
  const largestWin  = Math.max(...grossPnls)
  const largestLoss = Math.min(...grossPnls)

  return {
    netPnl, winRate, pf, exp, avgWin, avgLoss,
    total: closed.length, wins: wins.length, losses: losses.length, bes: bes.length,
    maxCW, maxCL, bestTrade, worstTrade, bestDay, worstDay,
    avgHold, tradingDays, largestWin, largestLoss,
  }
}

// ─── Breakdowns ──────────────────────────────────────────────────────────────
const BREAKDOWN_OPTIONS = [
  { key: 'symbol',   label: 'By Symbol' },
  { key: 'setup',    label: 'By Setup' },
  { key: 'dow',      label: 'By Day of Week' },
  { key: 'tod',      label: 'By Time of Day' },
  { key: 'emotions', label: 'By Emotions & Habits' },
  { key: 'mistakes', label: 'By Mistakes' },
]
const DOW_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TOD_ORDER = ['Pre-Market (<9:30)', 'Morning (9:30–11)', 'Midday (11–2pm)', 'Afternoon (2–4pm)', 'After Hours (>4pm)']

function computeBreakdown(trades, dim) {
  const closed = trades.filter(t => t.trade_status === 'CLOSED')
  const groups = {}
  const add = (key, t) => { if (!groups[key]) groups[key] = []; groups[key].push(t) }

  for (const t of closed) {
    switch (dim) {
      case 'symbol':   add(t.symbol || 'Unknown', t); break
      case 'setup':
        if (t.setups?.length) t.setups.forEach(s => add(s, t)); else add('No Setup', t); break
      case 'dow': {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        add(days[new Date(t.open_date + 'T12:00:00').getDay()], t); break
      }
      case 'tod': {
        if (!t.open_time) { add('Unknown', t); break }
        const [hh, mm] = t.open_time.split(':').map(Number)
        const m = hh * 60 + mm
        if      (m < 9*60+30)  add('Pre-Market (<9:30)', t)
        else if (m < 11*60)    add('Morning (9:30–11)', t)
        else if (m < 14*60)    add('Midday (11–2pm)', t)
        else if (m < 16*60)    add('Afternoon (2–4pm)', t)
        else                   add('After Hours (>4pm)', t)
        break
      }
      case 'emotions':
        if (t.emotions_habits?.length) t.emotions_habits.forEach(e => add(e, t)); else add('None Tagged', t); break
      case 'mistakes':
        if (t.mistakes?.length) t.mistakes.forEach(m => add(m, t)); else add('No Mistakes', t); break
    }
  }

  const rows = Object.entries(groups).map(([name, ts]) => {
    const w = ts.filter(t => t.status === 'WIN')
    const l = ts.filter(t => t.status === 'LOSS')
    return {
      name,
      trades:  ts.length,
      winRate: (w.length / ts.length) * 100,
      netPnl:  ts.reduce((s, t) => s + (t.net_pnl || 0), 0),
      avgWin:  w.length ? w.reduce((s, t) => s + (t.net_pnl || 0), 0) / w.length : null,
      avgLoss: l.length ? l.reduce((s, t) => s + (t.net_pnl || 0), 0) / l.length : null,
    }
  })

  if (dim === 'dow') return rows.sort((a, b) => DOW_ORDER.indexOf(a.name) - DOW_ORDER.indexOf(b.name))
  if (dim === 'tod') return rows.sort((a, b) => TOD_ORDER.indexOf(a.name) - TOD_ORDER.indexOf(b.name))
  return rows.sort((a, b) => b.netPnl - a.netPnl)
}

// ─── Shared components ───────────────────────────────────────────────────────
function RangeButton({ active, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 14px', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        background: active ? WIN : 'transparent',
        color: active ? '#000' : hov ? '#e2e8f0' : '#666',
        transition: 'color 0.15s, background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >{children}</button>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ trades }) {
  const s = useMemo(() => computeStats(trades), [trades])

  if (!s) return (
    <div style={{ textAlign: 'center', padding: '80px 40px', color: '#444', fontSize: 14 }}>
      No closed trades in this range.
    </div>
  )

  const leftMetrics = [
    { label: 'Net P&L',          value: fmtSigned(s.netPnl),               color: pnlColor(s.netPnl) },
    { label: 'Win Rate',         value: `${s.winRate.toFixed(1)}%`,          color: s.winRate >= 50 ? WIN : LOSS },
    { label: 'Profit Factor',    value: s.pf >= 999 ? '∞' : s.pf.toFixed(2), color: s.pf >= 1 ? WIN : LOSS },
    { label: 'Expectancy',       value: fmtSigned(s.exp),                   color: pnlColor(s.exp) },
    { label: 'Avg Win',          value: fmtMoney(s.avgWin),                 color: WIN },
    { label: 'Avg Loss',         value: fmtMoney(Math.abs(s.avgLoss)),      color: LOSS },
    { label: 'Total Trades',     value: s.total,                            color: '#e2e8f0' },
    { label: 'Winning Trades',   value: s.wins,                             color: WIN },
    { label: 'Losing Trades',    value: s.losses,                           color: LOSS },
    { label: 'Breakeven Trades', value: s.bes,                              color: '#888' },
  ]

  const rightMetrics = [
    { label: 'Max Consecutive Wins',   value: s.maxCW,                         color: WIN },
    { label: 'Max Consecutive Losses', value: s.maxCL,                         color: LOSS },
    { label: 'Best Single Trade',      value: fmtSigned(s.bestTrade),          color: pnlColor(s.bestTrade) },
    { label: 'Worst Single Trade',     value: fmtSigned(s.worstTrade),         color: pnlColor(s.worstTrade) },
    { label: 'Best Day',               value: fmtSigned(s.bestDay),            color: pnlColor(s.bestDay) },
    { label: 'Worst Day',              value: fmtSigned(s.worstDay),           color: pnlColor(s.worstDay) },
    { label: 'Avg Hold Time',          value: fmtHoldTime(s.avgHold),          color: '#e2e8f0' },
    { label: 'Total Trading Days',     value: s.tradingDays,                   color: '#e2e8f0' },
    { label: 'Largest Win',            value: fmtSigned(s.largestWin),         color: WIN },
    { label: 'Largest Loss',           value: fmtSigned(s.largestLoss),        color: LOSS },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[leftMetrics, rightMetrics].map((col, ci) => (
        <div key={ci} style={{ ...CARD, padding: '8px 28px' }}>
          {col.map(({ label, value, color }, i) => (
            <div
              key={label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 0',
                borderBottom: i < col.length - 1 ? '1px solid #1f1f1f' : 'none',
              }}
            >
              <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Breakdowns tab ──────────────────────────────────────────────────────────
function BdTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: WIN }}>{fmtSigned(v)}</div>
    </div>
  )
}

function BreakdownTab({ trades }) {
  const [dim, setDim] = useState('symbol')
  const data    = useMemo(() => computeBreakdown(trades, dim), [trades, dim])
  const maxAbs  = useMemo(() => Math.max(...data.map(d => Math.abs(d.netPnl)), 1), [data])
  const barH = Math.max(data.length * 40, 80)

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Left filter sidebar */}
      <div style={{ ...CARD, padding: '12px 8px', width: 256, flexShrink: 0 }}>
        {BREAKDOWN_OPTIONS.map(({ key, label }) => {
          const active = dim === key
          return (
            <button
              key={key}
              onClick={() => setDim(key)}
              style={{
                display: 'block', width: '100%', padding: '10px 12px',
                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: active ? 'rgba(0,201,167,0.08)' : 'transparent',
                color: active ? WIN : '#555',
                fontSize: 13, marginBottom: 2,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#555' }}
            >{label}</button>
          )
        })}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {data.length === 0 ? (
          <div style={{ ...CARD, padding: '60px 40px', textAlign: 'center', color: '#444', fontSize: 14 }}>
            No data for this breakdown.
          </div>
        ) : (
          <>
            {/* Chart */}
            <div style={{ ...CARD, padding: '24px 28px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
                {BREAKDOWN_OPTIONS.find(o => o.key === dim)?.label} — Net P&L
              </div>
              <ResponsiveContainer width="100%" height={barH}>
                <BarChart layout="vertical" data={data} margin={{ top: 0, right: 48, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[-maxAbs * 1.1, maxAbs * 1.1]}
                    tick={{ fill: '#333', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmtAxisVal}
                  />
                  <YAxis
                    type="category" dataKey="name"
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    content={<BdTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  />
                  <ReferenceLine x={0} stroke="#2a2a2a" />
                  <Bar dataKey="netPnl" radius={[0, 3, 3, 0]} maxBarSize={20}>
                    {data.map((d, i) => <Cell key={i} fill={d.netPnl >= 0 ? WIN : LOSS} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div style={CARD}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                    {['Name', 'Trades', 'Win Rate', 'Net P&L', 'Avg Win', 'Avg Loss'].map((h, i) => (
                      <th key={h} style={{
                        padding: '12px 20px', textAlign: i === 0 ? 'left' : 'right',
                        fontSize: 11, fontWeight: 500, color: '#555',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < data.length - 1 ? '1px solid #141414' : 'none' }}>
                      <td style={{ padding: '12px 20px', color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: '12px 20px', color: '#888', fontSize: 12, textAlign: 'right' }}>{row.trades}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, textAlign: 'right', color: row.winRate >= 50 ? WIN : LOSS }}>
                        {row.winRate.toFixed(1)}%
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: pnlColor(row.netPnl) }}>
                        {fmtSigned(row.netPnl)}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, textAlign: 'right', color: WIN }}>
                        {row.avgWin != null ? fmtMoney(row.avgWin) : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 12, textAlign: 'right', color: LOSS }}>
                        {row.avgLoss != null ? fmtMoney(Math.abs(row.avgLoss)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

function MonthGrid({ year, month, dailyMap, today, onDayClick }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow    = new Date(year, month, 1).getDay()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`
    cells.push({ day: d, key, pnl: dailyMap[key] })
  }

  return (
    <div style={{ ...CARD, padding: '16px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {MONTH_NAMES[month]}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 4 }}>
        {DOW_SHORT.map(d => (
          <div key={d} style={{ fontSize: 9, color: '#2a2a2a', textAlign: 'center', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} style={{ height: 38 }} />
          const hasTrade = cell.pnl !== undefined
          const isWin    = hasTrade && cell.pnl >= 0
          const isToday  = cell.key === today
          const bgBase   = hasTrade ? (isWin ? 'rgba(0,201,167,0.14)' : 'rgba(233,69,96,0.14)') : 'transparent'
          const bgHover  = hasTrade ? (isWin ? 'rgba(0,201,167,0.26)' : 'rgba(233,69,96,0.26)') : 'rgba(255,255,255,0.03)'
          const dayColor = hasTrade ? (isWin ? WIN : LOSS) : '#2d2d2d'

          return (
            <div
              key={cell.key}
              onClick={() => hasTrade && onDayClick(cell.key)}
              style={{
                background: bgBase,
                borderRadius: 4,
                padding: '3px 2px',
                textAlign: 'center',
                cursor: hasTrade ? 'pointer' : 'default',
                border: isToday ? `1px solid ${WIN}44` : '1px solid transparent',
                height: 38,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 1,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = bgHover }}
              onMouseLeave={e => { e.currentTarget.style.background = bgBase }}
            >
              <div style={{ fontSize: 10, color: dayColor, fontWeight: hasTrade ? 600 : 400, lineHeight: 1 }}>
                {cell.day}
              </div>
              {hasTrade && (
                <div style={{ fontSize: 8, color: dayColor, fontWeight: 500, lineHeight: 1, opacity: 0.9 }}>
                  {fmtCalPnl(cell.pnl)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarTab({ trades }) {
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear())
  const today = dateStr(new Date())

  const dailyMap = useMemo(() => {
    const map = {}
    trades.filter(t => t.trade_status === 'CLOSED' && t.open_date).forEach(t => {
      map[t.open_date] = (map[t.open_date] || 0) + (t.net_pnl || 0)
    })
    return map
  }, [trades])

  const handleDayClick = key => navigate('/day-view', { state: { date: key } })

  return (
    <div>
      {/* Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => setYear(y => y - 1)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = '#555'}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', minWidth: 52, textAlign: 'center' }}>{year}</span>
        <button
          onClick={() => setYear(y => y + 1)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = '#555'}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 4×3 month grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid
            key={m}
            year={year}
            month={m}
            dailyMap={dailyMap}
            today={today}
            onDayClick={handleDayClick}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Breakdowns', 'Calendar']

export default function ReportsPage({ session }) {
  const [trades,      setTrades]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('Overview')
  const [range,       setRange]       = useState('YTD')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  useEffect(() => {
    const { start, end } = getDateBounds(range, customDates)
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
  }, [range, customDates, session.user.id])

  const closedCount = trades.filter(t => t.trade_status === 'CLOSED').length

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1400, width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Reports</h1>
        <p style={{ fontSize: 12, color: '#444' }}>
          {loading ? 'Loading…' : `${closedCount} closed trade${closedCount !== 1 ? 's' : ''} in range`}
        </p>
      </div>

      {/* Global date range filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', gap: 2, padding: 4, borderRadius: 8,
          background: '#1a1a1a', border: '1px solid #1f1f1f',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,201,167,0.06)',
        }}>
          {RANGE_OPTS.map(r => (
            <RangeButton key={r} active={range === r} onClick={() => setRange(r)}>{r}</RangeButton>
          ))}
        </div>

        {range === 'Custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date" value={customDates.start}
              onChange={e => setCustomDates(d => ({ ...d, start: e.target.value }))}
              style={{
                background: '#1a1a1a', border: '1px solid #1f1f1f', borderRadius: 6,
                color: '#e2e8f0', padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                outline: 'none',
              }}
            />
            <span style={{ color: '#333', fontSize: 12 }}>→</span>
            <input
              type="date" value={customDates.end}
              onChange={e => setCustomDates(d => ({ ...d, end: e.target.value }))}
              style={{
                background: '#1a1a1a', border: '1px solid #1f1f1f', borderRadius: 6,
                color: '#e2e8f0', padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1f1f1f', marginBottom: 24 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 22px', fontSize: 13, border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#e2e8f0' : '#555',
              background: 'transparent',
              borderBottom: activeTab === tab ? `2px solid ${WIN}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >{tab}</button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', color: '#333', fontSize: 14 }}>
          Loading…
        </div>
      ) : (
        <>
          {activeTab === 'Overview'   && <OverviewTab   trades={trades} />}
          {activeTab === 'Breakdowns' && <BreakdownTab  trades={trades} />}
          {activeTab === 'Calendar'   && <CalendarTab   trades={trades} />}
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Edit2, Star, Check } from 'lucide-react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDateLong(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(str) {
  if (!str) return null
  const [h, m] = str.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDateShort(str) {
  if (!str) return '—'
  const [, m, d] = str.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function fmtSigned(n) {
  if (n == null) return '—'
  return (n > 0 ? '+' : n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHold(mins) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h >= 24) { const d = Math.floor(h / 24); const rh = h % 24; return rh > 0 ? `${d}d ${rh}h` : `${d}d` }
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ trade }) {
  if (trade.trade_status === 'OPEN')
    return <span style={{ background: 'rgba(255,255,255,0.07)', color: '#666', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>OPEN</span>
  if (trade.status === 'WIN')
    return <span style={{ background: 'rgba(0,201,167,0.12)', color: '#00c9a7', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>WIN</span>
  if (trade.status === 'LOSS')
    return <span style={{ background: 'rgba(233,69,96,0.12)', color: '#e94560', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>LOSS</span>
  return <span style={{ background: 'rgba(255,255,255,0.07)', color: '#555', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>BE</span>
}

function StatCell({ label, value, color, border }) {
  return (
    <div style={{ padding: '20px 24px', borderRight: border ? '1px solid #1f1f1f' : 'none' }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#e2e8f0', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#c8c8c8' }}>{value}</div>
    </div>
  )
}

function TagGroup({ label, tags }) {
  if (!tags || tags.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {tags.map(t => (
          <span key={t} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, background: 'transparent', border: '1px solid #00c9a7', color: '#00c9a7' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Intraday price chart ──────────────────────────────────────────────────────
function fmtChartTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', hour12: true,
  })
}

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#555', marginBottom: 4 }}>{fmtChartTime(label)}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>${parseFloat(payload[0].value).toFixed(2)}</div>
    </div>
  )
}

function TradeChart({ trade }) {
  const { chart_data, open_ts_ms, close_ts_ms, option_type, underlying_mae_pct, underlying_mfe_pct } = trade
  if (!chart_data || chart_data.length === 0) {
    return (
      <div style={CARD}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Price Chart</span>
        </div>
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: '#2a2a2a', fontSize: 13, margin: 0 }}>
            No chart data — run <code style={{ color: '#444', fontSize: 12 }}>python fetch-chart-data.py</code> to fetch from Polygon
          </p>
        </div>
      </div>
    )
  }

  const lineColor = option_type === 'Put' ? '#e94560' : '#00c9a7'
  const gradId    = option_type === 'Put' ? 'putGrad' : 'callGrad'

  // Thin out to max 300 points for render performance
  const points = chart_data.length > 300
    ? chart_data.filter((_, i) => i % Math.ceil(chart_data.length / 300) === 0)
    : chart_data

  const prices = points.map(p => p.c)
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const pad    = (maxP - minP) * 0.15 || 0.5

  return (
    <div style={CARD}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>
          Underlying Price
        </span>
        <div style={{ display: 'flex', gap: 24 }}>
          {underlying_mfe_pct != null && (
            <span style={{ fontSize: 12, color: '#555' }}>
              MFE&nbsp;<span style={{ color: '#00c9a7', fontWeight: 600 }}>+{underlying_mfe_pct.toFixed(2)}%</span>
            </span>
          )}
          {underlying_mae_pct != null && (
            <span style={{ fontSize: 12, color: '#555' }}>
              MAE&nbsp;<span style={{ color: '#e94560', fontWeight: 600 }}>-{underlying_mae_pct.toFixed(2)}%</span>
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 8px 12px 0' }}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={lineColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtChartTime}
              tick={{ fill: '#333', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickCount={6}
            />
            <YAxis
              domain={[minP - pad, maxP + pad]}
              tickFormatter={v => `$${v.toFixed(2)}`}
              tick={{ fill: '#333', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="c"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
            {open_ts_ms && (
              <ReferenceLine
                x={open_ts_ms}
                stroke="#00c9a7"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{ value: 'In', position: 'top', fill: '#00c9a7', fontSize: 10, fontWeight: 600 }}
              />
            )}
            {close_ts_ms && (
              <ReferenceLine
                x={close_ts_ms}
                stroke="#e94560"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{ value: 'Out', position: 'top', fill: '#e94560', fontSize: 10, fontWeight: 600 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Auto-save journal (right column) ─────────────────────────────────────────
function JournalCard({ trade, onUpdate }) {
  const [notes, setNotes]     = useState(trade.setup_notes || '')
  const [learnings, setLearnings] = useState(trade.outcomes_learnings || '')
  const [rating, setRating]   = useState(trade.rating || 0)
  const [reviewed, setReviewed] = useState(trade.reviewed || false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const debounceRef = useRef(null)

  const save = useCallback(async (patch) => {
    setSaveStatus('saving')
    const { error } = await supabase.from('trades').update(patch).eq('id', trade.id)
    if (!error) {
      setSaveStatus('saved')
      onUpdate(patch)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('idle')
    }
  }, [trade.id, onUpdate])

  const scheduleTextSave = (patch) => {
    clearTimeout(debounceRef.current)
    setSaveStatus('idle')
    debounceRef.current = setTimeout(() => save(patch), 800)
  }

  const handleRating = (n) => {
    const next = rating === n ? 0 : n
    setRating(next)
    save({ rating: next || null })
  }

  const handleReviewed = () => {
    const next = !reviewed
    setReviewed(next)
    save({ reviewed: next })
  }

  const TEXTAREA = {
    width: '100%',
    background: '#111',
    border: '1px solid #1f1f1f',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 1.65,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: 80,
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ ...CARD, padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header + save status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Journal</span>
        <span style={{
          fontSize: 11, color: saveStatus === 'saved' ? '#00c9a7' : '#444',
          opacity: saveStatus === 'idle' ? 0 : 1,
          transition: 'opacity 0.3s, color 0.3s',
        }}>
          {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      {/* Setup Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#444' }}>Setup Notes</div>
        <FocusTextarea
          value={notes}
          onChange={e => { setNotes(e.target.value); scheduleTextSave({ setup_notes: e.target.value || null }) }}
          placeholder="What was your thesis before entering?"
          style={TEXTAREA}
        />
      </div>

      {/* Outcomes & Learnings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#444' }}>Outcomes & Learnings</div>
        <FocusTextarea
          value={learnings}
          onChange={e => { setLearnings(e.target.value); scheduleTextSave({ outcomes_learnings: e.target.value || null }) }}
          placeholder="What happened? What did you learn?"
          style={TEXTAREA}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1f1f1f' }} />

      {/* Rating */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#444' }}>Rating</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => handleRating(n)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', lineHeight: 0 }}
            >
              <Star size={22} fill={rating >= n ? '#00c9a7' : 'none'} stroke={rating >= n ? '#00c9a7' : '#333'} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>

      {/* Reviewed */}
      <div
        onClick={handleReviewed}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: `1px solid ${reviewed ? '#00c9a7' : '#2a2a2a'}`,
          background: reviewed ? '#00c9a7' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          {reviewed && <Check size={12} style={{ color: '#000' }} />}
        </div>
        <span style={{ fontSize: 13, color: reviewed ? '#e2e8f0' : '#555' }}>Reviewed</span>
      </div>

    </div>
  )
}

// Textarea with focus border
function FocusTextarea({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      style={{ ...style, borderColor: focused ? '#00c9a7' : '#1f1f1f' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TradeDetailPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trade, setTrade]       = useState(null)
  const [legs, setLegs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('trades').select('*').eq('id', id).eq('user_id', session.user.id).single(),
      supabase.from('trade_legs').select('*').eq('trade_id', id).order('transaction_date').order('transaction_time'),
    ]).then(([{ data: t, error: te }, { data: l }]) => {
      if (te || !t) setNotFound(true)
      else { setTrade(t); setLegs(l || []) }
      setLoading(false)
    })
  }, [id, session.user.id])

  const handleJournalUpdate = useCallback((patch) => {
    setTrade(prev => prev ? { ...prev, ...patch } : prev)
  }, [])

  if (loading)  return <div style={{ padding: '36px 40px', color: '#333', fontSize: 14 }}>Loading…</div>
  if (notFound) return (
    <div style={{ padding: '36px 40px' }}>
      <button onClick={() => navigate('/trades')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0, marginBottom: 24 }}>
        <ArrowLeft size={14} /> Back to Trades
      </button>
      <p style={{ color: '#444' }}>Trade not found.</p>
    </div>
  )

  // ── Derived values ──────────────────────────────────────────────────────────
  const pnlColor = trade.net_pnl != null ? (trade.net_pnl >= 0 ? '#00c9a7' : '#e94560') : '#e2e8f0'
  const roiColor = trade.net_roi_pct != null ? (trade.net_roi_pct >= 0 ? '#00c9a7' : '#e94560') : '#e2e8f0'

  const marketContextTags = trade.market_context
    ? trade.market_context.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const tradeTitle = [
    trade.symbol,
    trade.option_type !== 'Stock' && trade.strike ? trade.strike : null,
    trade.option_type !== 'Stock' ? trade.option_type : null,
  ].filter(Boolean).join(' ')

  const expLabel = trade.expiration_date
    ? new Date(trade.expiration_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    : null

  const openStr  = [fmtDateLong(trade.open_date), fmtTime(trade.open_time)].filter(Boolean).join(' · ')
  const closeStr = trade.trade_status === 'OPEN'
    ? 'Still open'
    : [fmtDateLong(trade.close_date), fmtTime(trade.close_time)].filter(Boolean).join(' · ')

  const hasTags = trade.setups?.length || trade.trade_type?.length || marketContextTags.length || trade.emotions_habits?.length || trade.mistakes?.length

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate('/trades')}
            style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: 0, marginBottom: 20 }}
            className="hover:text-[#888] transition-colors"
          >
            <ArrowLeft size={12} /> Trades
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', margin: 0, lineHeight: 1 }}>
                {tradeTitle}
              </h1>
              {expLabel && (
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#555' }}>
                  exp {expLabel}
                </span>
              )}
              <StatusBadge trade={trade} />
            </div>
            <button
              onClick={() => navigate(`/trades/${id}/edit`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#666', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
              className="hover:text-[#e2e8f0] hover:border-[#333] transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{ ...CARD, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', overflow: 'hidden' }}>
          <StatCell label="Net P&L"   value={fmtSigned(trade.net_pnl)}  color={pnlColor} border />
          <StatCell label="ROI"       value={trade.net_roi_pct != null ? `${trade.net_roi_pct >= 0 ? '+' : ''}${parseFloat(trade.net_roi_pct).toFixed(1)}%` : '—'} color={roiColor} border />
          <StatCell label="Contracts" value={trade.contracts ?? '—'}     border />
          <StatCell label="Avg Entry" value={trade.avg_entry_price != null ? `$${parseFloat(trade.avg_entry_price).toFixed(2)}` : '—'} border />
          <StatCell label="Avg Exit"  value={trade.trade_status === 'OPEN' ? 'Open' : trade.avg_exit_price != null ? `$${parseFloat(trade.avg_exit_price).toFixed(2)}` : '—'} border />
          <StatCell label="Hold Time" value={fmtHold(trade.hold_time_minutes)} />
        </div>

        {/* ── CHART ── */}
        <div style={{ marginBottom: 16 }}>
          <TradeChart trade={trade} />
        </div>

        {/* ── TWO COLUMNS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

          {/* LEFT — Trade Info */}
          <div style={{ ...CARD, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Trade Info</span>

            <InfoRow label="Opened" value={openStr} />
            <InfoRow label="Closed" value={closeStr} />

            {hasTags && <div style={{ height: 1, background: '#1f1f1f' }} />}

            <TagGroup label="Market Context"    tags={marketContextTags} />
            <TagGroup label="Trade Type"        tags={trade.trade_type} />
            <TagGroup label="Setups"            tags={trade.setups} />
            <TagGroup label="Emotions & Habits" tags={trade.emotions_habits} />
            <TagGroup label="Mistakes"          tags={trade.mistakes} />
          </div>

          {/* RIGHT — Journal (inline auto-save) */}
          <JournalCard trade={trade} onUpdate={handleJournalUpdate} />
        </div>

        {/* ── EXECUTIONS ── */}
        <div style={CARD}>
          <div style={{ padding: '18px 24px', borderBottom: legs.length > 0 ? '1px solid #1f1f1f' : 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Executions</span>
          </div>

          {legs.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ color: '#2a2a2a', fontSize: 13, margin: 0 }}>No execution data — coming with screenshot parser</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Date', 'Time', 'Action', 'Qty', 'Price', 'Value'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 24px',
                      textAlign: i >= 2 ? 'right' : 'left',
                      fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#444',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {legs.map(leg => {
                  const value = leg.price && leg.qty ? leg.price * leg.qty * 100 : null
                  return (
                    <tr key={leg.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
                      <td style={{ padding: '12px 24px', color: '#555', fontSize: 12 }}>{fmtDateShort(leg.transaction_date)}</td>
                      <td style={{ padding: '12px 24px', color: '#555', fontSize: 12 }}>{fmtTime(leg.transaction_time) || '—'}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: leg.action === 'BTO' ? 'rgba(233,69,96,0.1)' : 'rgba(0,201,167,0.1)',
                          color: leg.action === 'BTO' ? '#e94560' : '#00c9a7',
                        }}>{leg.action}</span>
                      </td>
                      <td style={{ padding: '12px 24px', textAlign: 'right', color: '#888', fontSize: 13 }}>{leg.qty}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'right', color: '#888', fontSize: 13 }}>${parseFloat(leg.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>
                        {value != null ? `$${value.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

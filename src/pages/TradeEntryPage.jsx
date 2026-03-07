import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, Plus, ChevronDown, Star } from 'lucide-react'

// ── Options ──────────────────────────────────────────────────────────────────
const SETUP_BASE     = ['breakout', 'pullback', 'reversal', 'trend continuation', 'support/resistance', 'vwap reclaim', 'earnings play', 'opening range break', 'gap fill']
const TRADE_TYPE_BASE = ['day trade', 'swing trade', 'etf', 'stock', 'high conviction', 'callout', 'idea trade']
const MARKET_CTX_BASE = ['bullish trend', 'bearish trend', 'choppy/ranging', 'high volatility', 'low volatility', 'pre-market move', 'post-news', 'gap up open', 'gap down open']
const EMOTION_BASE   = ['calm & disciplined', 'confident', 'blind faith', 'boredom', 'FOMO', 'anxious', 'rushed', 'revenge trading']
const MISTAKE_BASE   = ['averaged down', 'late entry', 'rigid tp exit', 'no plan', 'too short-dated', 'sized too big', 'early exit', 'chased entry', 'held too long']

// ── Styles ───────────────────────────────────────────────────────────────────
const CARD = {
  background: '#1a1a1a',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,201,167,0.06)',
  padding: 28,
}

const INPUT_BASE = {
  width: '100%',
  background: '#0f0f0f',
  border: '1px solid #1f1f1f',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

const PLUS_BTN = {
  width: 18, height: 18, borderRadius: 4,
  background: '#222', border: '1px solid #2a2a2a',
  color: '#555', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, flexShrink: 0, transition: 'all 0.15s',
}

// ── Hooks ────────────────────────────────────────────────────────────────────
function useCustomTags(key) {
  const [tags, setTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`otc_tags_${key}`) || '[]') }
    catch { return [] }
  })
  const add = (tag) => {
    setTags(prev => {
      const next = [...prev, tag]
      localStorage.setItem(`otc_tags_${key}`, JSON.stringify(next))
      return next
    })
  }
  return [tags, add]
}

// ── Primitive inputs ─────────────────────────────────────────────────────────
function FocusInput({ disabled, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      disabled={disabled}
      style={{
        ...INPUT_BASE,
        borderColor: focused ? '#00c9a7' : '#1f1f1f',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : undefined,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}

function FocusSelect({ children, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      {...props}
      style={{ ...INPUT_BASE, borderColor: focused ? '#00c9a7' : '#1f1f1f', appearance: 'none', cursor: 'pointer' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  )
}

function FocusTextarea(props) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      style={{
        ...INPUT_BASE,
        resize: 'vertical',
        minHeight: 80,
        borderColor: focused ? '#00c9a7' : '#1f1f1f',
        lineHeight: 1.65,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <div className="section-label" style={{ marginBottom: 10 }}>
      {children}{required && <span style={{ color: '#e94560', marginLeft: 2 }}>*</span>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#1f1f1f', margin: '24px 0' }} />
}

function SectionHead({ children }) {
  return <div className="section-label" style={{ marginBottom: 16 }}>{children}</div>
}

// ── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12,
        border: `1px solid ${active ? '#00c9a7' : 'transparent'}`,
        background: active ? 'rgba(0,201,167,0.15)' : hov ? '#333' : '#2a2a2a',
        color: active ? '#00c9a7' : hov ? '#e2e8f0' : '#888',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Inline add-tag row ───────────────────────────────────────────────────────
function AddTagRow({ onAdd, onCancel }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  const commit = () => { if (val.trim()) onAdd(val.trim()); onCancel() }
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') onCancel() }}
        placeholder="New tag…"
        style={{ flex: 1, ...INPUT_BASE, width: 'auto', padding: '6px 10px', fontSize: 12, borderColor: '#00c9a7' }}
      />
      <button type="button" onClick={commit}
        style={{ padding: '6px 12px', background: '#00c9a7', color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Add
      </button>
      <button type="button" onClick={onCancel}
        style={{ padding: '6px 10px', background: '#2a2a2a', color: '#666', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  )
}

// ── Tag section with + button ─────────────────────────────────────────────────
function TagSection({ label, baseOptions, selected, onChange, storageKey }) {
  const [customs, addCustom] = useCustomTags(storageKey)
  const [adding, setAdding] = useState(false)
  const all = [...baseOptions, ...customs]
  const toggle = opt => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="section-label">{label}</span>
        <button type="button" onClick={() => setAdding(a => !a)} title="Add custom tag" style={PLUS_BTN}>
          <Plus size={10} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {all.map(opt => (
          <Pill key={opt} active={selected.includes(opt)} onClick={() => toggle(opt)}>{opt}</Pill>
        ))}
      </div>
      {adding && (
        <AddTagRow
          onAdd={tag => { if (!all.includes(tag)) { addCustom(tag); onChange([...selected, tag]) } }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  )
}

// ── Market context multi-select dropdown ──────────────────────────────────────
function MarketContextSelect({ selected, onChange }) {
  const [customs, addCustom] = useCustomTags('market_context')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const containerRef = useRef(null)
  const all = [...MARKET_CTX_BASE, ...customs]

  useEffect(() => {
    const handler = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = opt => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  const display = selected.length === 0 ? 'Select conditions…' : selected.length === 1 ? selected[0] : `${selected.length} selected`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="section-label">Market Context</span>
        <button type="button" onClick={() => { setAdding(a => !a); setOpen(false) }} title="Add custom context" style={PLUS_BTN}>
          <Plus size={10} />
        </button>
      </div>

      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            ...INPUT_BASE,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
            color: selected.length > 0 ? '#e2e8f0' : '#444',
            borderColor: open ? '#00c9a7' : '#1f1f1f',
          }}
        >
          <span style={{ fontSize: 13 }}>{display}</span>
          <ChevronDown size={13} style={{ color: '#444', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#1a1a1a', border: '1px solid #1f1f1f', borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 100, maxHeight: 220, overflowY: 'auto',
          }}>
            {all.map((opt, i) => (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < all.length - 1 ? '1px solid #1f1f1f' : 'none',
                  background: selected.includes(opt) ? 'rgba(0,201,167,0.05)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${selected.includes(opt) ? '#00c9a7' : '#333'}`,
                  background: selected.includes(opt) ? '#00c9a7' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected.includes(opt) && <Check size={10} style={{ color: '#000' }} />}
                </div>
                <span style={{ fontSize: 13, color: selected.includes(opt) ? '#e2e8f0' : '#888' }}>{opt}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {selected.map(s => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px 3px 10px',
              background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.25)',
              borderRadius: 12, fontSize: 11, color: '#00c9a7',
            }}>
              {s}
              <button type="button" onClick={() => toggle(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00c9a7', padding: 0, lineHeight: 1, fontSize: 15 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {adding && (
        <AddTagRow
          onAdd={tag => { if (!all.includes(tag)) { addCustom(tag); onChange([...selected, tag]) } }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  )
}

// ── Calculations ──────────────────────────────────────────────────────────────
function calcDerived(form) {
  const entry = parseFloat(form.avg_entry_price)
  const exit  = parseFloat(form.avg_exit_price)
  const qty   = parseInt(form.contracts)
  if (!entry || !qty) return {}
  const grossPnl = form.trade_status === 'CLOSED' && !isNaN(exit) && exit
    ? (exit - entry) * qty * 100 : null
  const roi = grossPnl != null ? (grossPnl / (entry * qty * 100)) * 100 : null
  let holdMin = null
  if (form.open_date && form.open_time && form.close_date && form.close_time) {
    const diff = Math.round((new Date(`${form.close_date}T${form.close_time}`) - new Date(`${form.open_date}T${form.open_time}`)) / 60000)
    if (diff >= 0) holdMin = diff
  }
  return { grossPnl, netPnl: grossPnl, roi, holdMin }
}

function getStatus(pnl) {
  if (pnl == null) return null
  return pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  symbol: '', option_type: 'Call', strike: '', expiration_date: '',
  open_date: today, open_time: '', close_date: today, close_time: '',
  contracts: '', avg_entry_price: '', avg_exit_price: '',
  trade_status: 'CLOSED',
  setup_notes: '', outcomes_learnings: '',
  rating: 0, reviewed: false,
  market_context: [],
  trade_type: [], setups: [], emotions_habits: [], mistakes: [],
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradeEntryPage({ session }) {
  const navigate    = useNavigate()
  const { id }      = useParams()
  const isEdit      = Boolean(id)

  const [saving, setSaving]         = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error, setError]           = useState(null)
  const [editLoading, setEditLoading] = useState(isEdit)

  const [form, setForm] = useState(EMPTY_FORM)

  // Load existing trade for edit mode
  useEffect(() => {
    if (!isEdit) return
    supabase.from('trades').select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Trade not found.')
          setEditLoading(false)
          return
        }
        setForm({
          symbol:             data.symbol || '',
          option_type:        data.option_type || 'Call',
          strike:             data.strike?.toString() || '',
          expiration_date:    data.expiration_date || '',
          open_date:          data.open_date || today,
          open_time:          data.open_time || '',
          close_date:         data.close_date || today,
          close_time:         data.close_time || '',
          contracts:          data.contracts?.toString() || '',
          avg_entry_price:    data.avg_entry_price?.toString() || '',
          avg_exit_price:     data.avg_exit_price?.toString() || '',
          trade_status:       data.trade_status || 'CLOSED',
          setup_notes:        data.setup_notes || '',
          outcomes_learnings: data.outcomes_learnings || '',
          rating:             data.rating || 0,
          reviewed:           data.reviewed || false,
          market_context:     data.market_context ? data.market_context.split(',').map(s => s.trim()).filter(Boolean) : [],
          trade_type:         data.trade_type || [],
          setups:             data.setups || [],
          emotions_habits:    data.emotions_habits || [],
          mistakes:           data.mistakes || [],
        })
        setEditLoading(false)
      })
  }, [id, isEdit, session.user.id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isClosed = form.trade_status === 'CLOSED'

  const calc = useMemo(() => calcDerived(form), [
    form.avg_entry_price, form.avg_exit_price, form.contracts,
    form.trade_status, form.open_date, form.open_time, form.close_date, form.close_time,
  ])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      symbol:             form.symbol.toUpperCase().trim(),
      option_type:        form.option_type || null,
      strike:             form.strike ? parseFloat(form.strike) : null,
      expiration_date:    form.expiration_date || null,
      open_date:          form.open_date || null,
      open_time:          form.open_time || null,
      close_date:         isClosed ? form.close_date || null : null,
      close_time:         isClosed ? form.close_time || null : null,
      contracts:          form.contracts ? parseInt(form.contracts) : null,
      avg_entry_price:    form.avg_entry_price ? parseFloat(form.avg_entry_price) : null,
      avg_exit_price:     isClosed && form.avg_exit_price ? parseFloat(form.avg_exit_price) : null,
      gross_pnl:          calc.grossPnl != null ? +calc.grossPnl.toFixed(2) : null,
      commissions:        0,
      net_pnl:            calc.netPnl != null ? +calc.netPnl.toFixed(2) : null,
      net_roi_pct:        calc.roi != null ? +calc.roi.toFixed(2) : null,
      hold_time_minutes:  calc.holdMin ?? null,
      status:             getStatus(calc.netPnl),
      trade_status:       form.trade_status,
      market_context:     form.market_context.length ? form.market_context.join(', ') : null,
      trade_type:         form.trade_type.length ? form.trade_type : null,
      setups:             form.setups.length ? form.setups : null,
      emotions_habits:    form.emotions_habits.length ? form.emotions_habits : null,
      mistakes:           form.mistakes.length ? form.mistakes : null,
      setup_notes:        form.setup_notes || null,
      outcomes_learnings: form.outcomes_learnings || null,
      rating:             form.rating > 0 ? form.rating : null,
      reviewed:           form.reviewed,
    }

    let err
    if (isEdit) {
      const { error: e } = await supabase.from('trades').update(payload).eq('id', id).eq('user_id', session.user.id)
      err = e
    } else {
      const { error: e } = await supabase.from('trades').insert([{ ...payload, user_id: session.user.id, imported_from: 'manual' }])
      err = e
    }

    if (err) { setError(err.message); setSaving(false) }
    else {
      setSuccess(true)
      setTimeout(() => navigate(isEdit ? `/trades/${id}` : '/'), 1500)
    }
  }

  const pnlColor = calc.netPnl == null ? '#444' : calc.netPnl >= 0 ? '#00c9a7' : '#e94560'

  if (editLoading) {
    return <div style={{ padding: '36px 40px', color: '#333', fontSize: 14 }}>Loading…</div>
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{isEdit ? 'Edit Trade' : 'Log Trade'}</h1>
        <p style={{ color: '#444', fontSize: 14, marginTop: 8 }}>{isEdit ? 'Update trade details and tags' : 'Manually record a completed or open position'}</p>
      </div>

      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24,
          background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)',
          borderRadius: 10, padding: '14px 18px', color: '#00c9a7', fontSize: 14,
        }}>
          <Check size={15} />
          {isEdit ? 'Trade updated successfully. Redirecting…' : 'Trade logged successfully. Redirecting…'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24, alignItems: 'stretch' }}>

          {/* ══ LEFT COLUMN ══════════════════════════════════════════════════ */}
          <div style={CARD}>

            <SectionHead>Trade Details</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
              <div>
                <FieldLabel required>Symbol</FieldLabel>
                <FocusInput value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="QQQ" required />
              </div>
              <div>
                <FieldLabel>Option Type</FieldLabel>
                <FocusSelect value={form.option_type} onChange={e => set('option_type', e.target.value)}>
                  <option value="Call">Call</option>
                  <option value="Put">Put</option>
                  <option value="Stock">Stock</option>
                </FocusSelect>
              </div>
              <div>
                <FieldLabel>Strike</FieldLabel>
                <FocusInput type="number" step="0.5" value={form.strike} onChange={e => set('strike', e.target.value)} placeholder="610" />
              </div>
              <div>
                <FieldLabel>Expiration</FieldLabel>
                <FocusInput type="date" value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} />
              </div>
            </div>

            <Divider />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <SectionHead>Execution</SectionHead>
              <div style={{ display: 'flex', gap: 6, marginTop: -16 }}>
                {['CLOSED', 'OPEN'].map(s => (
                  <button key={s} type="button" onClick={() => set('trade_status', s)}
                    style={{
                      padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: form.trade_status === s ? '#00c9a7' : '#0f0f0f',
                      color:      form.trade_status === s ? '#000'     : '#555',
                      border: `1px solid ${form.trade_status === s ? '#00c9a7' : '#1f1f1f'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabel required>Open Date</FieldLabel>
                  <FocusInput type="date" value={form.open_date} onChange={e => set('open_date', e.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Open Time</FieldLabel>
                  <FocusInput type="time" value={form.open_time} onChange={e => set('open_time', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabel required={isClosed}>Close Date</FieldLabel>
                  <FocusInput type="date" value={form.close_date} onChange={e => set('close_date', e.target.value)} disabled={!isClosed} required={isClosed} />
                </div>
                <div>
                  <FieldLabel>Close Time</FieldLabel>
                  <FocusInput type="time" value={form.close_time} onChange={e => set('close_time', e.target.value)} disabled={!isClosed} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              <div>
                <FieldLabel required>Contracts</FieldLabel>
                <FocusInput type="number" min="1" value={form.contracts} onChange={e => set('contracts', e.target.value)} placeholder="1" required />
              </div>
              <div>
                <FieldLabel required>Avg Entry</FieldLabel>
                <FocusInput type="number" step="0.01" min="0" value={form.avg_entry_price} onChange={e => set('avg_entry_price', e.target.value)} placeholder="7.69" required />
              </div>
              <div>
                <FieldLabel required={isClosed}>Avg Exit</FieldLabel>
                <FocusInput type="number" step="0.01" min="0" value={form.avg_exit_price} onChange={e => set('avg_exit_price', e.target.value)} placeholder="9.20" disabled={!isClosed} required={isClosed} />
              </div>
            </div>

            <Divider />

            <SectionHead>Calculated P&L</SectionHead>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12,
              background: '#0f0f0f', border: '1px solid #1f1f1f', borderRadius: 10, padding: '18px 20px',
            }}>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>Net P&L</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: pnlColor }}>
                  {calc.netPnl == null ? '—' : `${calc.netPnl >= 0 ? '+' : ''}$${calc.netPnl.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>ROI</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: calc.roi == null ? '#444' : calc.roi >= 0 ? '#00c9a7' : '#e94560' }}>
                  {calc.roi == null ? '—' : `${calc.roi >= 0 ? '+' : ''}${calc.roi.toFixed(1)}%`}
                </div>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>Result</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>{getStatus(calc.netPnl) || '—'}</div>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>Hold Time</div>
                <div style={{ fontSize: 14, color: '#555' }}>
                  {calc.holdMin == null ? '—' : calc.holdMin < 60 ? `${calc.holdMin}m` : `${Math.floor(calc.holdMin / 60)}h ${calc.holdMin % 60}m`}
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════ */}
          <div style={CARD}>

            <TagSection
              label="Setups"
              baseOptions={SETUP_BASE}
              selected={form.setups}
              onChange={v => set('setups', v)}
              storageKey="setups"
            />

            <Divider />

            <MarketContextSelect
              selected={form.market_context}
              onChange={v => set('market_context', v)}
            />

            <Divider />

            <TagSection
              label="Trade Type"
              baseOptions={TRADE_TYPE_BASE}
              selected={form.trade_type}
              onChange={v => set('trade_type', v)}
              storageKey="trade_type"
            />

            <Divider />

            <TagSection
              label="Emotions & Habits"
              baseOptions={EMOTION_BASE}
              selected={form.emotions_habits}
              onChange={v => set('emotions_habits', v)}
              storageKey="emotions_habits"
            />

            <Divider />

            <TagSection
              label="Mistakes"
              baseOptions={MISTAKE_BASE}
              selected={form.mistakes}
              onChange={v => set('mistakes', v)}
              storageKey="mistakes"
            />

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Setup Notes</div>
              <FocusTextarea
                rows={3}
                value={form.setup_notes}
                onChange={e => set('setup_notes', e.target.value)}
                placeholder="What was your thesis before entering?"
              />
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>Outcomes & Learnings</div>
              <FocusTextarea
                rows={3}
                value={form.outcomes_learnings}
                onChange={e => set('outcomes_learnings', e.target.value)}
                placeholder="What happened? What did you learn?"
              />
            </div>

            <Divider />

            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Rating</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('rating', form.rating === n ? 0 : n)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transition: 'transform 0.1s' }}
                  >
                    <Star
                      size={24}
                      fill={form.rating >= n ? '#00c9a7' : 'none'}
                      stroke={form.rating >= n ? '#00c9a7' : '#444'}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            <div
              onClick={() => set('reviewed', !form.reviewed)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                border: `1px solid ${form.reviewed ? '#00c9a7' : '#333'}`,
                background: form.reviewed ? '#00c9a7' : '#0f0f0f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {form.reviewed && <Check size={12} style={{ color: '#000' }} />}
              </div>
              <span style={{ fontSize: 13, color: form.reviewed ? '#e2e8f0' : '#666' }}>
                Mark as reviewed
              </span>
            </div>

            <Divider />

            {error && (
              <div style={{
                background: 'rgba(233,69,96,0.08)', border: '1px solid rgba(233,69,96,0.2)',
                borderRadius: 10, padding: '12px 16px', color: '#e94560', fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={saving || success}
                style={{
                  flex: 1, background: '#00c9a7', color: '#000', fontWeight: 700,
                  borderRadius: 10, padding: '13px 0', fontSize: 14,
                  border: 'none', cursor: saving || success ? 'not-allowed' : 'pointer',
                  opacity: saving || success ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Trade'}
              </button>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/trades/${id}` : '/')}
                style={{
                  padding: '13px 20px', background: '#0f0f0f', color: '#555', fontWeight: 500,
                  borderRadius: 10, fontSize: 14, border: '1px solid #1f1f1f',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}

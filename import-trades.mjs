/**
 * One-time CSV import script: TradeZella → Supabase
 * Usage: SUPABASE_SERVICE_KEY=your_service_role_key node import-trades.mjs
 *
 * Get the service role key from:
 * Supabase dashboard → Settings → API → service_role (secret key)
 */

import fs from 'fs'
import readline from 'readline'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tkakaqtvqizulyhqnbcc.supabase.co'
const CSV_PATH = '/Users/palakeel/Desktop/off-the-chart/Trades Mar 6 2026.csv'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse "2025-05-23 140 CALL" → { strike, expiration_date, option_type } */
function parseInstrument(raw) {
  if (!raw) return {}
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+([\d.]+)\s+(CALL|PUT)$/i)
  if (m) {
    return {
      expiration_date: m[1],
      strike: parseFloat(m[2]),
      option_type: m[3].charAt(0).toUpperCase() + m[3].slice(1).toLowerCase(), // "Call" / "Put"
    }
  }
  // Stock (no strike/expiry) — instrument is just the ticker
  return { option_type: 'Stock' }
}

/** Strip timezone suffix from time strings like "09:32:03 EDT" → "09:32:03" */
function parseTime(raw) {
  if (!raw) return null
  return raw.trim().split(' ')[0] || null
}

/** Split a comma-separated tag string into a trimmed array, filtering empties */
function parseTags(raw) {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/** Map TradeZella status → our DB status */
function parseStatus(raw) {
  const s = (raw || '').trim()
  if (s === 'Win') return 'WIN'
  if (s === 'Loss') return 'LOSS'
  if (s === 'BE') return 'BREAKEVEN'
  return null
}

/** Parse a float, returning null for empty/invalid */
function pf(val) {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

/** Parse an int, returning null for empty/invalid */
function pi(val) {
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

// ─── CSV parsing ────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = []
    const rl = readline.createInterface({ input: fs.createReadStream(filePath) })
    let headers = null

    rl.on('line', (raw) => {
      // Minimal RFC 4180-compliant parser handling quoted fields with embedded commas
      const fields = []
      let field = ''
      let inQuote = false
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i]
        if (inQuote) {
          if (ch === '"' && raw[i + 1] === '"') { field += '"'; i++ }
          else if (ch === '"') inQuote = false
          else field += ch
        } else {
          if (ch === '"') inQuote = true
          else if (ch === ',') { fields.push(field); field = '' }
          else field += ch
        }
      }
      fields.push(field)

      if (!headers) {
        headers = fields
      } else {
        const row = {}
        headers.forEach((h, i) => { row[h] = fields[i] ?? '' })
        rows.push(row)
      }
    })

    rl.on('close', () => resolve(rows))
    rl.on('error', reject)
  })
}

// ─── Transform one CSV row → trades table row ───────────────────────────────

function transformRow(row, userId) {
  const instrument = parseInstrument(row['Instrument'])

  const durationSec = pf(row['Duration'])
  const hold_time_minutes = durationSec != null ? Math.round(durationSec / 60) : null

  const netRoiRaw = pf(row['Net ROI'])
  // CSV stores as decimal fraction (e.g., 1.56 = 156%), multiply by 100 for storage
  const net_roi_pct = netRoiRaw != null ? Math.round(netRoiRaw * 10000) / 100 : null

  const marketContext = (row['Market Context'] || '').trim()
  const tradeTypeTags = parseTags(row['Trade Type'])
  const setupsTags = parseTags(row['Setups'])
  const emotionsTags = parseTags(row['Emotions & Habits'])
  const mistakesTags = parseTags(row['Mistakes'])

  const ratingRaw = pf(row['Rating'])
  const rating = ratingRaw != null ? Math.round(ratingRaw) : null

  const reviewedRaw = (row['Reviewed'] || '').trim().toLowerCase()
  const reviewed = reviewedRaw === 'true' ? true : reviewedRaw === 'false' ? false : null

  const status = parseStatus(row['Status'])
  // All historical exports are closed trades
  const trade_status = 'CLOSED'

  return {
    user_id: userId,
    symbol: (row['Symbol'] || '').trim() || null,
    option_type: instrument.option_type ?? null,
    strike: instrument.strike ?? null,
    expiration_date: instrument.expiration_date ?? null,
    open_date: row['Open Date'] || null,
    open_time: parseTime(row['Open Time']),
    close_date: row['Close Date'] || null,
    close_time: parseTime(row['Close Time']),
    contracts: pi(row['Quantity']),
    avg_entry_price: pf(row['Avg Buy Price']),
    avg_exit_price: pf(row['Avg Sell Price']),
    gross_pnl: pf(row['Gross P&L']),
    commissions: pf(row['Commission']),
    net_pnl: pf(row['Net P&L']),
    net_roi_pct,
    hold_time_minutes,
    status,
    trade_status,
    market_context: marketContext || null,
    trade_type: tradeTypeTags.length ? tradeTypeTags : null,
    setups: setupsTags.length ? setupsTags : null,
    emotions_habits: emotionsTags.length ? emotionsTags : null,
    mistakes: mistakesTags.length ? mistakesTags : null,
    outcomes_learnings: row['Outcomes & Learnings'] || null,
    rating,
    reviewed,
    imported_from: 'csv',
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    console.error('ERROR: Set SUPABASE_SERVICE_KEY environment variable.')
    console.error('Find it at: Supabase dashboard → Settings → API → service_role key')
    process.exit(1)
  }

  // Service role client bypasses RLS — use only for this one-time import
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Find the user account
  console.log('Looking up user...')
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Error listing users:', usersError.message)
    process.exit(1)
  }
  if (!usersData.users.length) {
    console.error('No users found in Supabase.')
    process.exit(1)
  }
  // Use the first (and only) user
  const user = usersData.users[0]
  const userId = user.id
  console.log(`Found user: ${user.email ?? user.id} (${userId})`)

  // Parse CSV
  console.log(`Parsing ${CSV_PATH}...`)
  const rows = await parseCSV(CSV_PATH)
  console.log(`Found ${rows.length} rows.`)

  // Transform
  const records = rows.map(r => transformRow(r, userId))

  // Fetch existing trades for dedup (symbol + open_date + open_time + contracts)
  console.log('Fetching existing trades for dedup check...')
  const { data: existing, error: fetchError } = await supabase
    .from('trades')
    .select('symbol, open_date, open_time, contracts')
    .eq('user_id', userId)
  if (fetchError) {
    console.error('Error fetching existing trades:', fetchError.message)
    process.exit(1)
  }
  const existingKeys = new Set(
    existing.map(t => `${t.symbol}|${t.open_date}|${t.open_time}|${t.contracts}`)
  )
  console.log(`Found ${existing.length} existing trades.`)

  const toInsert = []
  const skipped = []
  for (const r of records) {
    const key = `${r.symbol}|${r.open_date}|${r.open_time}|${r.contracts}`
    if (existingKeys.has(key)) {
      skipped.push(key)
    } else {
      toInsert.push(r)
    }
  }
  console.log(`New: ${toInsert.length}, Duplicates to skip: ${skipped.length}`)

  // Insert in batches of 50
  const BATCH = 50
  let inserted = 0
  let errors = []

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error } = await supabase.from('trades').insert(batch).select('id')
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
      errors.push({ batchStart: i, message: error.message })
    } else {
      inserted += data.length
      process.stdout.write(`\rInserted ${inserted}/${toInsert.length}...`)
    }
  }

  console.log(`\n\n✓ Done. ${inserted} inserted, ${skipped.length} skipped (duplicates), ${errors.length} errors.`)
  if (errors.length) {
    console.log('Errors:')
    errors.forEach(e => console.log(`  Row ~${e.batchStart}: ${e.message}`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })

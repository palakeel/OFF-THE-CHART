/**
 * create-legs.mjs — Populate trade_legs from existing trades table.
 *
 * Since TradeZella's CSV only exports execution counts (not individual fills),
 * this creates one synthetic BTO + one STC leg per trade using the blended
 * averages already stored on each trade. Real per-fill legs will be added
 * later via the screenshot parser.
 *
 * Usage: SUPABASE_SERVICE_KEY=your_key node create-legs.mjs
 *   OR:  node create-legs.mjs   (key is hardcoded below)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tkakaqtvqizulyhqnbcc.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYWthcXR2cWl6dWx5aHFuYmNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY3MzA2MSwiZXhwIjoyMDg4MjQ5MDYxfQ.tgJI--GdZBXw0qNiYRBEKpvoGC6AitwFWR2272BBTCo'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function round2(n) { return Math.round(n * 100) / 100 }

async function main() {
  // ── Fetch all trades ────────────────────────────────────────────────────────
  console.log('Fetching trades…')
  const { data: trades, error: fetchErr } = await supabase
    .from('trades')
    .select('id, user_id, open_date, open_time, close_date, close_time, contracts, avg_entry_price, avg_exit_price, trade_status')

  if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1) }
  console.log(`Found ${trades.length} trades`)

  // ── Clear all existing legs for this user ──────────────────────────────────
  console.log('Clearing existing legs…')
  const { error: delErr, count: delCount } = await supabase
    .from('trade_legs')
    .delete({ count: 'exact' })
    .eq('user_id', trades[0]?.user_id ?? '')
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1) }
  console.log(`  Deleted ${delCount ?? '?'} existing legs`)

  // No existing legs after clear
  const hasLeg = new Set()

  // ── Build legs array ────────────────────────────────────────────────────────
  const legs = []

  for (const t of trades) {
    const qty   = t.contracts     ? parseInt(t.contracts)         : null
    const entry = t.avg_entry_price ? parseFloat(t.avg_entry_price) : null
    const exit  = t.avg_exit_price  ? parseFloat(t.avg_exit_price)  : null

    // BTO leg
    if (qty && entry && !hasLeg.has(`${t.id}|BTO`)) {
      legs.push({
        trade_id:         t.id,
        user_id:          t.user_id,
        action:           'BTO',
        transaction_date: t.open_date  || null,
        transaction_time: t.open_time  ? t.open_time.slice(0, 8) : null,
        qty,
        price:            entry,
        debit:            round2(entry * qty * 100),
        credit:           null,
        raw_description:  'blended avg (TradeZella import)',
      })
    }

    // STC leg — only for closed trades with an exit price
    if (qty && exit && t.trade_status === 'CLOSED' && !hasLeg.has(`${t.id}|STC`)) {
      legs.push({
        trade_id:         t.id,
        user_id:          t.user_id,
        action:           'STC',
        transaction_date: t.close_date || null,
        transaction_time: t.close_time ? t.close_time.slice(0, 8) : null,
        qty,
        price:            exit,
        debit:            null,
        credit:           round2(exit * qty * 100),
        raw_description:  'blended avg (TradeZella import)',
      })
    }
  }

  if (legs.length === 0) {
    console.log('No new legs to insert — already up to date.')
    return
  }

  console.log(`Inserting ${legs.length} legs…`)

  // ── Batch insert ────────────────────────────────────────────────────────────
  const BATCH = 50
  let inserted = 0
  const errors = []

  for (let i = 0; i < legs.length; i += BATCH) {
    const batch = legs.slice(i, i + BATCH)
    const { data, error } = await supabase.from('trade_legs').insert(batch).select('id')
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
      errors.push(error.message)
    } else {
      inserted += data.length
      process.stdout.write(`\r  ${inserted}/${legs.length}`)
    }
  }

  console.log(`\n\n✓ Done. ${inserted} legs inserted, ${errors.length} errors.`)
  if (errors.length) errors.forEach(e => console.log(' ', e))
}

main().catch(err => { console.error(err); process.exit(1) })

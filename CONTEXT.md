# Off The Chart — Project Context & Build Reference

## What This Is
Off The Chart (OTC) is a personal trading analytics platform and journal built to replace TradeZella ($29/mo). It is purpose-built for a single user (Joseph Palakeel) trading options on Robinhood. The long-term goal is to potentially monetize this as a SaaS product for other traders.

---

## Trader Profile
- **Name:** Joseph Palakeel
- **Broker:** Robinhood (cash account)
- **Account type:** Cash account — no margin, no spreads, no rolling
- **Instruments:** Options only (primary). Single-leg directional trades only.
- **Typical underlyings:** QQQ, SPY, IWM (primary), plus individual stocks (NVDA, AMD, AAPL, etc.)
- **Trade types:** Day trades and swing trades. Always long (buying calls or puts). Never selling options.
- **Strategy style:** Directional momentum, breakouts, high conviction setups
- **Common tags used:** day trade, swing trade, etf, stock, high conviction, callout, idea trade
- **Emotion/habit tags:** calm & disciplined, confident, blind faith, boredom, FOMO
- **Setup tags:** breakout, pullback, market context tags (bullish trend, bearish trend)
- **Mistake tags:** averaged down, late entry, rigid tp exit, no plan, too short-dated

## Known Edge Cases
- **Averaging in:** Joseph sometimes buys multiple BTO legs on the same position at different times/prices — these must be matched into one trade with a blended average entry price
- **Scaling out:** Positions are often closed in multiple STC legs at different prices — these must be matched to the parent BTO and blended into one average exit price
- **Accidental trades:** Occasionally buys the wrong contract type (e.g., puts when meaning to buy calls) and closes immediately — these should still be logged as separate trades with a loss
- **Swing trades:** Some positions are held for days or weeks across multiple sessions — these remain "Open" status until all contracts are closed
- **Multi-leg future support:** Multi-leg options strategies (spreads, straddles, etc.) and selling options are planned for a future phase but NOT part of the current build

---

## Live URLs & Project References
- **Live app:** https://palakeel.github.io/OFF-THE-CHART/
- **GitHub repo:** https://github.com/palakeel/OFF-THE-CHART
- **Supabase project URL:** https://tkakaqtvqizulyhqnbcc.supabase.co
- **Local dev:** `cd ~/Desktop/off-the-chart` then `npm run dev`
- **Deploy to live:** `npm run deploy` (builds and pushes to GitHub Pages)

---

## Tech Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + Vite 7 | |
| Styling | Tailwind CSS | v4 via @tailwindcss/vite |
| Charts | Recharts | For all data visualization |
| Icons | Lucide React | |
| Routing | React Router DOM | HashRouter — required for gh-pages |
| Database | Supabase (PostgreSQL) | Free tier |
| Auth | Supabase Auth | Email/password |
| Hosting | GitHub Pages | Via gh-pages package |
| AI (Phase 3) | Anthropic Claude API | claude-haiku for cost efficiency |

---

## Design System
- **App name:** Off The Chart
- **Logo:** OTC geometric logo (white on black, square with O, T, C letterforms)
- **Theme:** Dark mode only
- **Background:** `#0f0f13` / `#0f0f0f`
- **Card/surface:** `#1a1a1a`
- **Border:** `#1f1f1f`
- **Accent/primary:** `#00c9a7` (teal)
- **Text primary:** `#e2e8f0`
- **Text secondary:** `#888888`
- **Text muted:** `#555` / `#444`
- **Win color:** `#00c9a7` (teal/green)
- **Loss color:** `#e94560` (red)
- **Font:** Inter, system-ui fallback

---

## Project File Structure
```
off-the-chart/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Auth.jsx               # Login screen ✅ BUILT
│   │   └── Layout.jsx             # Sidebar nav + Outlet ✅ BUILT
│   ├── lib/
│   │   └── supabase.js            # Supabase client ✅ BUILT
│   ├── pages/
│   │   ├── DashboardPage.jsx      # Stats, charts, recent trades ✅ BUILT
│   │   ├── TradeEntryPage.jsx     # Manual trade entry + edit mode ✅ BUILT
│   │   ├── DayViewPage.jsx        # Trades grouped by day ✅ BUILT
│   │   ├── TradeViewPage.jsx      # Sortable/filterable trade table ✅ BUILT
│   │   └── TradeDetailPage.jsx    # Individual trade detail view ✅ BUILT
│   ├── App.jsx                    # HashRouter + auth guard + routes ✅ BUILT
│   ├── index.css                  # Global styles + Tailwind ✅ BUILT
│   └── main.jsx                   # React entry point ✅ BUILT
├── supabase-schema.sql            # ✅ RUN — tables + RLS in Supabase
├── supabase-migration-polygon.sql # ✅ Written — Polygon columns (run when needed)
├── import-trades.mjs              # ✅ RUN — 361 trades imported from CSV
├── create-legs.mjs                # ✅ RUN — 715 synthetic trade_legs populated
├── fetch-chart-data.py            # ✅ Written — Polygon chart data fetcher (tabled)
├── "Trades Mar 6 2026.csv"        # TradeZella export (source data)
├── index.html                     # ✅ BUILT
├── vite.config.js                 # ✅ BUILT (base: '/OFF-THE-CHART/')
├── package.json                   # ✅ BUILT (includes deploy scripts)
└── CONTEXT.md                     # This file
```

---

## Database Schema

### Table: `trades`
The central table. One row = one complete matched trade (all legs combined).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| user_id | UUID | Foreign key to auth.users — RLS enforced |
| symbol | TEXT | Underlying ticker (e.g., QQQ) |
| option_type | TEXT | 'Call', 'Put', or 'Stock' |
| strike | DECIMAL | Strike price |
| expiration_date | DATE | Option expiration date |
| open_date | DATE | Date trade was opened |
| open_time | TIME | Time trade was opened (from screenshot) |
| close_date | DATE | Date trade was closed |
| close_time | TIME | Time trade was closed (from screenshot) |
| contracts | INTEGER | Total number of contracts |
| avg_entry_price | DECIMAL | Blended average entry price per contract |
| avg_exit_price | DECIMAL | Blended average exit price per contract |
| gross_pnl | DECIMAL | P&L before fees |
| commissions | DECIMAL | Total commissions (usually $0 on Robinhood) |
| net_pnl | DECIMAL | Final P&L after fees |
| net_roi_pct | DECIMAL | Net ROI as percentage |
| hold_time_minutes | INTEGER | Duration held in minutes |
| status | TEXT | 'WIN', 'LOSS', or 'BREAKEVEN' |
| trade_status | TEXT | 'OPEN' or 'CLOSED' |
| strategy_tag | TEXT | User-defined strategy label |
| trade_type | TEXT[] | Array of tags: day trade, swing trade, etf, stock, high conviction, callout, idea trade |
| market_context | TEXT | Market condition tag (bullish trend, bearish trend, etc.) |
| setups | TEXT[] | Setup tags (breakout, pullback, etc.) |
| emotions_habits | TEXT[] | Emotion tags (calm & disciplined, FOMO, etc.) |
| mistakes | TEXT[] | Mistake tags (averaged down, late entry, etc.) |
| outcomes_learnings | TEXT | Post-trade notes and lessons |
| setup_notes | TEXT | Pre-trade thesis |
| rating | INTEGER | 1-5 star trade rating |
| reviewed | BOOLEAN | Whether trade has been reviewed |
| imported_from | TEXT | 'screenshot', 'manual', 'pdf', or 'csv' |
| ai_journal_entry | TEXT | AI-generated journal entry (Phase 3) |
| chart_data | JSONB | Polygon minute bars: array of {t,o,h,l,c} (UTC ms) |
| open_ts_ms | BIGINT | Trade entry timestamp in UTC ms |
| close_ts_ms | BIGINT | Trade exit timestamp in UTC ms |
| underlying_mae_pct | DECIMAL | Max adverse excursion of underlying (%) |
| underlying_mfe_pct | DECIMAL | Max favorable excursion of underlying (%) |
| created_at | TIMESTAMPTZ | Record creation timestamp |

### Table: `trade_legs`
Raw individual executions. Currently populated with one synthetic BTO + one STC per trade (blended averages from TradeZella import). Real per-fill legs will be added by the Phase 3 screenshot parser.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| trade_id | UUID | FK to trades.id |
| user_id | UUID | RLS enforced |
| action | TEXT | 'BTO' or 'STC' |
| transaction_date | DATE | Execution date |
| transaction_time | TIME | Execution time (from screenshot) |
| qty | INTEGER | Contracts in this leg |
| price | DECIMAL | Price per contract |
| debit | DECIMAL | Cash out (BTO) |
| credit | DECIMAL | Cash in (STC) |
| raw_description | TEXT | Original text from Robinhood |

### Table: `daily_journal`
One row per trading day.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | RLS enforced |
| trade_date | DATE | The trading day |
| daily_net_pnl | DECIMAL | Sum of all trades that day |
| trade_count | INTEGER | Number of trades that day |
| personal_notes | TEXT | User's own notes |
| ai_journal_entry | TEXT | AI-generated daily recap (Phase 3) |
| mood_rating | INTEGER | 1-5 pre-trading mental state |
| market_conditions | TEXT | Brief market note |

### Table: `user_settings`
Per-user preferences and configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| starting_balance | DECIMAL | Account starting balance |
| preferred_strategies | TEXT[] | List of named strategies |
| risk_per_trade | DECIMAL | Max risk per trade in $ |
| daily_loss_limit | DECIMAL | Max daily loss before stopping |

### RLS Policies
Every table has Row Level Security enabled. Policy pattern:
```sql
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_trades" ON trades FOR ALL USING (auth.uid() = user_id);
```
Same pattern applied to trade_legs, daily_journal, and user_settings.

---

## Robinhood Data Parsing

### The Problem
Robinhood records each BTO and STC as separate rows. A single trade from Joseph's perspective may consist of multiple legs. The app must stitch these together.

### Matching Algorithm
Match legs into trades using: **same symbol + same strike + same expiry + same option type + chronologically nearest open BTO**

### Screenshot Parsing (Phase 3)
Robinhood order confirmation screenshots contain:
- Title: "Buy/Sell QQQ $610 Call 3/13"
- Submitted time: "3/4, 7:13 AM PST"
- Filled time: "3/4, 7:13 AM PST"
- Quantity: "5 contracts at $7.69"
- Position effect: "Open" (BTO) or "Close" (STC)

Claude Vision API extracts these fields and pre-fills the trade entry form for user review before saving.

### Non-Trade Rows to Skip (PDF import)
- ACH Withdrawal
- Transfer from Brokerage to Roth IRA
- Interest Payment
- FDIC Sweep

---

## Build Phases

### Phase 0 — Setup & Scaffold ✅ COMPLETE
- GitHub repo created and deployed to GitHub Pages
- Supabase project created with auth
- React + Vite + Tailwind app scaffolded
- Login screen with Off The Chart branding
- Supabase authentication working (sign in / sign out)
- Protected routing (can't access app without login)

### Phase 1 — Core Dashboard & Trade Entry ✅ COMPLETE

**`Layout.jsx`** — Collapsible sidebar nav
- Dashboard, Add Trade, Trades, Day View links
- Reports link (disabled/grayed — Phase 2)
- User email display + Sign Out
- Collapse/expand toggle

**`DashboardPage.jsx`** — Main dashboard
- Date range filter: Today / Week / Month / YTD / All
- Stat cards: Net P&L, Win Rate, Profit Factor, Expectancy
- Avg Win vs Avg Loss visual bar
- Cumulative P&L area chart (Recharts)
- Daily P&L bar chart (Recharts, color-coded green/red)
- Recent trades table (last 10, sorted by date+time, rows are clickable)

**`TradeEntryPage.jsx`** — Manual trade entry form (also handles edit mode)
- Symbol, option type (Call/Put/Stock), strike, expiration
- OPEN / CLOSED toggle (disables exit fields when open)
- Open date+time, close date+time
- Contracts, avg entry price, avg exit price
- Live-calculated P&L, ROI, result (WIN/LOSS/BE), hold time preview
- Tag pills with custom tag support (localStorage): Setups, Trade Type, Emotions & Habits, Mistakes
- Market Context multi-select dropdown (with custom tags)
- Setup Notes and Outcomes & Learnings text areas
- 1–5 star rating (toggle off by re-clicking)
- "Mark as reviewed" checkbox
- Saves to Supabase `trades` table
- **Edit mode:** loads existing trade at `/trades/:id/edit`, pre-fills all fields, uses `.update()` on save

**`DayViewPage.jsx`** — Trades grouped by trading day
- Expandable day rows: date, trade count, W/L counts, daily P&L
- Expanded view: sorted by open time, shows all trade details
- Columns: Time, Trade (symbol + strike + type + expiry), Qty, Entry, Exit, P&L, ROI, Status badge
- All rows are clickable → navigate to trade detail

**Data setup (complete):**
- `supabase-schema.sql` run — all tables + RLS active
- 361 trades imported from TradeZella CSV via `import-trades.mjs`
- 715 trade_legs populated (synthetic BTO + STC per trade) via `create-legs.mjs`

### Phase 2 — Trade View & Trade Detail ✅ COMPLETE (Reports still TODO)

**`TradeViewPage.jsx`** — Full sortable/filterable trade table
- Columns: Date, Trade (symbol+strike+type+expiry), Qty, Entry, Exit, P&L, ROI, Hold, Rating, Status
- Click any column header to sort (toggle asc/desc)
- Filters: symbol search, status (All/WIN/LOSS/BE/OPEN), type (All/Call/Put/Stock)
- Pagination: 50 per page with Prev/Next
- Click any row → navigate to `/trades/:id`

**`TradeDetailPage.jsx`** — Individual trade detail page
- **Header:** large trade title (symbol + strike + type + expiry pill), WIN/LOSS/OPEN badge, Edit button, back link
- **Stats row:** 6-cell grid — Net P&L, ROI, Contracts, Avg Entry, Avg Exit, Hold Time (always from blended trade data)
- **Chart section:** Recharts ComposedChart with Polygon minute bars (Area) + ReferenceLine for entry/exit times. Shows placeholder if no chart_data yet.
- **Two-column layout:**
  - Left: Trade Info card (symbol, type, strike, expiry, dates, times, hold time as InfoRows) + tags as teal outline pills (trade_type, setups, emotions_habits, mistakes, market_context)
  - Right: Journal card — auto-saves to Supabase on change (800ms debounce for text, instant for stars/reviewed). Fields: Setup Notes, Outcomes & Learnings, star rating, reviewed toggle.
- **Executions card:** queries `trade_legs` for this trade. BTO badge = red (cash out), STC badge = teal (cash in). Shows synthetic blended-avg legs now; will show real fills after Phase 3 screenshot parser.

**Clickable rows everywhere:**
- DashboardPage recent trades → `/trades/:id`
- DayViewPage expanded rows → `/trades/:id`
- TradeViewPage rows → `/trades/:id`

### Phase 2 — Reports page (NEXT)
- [ ] Full Reports page with tabs:
  - Performance Summary (all stats)
  - By Symbol breakdown
  - By Strategy breakdown
  - By Day of Week
  - By Trade Duration
  - Monthly P&L breakdown
  - Calendar View

### Phase 3 — AI Features
- [ ] Screenshot parser (Claude Vision API)
  - Upload Robinhood order screenshot → auto-parse → pre-fill trade form
  - Will replace synthetic trade_legs with real per-fill execution data
- [ ] Daily journal generator (Claude API)
- [ ] Trade coach chatbot
- [ ] Pattern alert system (warns when repeating losing setups)
- [ ] PDF statement batch import (lower priority)

### Phase 4 — Polish & Monetization
- [ ] Performance Score radar chart
- [ ] Mobile responsive design — Joseph occasionally checks stats on the go, so full mobile responsiveness is a priority for Phase 4 when the desktop experience is complete.
- [ ] Export reports to PDF
- [ ] Multi-user support (Supabase RLS already handles this)
- [ ] Stripe billing integration
- [ ] Broker OAuth integrations (Robinhood, Tastytrade, IBKR)
- [ ] Multi-leg options strategies support
- [ ] Selling options support

---

## Deferred / Out of Scope for MVP
- **Polygon.io chart data:** `fetch-chart-data.py` and `supabase-migration-polygon.sql` are written and ready. Python script downloads daily flat files from Polygon S3, extracts minute bars for each trade's underlying, computes MAE/MFE, stores in `chart_data`/`open_ts_ms`/`close_ts_ms`/`underlying_mae_pct`/`underlying_mfe_pct` columns. Tabled due to friend's credentials not having flat file subscription access. Resolve credentials then run `python fetch-chart-data.py`.
- **Robinhood API:** Unofficial/reverse-engineered, violates ToS. Not using.
- **PDF batch import:** Too bulky, monthly only. Screenshot parsing is the priority.
- **Multi-leg strategies:** Planned for Phase 4.
- **Selling options:** Planned for Phase 4.

---

## Key Decisions & Rationale
- **Supabase over Firebase:** Standard PostgreSQL, easier migration path, built-in RLS, generous free tier
- **GitHub Pages over Vercel:** Free, simple, works for static React apps
- **Claude API over OpenAI:** Joseph already uses Claude, cheaper at low volume, better at nuanced analysis
- **Screenshots over PDF:** PDFs are monthly, lack timestamps. Screenshots have exact fill times needed for hold time calculations.
- **Synthetic trade_legs:** TradeZella CSV only exports a count of fills, not individual fill data. One synthetic BTO+STC created per trade from blended averages as placeholder until screenshot parser is built.
- **Cash account only for now:** No spreads, no rolling, no margin — simplifies trade matching logic significantly
- **HashRouter:** Required because GitHub Pages doesn't support HTML5 history routing
- **Auto-save in Trade Detail:** Journal fields save automatically (debounced) rather than requiring a Save button — feels more natural for a journaling workflow

---

## Historical Data
361 trades imported from TradeZella CSV (May 2025 – March 2026). Import script: `import-trades.mjs`. Deduplication key: symbol + open_date + open_time + contracts.

CSV fields map to our schema as follows:
- `Symbol` → `symbol`
- `Instrument` → parse for `strike`, `expiration_date`, `option_type`
- `Open Date` + `Open Time` → `open_date` + `open_time`
- `Close Date` + `Close Time` → `close_date` + `close_time`
- `Avg Buy Price` → `avg_entry_price`
- `Avg Sell Price` → `avg_exit_price`
- `Net P&L` → `net_pnl`
- `Gross P&L` → `gross_pnl`
- `Net ROI` → `net_roi_pct` (CSV is decimal fraction — multiplied by 100 for storage)
- `Duration` (in seconds) → convert to `hold_time_minutes`
- `Status` (Win/Loss/BE) → `status`
- `Quantity` → `contracts`
- `Trade Type` → `trade_type` (array)
- `Market Context` → `market_context`
- `Setups` → `setups` (array)
- `Emotions & Habits` → `emotions_habits` (array)
- `Mistakes` → `mistakes` (array)
- `Outcomes & Learnings` → `outcomes_learnings`
- `Rating` → `rating`
- `Reviewed` → `reviewed`

---

## How to Start a New Claude Code Session
1. Open Terminal
2. `cd ~/Desktop/off-the-chart`
3. `claude`
4. Say: "Read CONTEXT.md and then let's continue with Phase 2"

Claude Code will read this file and have full context on everything above.

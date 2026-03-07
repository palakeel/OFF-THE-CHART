-- ============================================================
-- Off The Chart — Supabase Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol              TEXT        NOT NULL,
  option_type         TEXT        CHECK (option_type IN ('Call', 'Put', 'Stock')),
  strike              DECIMAL(10,2),
  expiration_date     DATE,
  open_date           DATE,
  open_time           TIME,
  close_date          DATE,
  close_time          TIME,
  contracts           INTEGER,
  avg_entry_price     DECIMAL(10,4),
  avg_exit_price      DECIMAL(10,4),
  gross_pnl           DECIMAL(10,2),
  commissions         DECIMAL(10,2) DEFAULT 0,
  net_pnl             DECIMAL(10,2),
  net_roi_pct         DECIMAL(10,2),
  hold_time_minutes   INTEGER,
  status              TEXT        CHECK (status IN ('WIN', 'LOSS', 'BREAKEVEN')),
  trade_status        TEXT        DEFAULT 'CLOSED' CHECK (trade_status IN ('OPEN', 'CLOSED')),
  strategy_tag        TEXT,
  trade_type          TEXT[],
  market_context      TEXT,
  setups              TEXT[],
  emotions_habits     TEXT[],
  mistakes            TEXT[],
  outcomes_learnings  TEXT,
  setup_notes         TEXT,
  rating              INTEGER     CHECK (rating >= 1 AND rating <= 5),
  reviewed            BOOLEAN     DEFAULT FALSE,
  imported_from       TEXT        DEFAULT 'manual' CHECK (imported_from IN ('screenshot', 'manual', 'pdf', 'csv')),
  ai_journal_entry    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Trade legs table (raw executions before matching)
CREATE TABLE IF NOT EXISTS trade_legs (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id            UUID        REFERENCES trades(id) ON DELETE CASCADE,
  user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action              TEXT        CHECK (action IN ('BTO', 'STC')),
  transaction_date    DATE,
  transaction_time    TIME,
  qty                 INTEGER,
  price               DECIMAL(10,4),
  debit               DECIMAL(10,2),
  credit              DECIMAL(10,2),
  raw_description     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Daily journal table
CREATE TABLE IF NOT EXISTS daily_journal (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_date          DATE        NOT NULL,
  daily_net_pnl       DECIMAL(10,2),
  trade_count         INTEGER,
  personal_notes      TEXT,
  ai_journal_entry    TEXT,
  mood_rating         INTEGER     CHECK (mood_rating >= 1 AND mood_rating <= 5),
  market_conditions   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trade_date)
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  starting_balance      DECIMAL(10,2),
  preferred_strategies  TEXT[],
  risk_per_trade        DECIMAL(10,2),
  daily_loss_limit      DECIMAL(10,2),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_legs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_journal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_trades"         ON trades         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_trade_legs"     ON trade_legs     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_daily_journal"  ON daily_journal  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_user_settings"  ON user_settings  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS trades_user_date ON trades (user_id, open_date);
CREATE INDEX IF NOT EXISTS trades_user_status ON trades (user_id, trade_status);

-- ============================================================
-- Polygon chart data migration
-- Run in Supabase SQL Editor before running fetch-chart-data.py
-- ============================================================

ALTER TABLE trades ADD COLUMN IF NOT EXISTS chart_data         JSONB;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS open_ts_ms         BIGINT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS close_ts_ms        BIGINT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS underlying_mae_pct DECIMAL(10,3);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS underlying_mfe_pct DECIMAL(10,3);

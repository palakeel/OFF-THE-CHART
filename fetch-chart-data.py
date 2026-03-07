#!/usr/bin/env python3
"""
fetch-chart-data.py — Download Polygon minute bars for every trade and store in Supabase.

Adds to each trade:
  - chart_data        JSONB   — array of {t, o, h, l, c} minute bars (UTC ms timestamps)
  - open_ts_ms        BIGINT  — trade entry timestamp in UTC ms (for chart reference line)
  - close_ts_ms       BIGINT  — trade exit timestamp in UTC ms
  - underlying_mae_pct  DECIMAL — max adverse excursion of underlying (%)
  - underlying_mfe_pct  DECIMAL — max favorable excursion of underlying (%)

Setup (run once):
    pip install boto3 pandas supabase

Usage:
    python fetch-chart-data.py               # Only trades without chart data
    python fetch-chart-data.py --force       # Reprocess everything
    python fetch-chart-data.py --symbol SPY  # One symbol only
    python fetch-chart-data.py --limit 20    # First N trades
"""

import gzip
import sys
import argparse
from pathlib import Path
from datetime import datetime

import pandas as pd
import boto3
from botocore.config import Config
from supabase import create_client

try:
    from zoneinfo import ZoneInfo          # Python 3.9+
except ImportError:
    from backports.zoneinfo import ZoneInfo # pip install backports.zoneinfo

# ── Credentials ───────────────────────────────────────────────────────────────
SUPABASE_URL        = "https://tkakaqtvqizulyhqnbcc.supabase.co"
SUPABASE_KEY        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYWthcXR2cWl6dWx5aHFuYmNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY3MzA2MSwiZXhwIjoyMDg4MjQ5MDYxfQ.tgJI--GdZBXw0qNiYRBEKpvoGC6AitwFWR2272BBTCo"

POLYGON_KEY_ID      = "5d9e98c8cea017001248e16f"
POLYGON_KEY_SECRET  = "_cGWibho0iKu_LxVt_tfvzCA4NaLd5_vgUmZGD"

DATA_DIR = Path.home() / "polygon_flatfiles"
ET = ZoneInfo("America/New_York")


# ── S3 / Polygon ──────────────────────────────────────────────────────────────
def get_s3():
    return boto3.Session(
        aws_access_key_id=POLYGON_KEY_ID,
        aws_secret_access_key=POLYGON_KEY_SECRET,
    ).client("s3", endpoint_url="https://files.polygon.io",
             config=Config(signature_version="s3v4"))


def download_day(s3, date_str):
    """Download daily flat file if not cached locally. Returns local Path or None."""
    year, month = date_str[:4], date_str[5:7]
    key   = f"us_stocks_sip/minute_aggs_v1/{year}/{month}/{date_str}.csv.gz"
    local = DATA_DIR / key
    if local.exists():
        return local
    local.parent.mkdir(parents=True, exist_ok=True)
    print(f"  ↓ {date_str}.csv.gz", flush=True)
    try:
        response = s3.get_object(Bucket="flatfiles", Key=key)
        with open(local, "wb") as f:
            f.write(response["Body"].read())
        return local
    except Exception as e:
        print(f"  ✗ {date_str}: {e}", flush=True)
        return None


def load_symbols_from_day(file_path, symbols):
    """
    Read one gzip flat file, return {symbol: DataFrame} for each requested symbol.
    Reads the file only once regardless of how many symbols are needed.
    """
    try:
        with gzip.open(file_path, "rt") as f:
            df = pd.read_csv(f)
    except Exception as e:
        print(f"  ✗ read error {file_path.name}: {e}", flush=True)
        return {}

    out = {}
    for sym in symbols:
        s = df[df["ticker"] == sym].copy()
        if s.empty:
            continue
        s["ts"] = pd.to_datetime(s["window_start"], unit="ns", utc=True)
        s = s.set_index("ts").sort_index()
        out[sym] = s[["open", "high", "low", "close", "volume"]]
    return out


# ── Timestamp helpers ─────────────────────────────────────────────────────────
def to_utc_ms(date_str, time_str):
    """Convert a 'YYYY-MM-DD' + 'HH:MM:SS' ET string to UTC milliseconds."""
    if not date_str:
        return None
    t = time_str or "09:30:00"
    # Strip sub-seconds and timezone suffixes (e.g. "09:32:03 EDT" → "09:32:03")
    t = t.strip().split(" ")[0][:8]
    try:
        dt = datetime.fromisoformat(f"{date_str}T{t}").replace(tzinfo=ET)
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


# ── MAE / MFE ─────────────────────────────────────────────────────────────────
def compute_mae_mfe(bars, option_type):
    """
    Returns (mae_pct, mfe_pct) — both positive percentages.
    MAE: how far the underlying moved AGAINST the trade direction.
    MFE: how far it moved IN FAVOR of the trade direction.
    """
    if bars is None or bars.empty:
        return None, None
    entry = float(bars.iloc[0]["close"])
    if entry == 0:
        return None, None
    hi = float(bars["high"].max())
    lo = float(bars["low"].min())
    if option_type == "Put":
        mfe = (entry - lo) / entry * 100   # favorable: price dropped
        mae = (hi - entry) / entry * 100   # adverse:   price rose
    else:
        mfe = (hi - entry) / entry * 100   # favorable: price rose
        mae = (entry - lo) / entry * 100   # adverse:   price dropped
    return round(max(mae, 0), 3), round(max(mfe, 0), 3)


# ── Chart data serialisation ──────────────────────────────────────────────────
def to_chart_data(bars):
    """Convert DataFrame to compact list of {t,o,h,l,c} for Recharts."""
    return [
        {
            "t": int(ts.timestamp() * 1000),
            "o": round(float(r["open"]),  4),
            "h": round(float(r["high"]),  4),
            "l": round(float(r["low"]),   4),
            "c": round(float(r["close"]), 4),
        }
        for ts, r in bars.iterrows()
    ]


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Fetch Polygon chart data for trades")
    parser.add_argument("--force",  action="store_true", help="Reprocess trades that already have chart data")
    parser.add_argument("--limit",  type=int, default=0,  help="Max trades to process")
    parser.add_argument("--symbol", type=str, default="",  help="Filter to one symbol")
    args = parser.parse_args()

    # ── Supabase ──────────────────────────────────────────────────────────────
    print("Connecting to Supabase…")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    q = sb.table("trades").select(
        "id, symbol, option_type, open_date, open_time, close_date, close_time, trade_status, chart_data"
    )
    if args.symbol:
        q = q.eq("symbol", args.symbol.upper())
    trades = q.execute().data
    print(f"Found {len(trades)} total trades")

    if not args.force:
        trades = [t for t in trades if not t.get("chart_data")]
        print(f"  → {len(trades)} without chart data (--force to reprocess all)")

    if args.limit:
        trades = trades[:args.limit]
        print(f"  → Limited to {args.limit}")

    if not trades:
        print("Nothing to process. Done.")
        return

    # ── Group trades by date so we download each day file only once ───────────
    needed_dates = {}  # date_str → set of symbols
    for t in trades:
        sym = (t.get("symbol") or "").upper()
        if not sym:
            continue
        for d in [t.get("open_date"), t.get("close_date")]:
            if d:
                needed_dates.setdefault(d, set()).add(sym)

    s3 = get_s3()

    # Pre-load all required day files
    print(f"\nLoading {len(needed_dates)} day file(s)…")
    day_data = {}  # date_str → {symbol → DataFrame}
    for date_str in sorted(needed_dates):
        syms = needed_dates[date_str]
        fp = download_day(s3, date_str)
        if fp:
            day_data[date_str] = load_symbols_from_day(fp, syms)
            loaded = list(day_data[date_str].keys())
            print(f"  {date_str}: {len(loaded)} symbol(s) loaded", flush=True)
        else:
            day_data[date_str] = {}

    # ── Process each trade ────────────────────────────────────────────────────
    print(f"\nProcessing {len(trades)} trades…")
    updated = skipped = errors = 0

    for i, trade in enumerate(trades):
        sym         = (trade.get("symbol") or "").upper()
        open_date   = trade.get("open_date")
        close_date  = trade.get("close_date")
        open_time   = trade.get("open_time")
        close_time  = trade.get("close_time")
        option_type = trade.get("option_type") or "Call"
        status      = trade.get("trade_status") or "CLOSED"

        label = f"[{i+1}/{len(trades)}] {sym:6s} {open_date}"
        if not sym or not open_date:
            print(f"{label}  — skipped (missing symbol/date)")
            skipped += 1
            continue

        # Gather bars: open day + close day (for swing trades)
        frames = []
        for d in ([open_date, close_date] if close_date and close_date != open_date and status == "CLOSED" else [open_date]):
            if d and sym in day_data.get(d, {}):
                frames.append(day_data[d][sym])

        if not frames:
            print(f"{label}  — no Polygon data")
            skipped += 1
            continue

        bars = pd.concat(frames).sort_index().loc[~pd.DataFrame(frames).index.duplicated(keep="first")] if len(frames) > 1 else frames[0]
        # Safe concat
        bars = pd.concat(frames).sort_index()
        bars = bars[~bars.index.duplicated(keep="first")]

        mae, mfe    = compute_mae_mfe(bars, option_type)
        chart_data  = to_chart_data(bars)
        open_ts_ms  = to_utc_ms(open_date, open_time)
        close_ts_ms = to_utc_ms(close_date, close_time) if status == "CLOSED" else None

        try:
            sb.table("trades").update({
                "chart_data":           chart_data,
                "open_ts_ms":           open_ts_ms,
                "close_ts_ms":          close_ts_ms,
                "underlying_mae_pct":   mae,
                "underlying_mfe_pct":   mfe,
            }).eq("id", trade["id"]).execute()

            print(f"{label}  {len(chart_data)} bars  MAE={mae}%  MFE={mfe}%  ✓", flush=True)
            updated += 1
        except Exception as e:
            print(f"{label}  ✗ update failed: {e}", flush=True)
            errors += 1

    print(f"\n{'─'*52}")
    print(f"Done.  ✓ {updated} updated   – {skipped} skipped   ✗ {errors} errors")


if __name__ == "__main__":
    main()

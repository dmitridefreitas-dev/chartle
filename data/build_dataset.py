"""Build public/dataset.json — the real-market-data heart of Chartle.

Daily puzzles: for each ticker, the most "interesting" (high |return| or
high vol) non-overlapping 90-trading-day windows, OHLC normalised to
close[0] = 100 so the price level never gives the answer away.

Rides: hand-curated famous market episodes (plus each ticker's wildest
stretch), closes only, for the crash-game mode — every run-up and
liquidation the player experiences actually happened.

Run:  python data/build_dataset.py   (writes public/dataset.json)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

# ticker: (name, class, sector, cap bucket)
UNIVERSE: dict[str, tuple[str, str, str, str]] = {
    # --- mega tech
    "AAPL": ("Apple", "stock", "Technology", "mega"),
    "MSFT": ("Microsoft", "stock", "Technology", "mega"),
    "GOOGL": ("Alphabet", "stock", "Technology", "mega"),
    "AMZN": ("Amazon", "stock", "Retail", "mega"),
    "META": ("Meta Platforms", "stock", "Technology", "mega"),
    "NFLX": ("Netflix", "stock", "Communications", "mega"),
    "ORCL": ("Oracle", "stock", "Technology", "mega"),
    "CRM": ("Salesforce", "stock", "Technology", "large"),
    "ADBE": ("Adobe", "stock", "Technology", "large"),
    "NOW": ("ServiceNow", "stock", "Technology", "large"),
    "IBM": ("IBM", "stock", "Technology", "large"),
    "CSCO": ("Cisco", "stock", "Technology", "large"),
    "PLTR": ("Palantir", "stock", "Technology", "large"),
    "SNOW": ("Snowflake", "stock", "Technology", "large"),
    "ZM": ("Zoom", "stock", "Technology", "mid"),
    "SHOP": ("Shopify", "stock", "Technology", "large"),
    "PYPL": ("PayPal", "stock", "Financials", "large"),
    "COIN": ("Coinbase", "stock", "Financials", "large"),
    "HOOD": ("Robinhood", "stock", "Financials", "mid"),
    # --- semis
    "NVDA": ("NVIDIA", "stock", "Semiconductors", "mega"),
    "AMD": ("AMD", "stock", "Semiconductors", "large"),
    "INTC": ("Intel", "stock", "Semiconductors", "large"),
    "MU": ("Micron", "stock", "Semiconductors", "large"),
    "AVGO": ("Broadcom", "stock", "Semiconductors", "mega"),
    "QCOM": ("Qualcomm", "stock", "Semiconductors", "large"),
    "TXN": ("Texas Instruments", "stock", "Semiconductors", "large"),
    "ADI": ("Analog Devices", "stock", "Semiconductors", "large"),
    "MCHP": ("Microchip", "stock", "Semiconductors", "mid"),
    "ON": ("onsemi", "stock", "Semiconductors", "mid"),
    "SMCI": ("Super Micro", "stock", "Semiconductors", "mid"),
    "TSM": ("TSMC", "stock", "Semiconductors", "mega"),
    # --- autos / EV
    "TSLA": ("Tesla", "stock", "Automotive", "mega"),
    "F": ("Ford", "stock", "Automotive", "large"),
    "GM": ("General Motors", "stock", "Automotive", "large"),
    "TM": ("Toyota", "stock", "Automotive", "mega"),
    "RIVN": ("Rivian", "stock", "Automotive", "mid"),
    "LCID": ("Lucid", "stock", "Automotive", "small"),
    "NIO": ("NIO", "stock", "Automotive", "mid"),
    # --- meme / retail favorites
    "GME": ("GameStop", "stock", "Retail", "small"),
    "AMC": ("AMC Entertainment", "stock", "Communications", "small"),
    "BB": ("BlackBerry", "stock", "Technology", "small"),
    "NOK": ("Nokia", "stock", "Technology", "large"),
    "SPCE": ("Virgin Galactic", "stock", "Industrials", "small"),
    "DKNG": ("DraftKings", "stock", "Travel & Leisure", "mid"),
    "PTON": ("Peloton", "stock", "Consumer", "small"),
    "RBLX": ("Roblox", "stock", "Technology", "mid"),
    "UBER": ("Uber", "stock", "Technology", "large"),
    "ABNB": ("Airbnb", "stock", "Travel & Leisure", "large"),
    "DASH": ("DoorDash", "stock", "Consumer", "large"),
    # --- financials
    "JPM": ("JPMorgan", "stock", "Financials", "mega"),
    "GS": ("Goldman Sachs", "stock", "Financials", "large"),
    "MS": ("Morgan Stanley", "stock", "Financials", "large"),
    "BAC": ("Bank of America", "stock", "Financials", "large"),
    "WFC": ("Wells Fargo", "stock", "Financials", "large"),
    "C": ("Citigroup", "stock", "Financials", "large"),
    "V": ("Visa", "stock", "Financials", "mega"),
    "MA": ("Mastercard", "stock", "Financials", "mega"),
    "AXP": ("American Express", "stock", "Financials", "large"),
    "BRK-B": ("Berkshire Hathaway", "stock", "Financials", "mega"),
    # --- energy
    "XOM": ("ExxonMobil", "stock", "Energy", "mega"),
    "CVX": ("Chevron", "stock", "Energy", "mega"),
    "OXY": ("Occidental", "stock", "Energy", "large"),
    "COP": ("ConocoPhillips", "stock", "Energy", "large"),
    "SLB": ("Schlumberger", "stock", "Energy", "large"),
    # --- consumer / retail
    "WMT": ("Walmart", "stock", "Retail", "mega"),
    "COST": ("Costco", "stock", "Retail", "mega"),
    "TGT": ("Target", "stock", "Retail", "large"),
    "HD": ("Home Depot", "stock", "Retail", "mega"),
    "LOW": ("Lowe's", "stock", "Retail", "large"),
    "MCD": ("McDonald's", "stock", "Consumer", "mega"),
    "SBUX": ("Starbucks", "stock", "Consumer", "large"),
    "CMG": ("Chipotle", "stock", "Consumer", "large"),
    "KO": ("Coca-Cola", "stock", "Consumer", "mega"),
    "PEP": ("PepsiCo", "stock", "Consumer", "mega"),
    "PG": ("Procter & Gamble", "stock", "Consumer", "mega"),
    "NKE": ("Nike", "stock", "Consumer", "large"),
    "LULU": ("Lululemon", "stock", "Consumer", "large"),
    # --- healthcare
    "JNJ": ("Johnson & Johnson", "stock", "Healthcare", "mega"),
    "PFE": ("Pfizer", "stock", "Healthcare", "large"),
    "MRNA": ("Moderna", "stock", "Healthcare", "mid"),
    "LLY": ("Eli Lilly", "stock", "Healthcare", "mega"),
    "UNH": ("UnitedHealth", "stock", "Healthcare", "mega"),
    "ABBV": ("AbbVie", "stock", "Healthcare", "mega"),
    # --- industrials / defense / airlines
    "BA": ("Boeing", "stock", "Industrials", "large"),
    "CAT": ("Caterpillar", "stock", "Industrials", "large"),
    "DE": ("John Deere", "stock", "Industrials", "large"),
    "GE": ("GE Aerospace", "stock", "Industrials", "large"),
    "LMT": ("Lockheed Martin", "stock", "Industrials", "large"),
    "UPS": ("UPS", "stock", "Industrials", "large"),
    "FDX": ("FedEx", "stock", "Industrials", "large"),
    "DAL": ("Delta Air Lines", "stock", "Travel & Leisure", "mid"),
    "UAL": ("United Airlines", "stock", "Travel & Leisure", "mid"),
    "AAL": ("American Airlines", "stock", "Travel & Leisure", "small"),
    "CCL": ("Carnival", "stock", "Travel & Leisure", "mid"),
    "RCL": ("Royal Caribbean", "stock", "Travel & Leisure", "large"),
    "MAR": ("Marriott", "stock", "Travel & Leisure", "large"),
    # --- communications
    "DIS": ("Disney", "stock", "Communications", "large"),
    "CMCSA": ("Comcast", "stock", "Communications", "large"),
    "T": ("AT&T", "stock", "Communications", "large"),
    "VZ": ("Verizon", "stock", "Communications", "large"),
    "TMUS": ("T-Mobile", "stock", "Communications", "large"),
    # --- ETFs
    "SPY": ("S&P 500 ETF", "etf", "ETF", "mega"),
    "QQQ": ("Nasdaq-100 ETF", "etf", "ETF", "mega"),
    "IWM": ("Russell 2000 ETF", "etf", "ETF", "large"),
    "GLD": ("Gold ETF", "etf", "ETF", "large"),
    "SLV": ("Silver ETF", "etf", "ETF", "mid"),
    "USO": ("Oil ETF", "etf", "ETF", "mid"),
    "TLT": ("20+yr Treasury ETF", "etf", "ETF", "large"),
    "ARKK": ("ARK Innovation ETF", "etf", "ETF", "mid"),
    "XLE": ("Energy Sector ETF", "etf", "ETF", "large"),
    "XLF": ("Financials Sector ETF", "etf", "ETF", "large"),
    "SOXX": ("Semiconductor ETF", "etf", "ETF", "large"),
    # --- crypto
    "BTC-USD": ("Bitcoin", "crypto", "Crypto", "mega"),
    "ETH-USD": ("Ethereum", "crypto", "Crypto", "mega"),
    "DOGE-USD": ("Dogecoin", "crypto", "Crypto", "large"),
    "SOL-USD": ("Solana", "crypto", "Crypto", "large"),
    "ADA-USD": ("Cardano", "crypto", "Crypto", "mid"),
    "XRP-USD": ("XRP", "crypto", "Crypto", "large"),
    "LTC-USD": ("Litecoin", "crypto", "Crypto", "mid"),
}

# Hand-picked legendary episodes for Ride mode (ticker, start, end, story).
FAMOUS_RIDES = [
    ("GME", "2020-12-01", "2021-03-31", "The GameStop squeeze: +2,400% in three weeks, then the fall."),
    ("AMC", "2021-05-01", "2021-08-31", "AMC's meme summer: apes, diamond hands, and a 10x round trip."),
    ("BTC-USD", "2017-09-01", "2018-03-31", "Bitcoin's 2017 mania: $4k to $19.6k to $7k."),
    ("BTC-USD", "2021-08-01", "2022-07-31", "Bitcoin's second peak and the long unwind to $17k."),
    ("DOGE-USD", "2021-03-01", "2021-08-31", "Dogecoin to the moon: the Elon tweets era."),
    ("ETH-USD", "2021-01-01", "2021-09-30", "Ethereum's DeFi summer run to $4.8k."),
    ("TSLA", "2019-10-01", "2021-02-28", "Tesla's 12x: S&P inclusion, splits, and the squeeze that made it a giant."),
    ("NVDA", "2023-01-01", "2024-06-30", "NVIDIA becomes the AI trade: the biggest value creation run in history."),
    ("SMCI", "2023-06-01", "2024-08-31", "Super Micro rides the AI wave 10x — then gives half back."),
    ("QQQ", "1999-06-01", "2001-06-30", "The dot-com bubble: the Nasdaq's greatest party and worst hangover."),
    ("SPY", "2007-10-01", "2009-06-30", "The Global Financial Crisis: -56% peak to trough."),
    ("SPY", "2020-01-01", "2020-12-31", "COVID: the fastest 34% crash ever, then the fastest recovery."),
    ("ZM", "2020-01-01", "2021-06-30", "Zoom: the pandemic darling's rise and the long descent."),
    ("PTON", "2020-03-01", "2022-03-31", "Peloton: lockdown hero to -90%."),
    ("COIN", "2021-04-14", "2022-06-30", "Coinbase from IPO day: listed at the exact top of crypto."),
    ("ARKK", "2020-03-01", "2022-06-30", "ARKK: the innovation bubble in one ticker."),
    ("MRNA", "2020-11-01", "2022-06-30", "Moderna: vaccine euphoria and the -85% comedown."),
    ("OXY", "2020-01-01", "2020-12-31", "Occidental in the year oil went negative."),
    ("CCL", "2020-01-01", "2021-06-30", "Carnival: cruise stocks in a pandemic."),
    ("BB", "2021-01-01", "2021-03-31", "BlackBerry's meme sympathy squeeze."),
    ("HOOD", "2021-07-29", "2022-06-30", "Robinhood from IPO: the broker of the meme era, memed itself."),
    ("NIO", "2020-06-01", "2021-03-31", "NIO's 14x EV mania run."),
    ("MU", "2017-01-01", "2019-01-31", "Micron's memory supercycle, boom and bust."),
    ("USO", "2020-02-01", "2020-06-30", "The oil ETF during negative crude. Yes, negative."),
]

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "dataset.json"

WINDOW = 90          # daily-puzzle bars
WINDOWS_PER_TICKER = 3
MIN_GAP = 120        # trading days between chosen windows


def pick_windows(close: pd.Series) -> list[int]:
    """Indices of the most interesting non-overlapping WINDOW-bar stretches."""
    if len(close) < WINDOW + 10:
        return []
    ret = close.pct_change()
    scores = []
    for start in range(0, len(close) - WINDOW, 5):
        seg = close.iloc[start : start + WINDOW]
        seg_ret = ret.iloc[start + 1 : start + WINDOW]
        total = abs(seg.iloc[-1] / seg.iloc[0] - 1.0)
        vol = seg_ret.std() * math.sqrt(252)
        scores.append((total + 0.5 * vol, start))
    scores.sort(reverse=True)
    chosen: list[int] = []
    for _, start in scores:
        if all(abs(start - c) >= MIN_GAP for c in chosen):
            chosen.append(start)
        if len(chosen) == WINDOWS_PER_TICKER:
            break
    return sorted(chosen)


def main() -> None:
    tickers = list(UNIVERSE)
    print(f"downloading {len(tickers)} tickers…")
    raw = yf.download(tickers, start="1999-01-01", auto_adjust=True,
                      progress=False, group_by="ticker")

    meta: dict[str, dict] = {}
    puzzles: list[dict] = []
    rides: list[dict] = []
    frames: dict[str, pd.DataFrame] = {}

    for ticker, (name, klass, sector, cap) in UNIVERSE.items():
        frame = raw[ticker].dropna() if ticker in raw.columns.get_level_values(0) else pd.DataFrame()
        if frame.empty or len(frame) < WINDOW + 10:
            print(f"  skip {ticker}: no data")
            continue
        frames[ticker] = frame

        full_vol = float(frame["Close"].pct_change().std() * math.sqrt(252))
        vol_bucket = ("low" if full_vol < 0.22 else
                      "medium" if full_vol < 0.35 else
                      "high" if full_vol < 0.55 else "extreme")
        meta[ticker] = {"name": name, "class": klass, "sector": sector,
                        "cap": cap, "vol": vol_bucket}

        for start in pick_windows(frame["Close"]):
            seg = frame.iloc[start : start + WINDOW]
            base = float(seg["Close"].iloc[0])
            bars = [[round(float(r.Open) / base * 100, 2),
                     round(float(r.High) / base * 100, 2),
                     round(float(r.Low) / base * 100, 2),
                     round(float(r.Close) / base * 100, 2)]
                    for r in seg.itertuples()]
            total = round((bars[-1][3] / 100 - 1) * 100, 1)
            puzzles.append({
                "t": ticker,
                "start": str(seg.index[0].date()),
                "end": str(seg.index[-1].date()),
                "bars": bars,
                "story": f"{name} ({ticker}), {seg.index[0]:%b %Y} – "
                         f"{seg.index[-1]:%b %Y}: {total:+.1f}% over the window.",
            })

    for ticker, start, end, story in FAMOUS_RIDES:
        if ticker not in frames:
            continue
        seg = frames[ticker].loc[start:end, "Close"].dropna()
        if len(seg) < 60:
            continue
        base = float(seg.iloc[0])
        rides.append({
            "t": ticker,
            "start": str(seg.index[0].date()),
            "closes": [round(float(c) / base * 100, 2) for c in seg],
            "story": story,
        })

    # Deterministic shuffle so consecutive days aren't the same ticker.
    rng = np.random.default_rng(20260706)
    rng.shuffle(puzzles)

    OUT.parent.mkdir(exist_ok=True)
    payload = {"version": 1, "meta": meta, "puzzles": puzzles, "rides": rides}
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    size_kb = OUT.stat().st_size // 1024
    print(f"wrote {OUT} — {len(puzzles)} puzzles, {len(rides)} rides, "
          f"{len(meta)} tickers, {size_kb} KB")


if __name__ == "__main__":
    main()

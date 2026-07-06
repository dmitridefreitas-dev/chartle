# How this project works — study notes

## What this is

A viral-mechanics web game built on real market data: a Wordle-style daily
chart-guessing game plus an Aviator-style crash game whose "RNG" is actual
market history. Zero backend, zero runtime dependencies, deployed as static
files to GitHub Pages by CI.

## The two loops and why they're shaped that way

**Daily** copies Wordle's growth engine deliberately: one puzzle per day
(scarcity → ritual → streaks), same puzzle for everyone (shared conversation),
and a spoiler-free emoji share grid (the brag artifact that markets the game).
The feedback system makes it a deduction game rather than a lottery: four
dimensions (type / sector / cap / vol) with directional arrows on the ordinal
ones, plus escalating hints (more candles per miss, era unlock at two misses).

**Ride** ports crash-gambling's loop — rising multiplier, cash out before the
crash, greed as the boss fight — onto real historical price segments with
selectable leverage. Play money only. The twist that makes it defensible *and*
better: no RNG and no house edge; you're riding GME/BTC/dot-com QQQ blind, and
the reveal after each round ("that was Peloton, 2021") is the educational
payload smuggled inside the dopamine.

## Architecture decisions worth defending

- **The Wordle architecture** (static + localStorage + date-derived puzzle):
  no server means no cost, no downtime, no accounts, no privacy surface — and
  it forces the one clever bit: `puzzleIndex = day × 2654435761 mod N`.
  Multiplying by a constant coprime to N walks a full permutation of the
  puzzle list before any repeat — deterministic for every player forever, and
  unit-tested for full coverage.
- **Crash engine as a pure state machine** (`crash.ts`): no timers, no RNG
  inside — the view injects animation and randomness. That's why liquidation
  math, absorbing terminal states, and auto-cash-at-end are all unit-testable.
  Equity multiplier is `1 + L·(p/p₀ − 1)`, clamped at 0 = liquidation.
- **Hand-rolled canvas renderer**: a chart library would be 50x the bundle for
  worse control. Candles + fog-of-war gradient for the daily; progressive
  interpolated line with scale-on-revealed-data-only for Ride (scaling on the
  full segment would leak the future — the same lookahead discipline as the
  quant repos, in a game).
- **Dataset built offline in Python** (`data/build_dataset.py`): windows are
  *selected for interestingness* (|total return| + realized vol score,
  non-overlapping), normalized to 100 so price level never identifies the
  ticker, and shipped as one ~1 MB JSON (250 KB gzipped) — 357 puzzles, 24
  curated ride episodes.

## Likely questions

- *Isn't Ride mode gambling?* No money in, no money out, nothing to buy; it's
  a leverage simulator with real historical outcomes and a scoreboard. The
  disclaimer is in the UI, and the bailout counter is the anti-glamor joke.
- *Why does the daily need no server — can't people cheat?* Sure: the answer
  is derivable client-side. So could Wordle's. Cheating in a free social game
  only cheats the group chat; the architecture trade (zero backend) is worth
  it until a real leaderboard justifies one.
- *Why normalize charts to 100?* Otherwise "price ≈ 150 in 2021" narrows to a
  handful of names instantly. Shape, volatility, and era should be the clues.
- *Where would multiplayer/leaderboards go?* A tiny edge function + KV store
  (answer-hash submissions, percentile distribution per day). Deliberately
  out of scope for v1 — ship the loop first.

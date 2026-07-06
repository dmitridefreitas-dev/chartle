import { describe, expect, it } from 'vitest';

import { CrashEngine, pickSegment } from './crash';
import { dayNumber, EPOCH_UTC, puzzleIndexForDay } from './daily';
import { barsVisible, MAX_GUESSES, scoreGuess } from './feedback';
import { rideBrag, shareGrid } from './share';
import { recordResult } from './stats';
import type { GuessFeedback, TickerMeta } from './types';

const META: Record<string, TickerMeta> = {
  NVDA: { name: 'NVIDIA', class: 'stock', sector: 'Semiconductors', cap: 'mega', vol: 'high' },
  AMD: { name: 'AMD', class: 'stock', sector: 'Semiconductors', cap: 'large', vol: 'high' },
  KO: { name: 'Coca-Cola', class: 'stock', sector: 'Consumer', cap: 'mega', vol: 'low' },
  SPY: { name: 'S&P 500 ETF', class: 'etf', sector: 'ETF', cap: 'mega', vol: 'low' },
  'BTC-USD': { name: 'Bitcoin', class: 'crypto', sector: 'Crypto', cap: 'mega', vol: 'extreme' },
};

describe('daily selection', () => {
  it('is deterministic and covers the whole list before repeating', () => {
    const N = 357;
    const seen = new Set<number>();
    for (let day = 0; day < N; day++) seen.add(puzzleIndexForDay(day, N));
    expect(seen.size).toBe(N); // full permutation — no early repeats
  });

  it('same date gives the same puzzle everywhere', () => {
    const a = puzzleIndexForDay(dayNumber(new Date('2026-08-01T03:00:00Z')), 357);
    const b = puzzleIndexForDay(dayNumber(new Date('2026-08-01T23:59:00Z')), 357);
    expect(a).toBe(b);
  });

  it('launch day is day zero', () => {
    expect(dayNumber(new Date(EPOCH_UTC))).toBe(0);
  });
});

describe('guess feedback', () => {
  it('exact guess is correct on every dimension', () => {
    const f = scoreGuess('NVDA', 'NVDA', META);
    expect(f.correct).toBe(true);
    expect([f.class, f.sector, f.cap, f.vol]).toEqual(['hit', 'hit', 'hit', 'hit']);
  });

  it('same-sector neighbour: sector hits, cap is close with direction up', () => {
    const f = scoreGuess('AMD', 'NVDA', META); // AMD large -> answer mega
    expect(f.correct).toBe(false);
    expect(f.sector).toBe('hit');
    expect(f.cap).toBe('close');
    expect(f.capDir).toBe(1); // answer is bigger than the guess
  });

  it('cross-class guess misses class and sector', () => {
    const f = scoreGuess('BTC-USD', 'KO', META);
    expect(f.class).toBe('miss');
    expect(f.sector).toBe('miss');
    expect(f.volDir).toBe(-1); // answer (low) is below guess (extreme)
  });

  it('reveal schedule starts partial and reaches full board', () => {
    expect(barsVisible(0, 90)).toBe(54);
    expect(barsVisible(MAX_GUESSES - 2, 90)).toBe(90);
    expect(barsVisible(99, 90)).toBe(90); // clamped
  });
});

describe('share grid', () => {
  const row = (over: Partial<GuessFeedback>): GuessFeedback => ({
    guess: 'X', correct: false, class: 'miss', sector: 'miss',
    cap: 'miss', vol: 'miss', capDir: 0, volDir: 0, ...over,
  });

  it('renders one emoji row per guess with score and streak', () => {
    const text = shareGrid(42, [
      row({ class: 'hit' }),
      row({ class: 'hit', sector: 'hit', cap: 'close', vol: 'hit', correct: true }),
    ], true, 7, 'https://x.test/');
    expect(text).toContain('Chartle #42 2/6');
    expect(text).toContain('\u{1F525}7');
    const lines = text.split('\n');
    expect(lines[1]).toBe('\u{1F7E9}⬛⬛⬛');
    expect(lines[2]).toBe('\u{1F7E9}\u{1F7E9}\u{1F7E8}\u{1F7E9}');
    expect(text.endsWith('https://x.test/')).toBe(true);
  });

  it('a loss shows X/6 and no spoilers', () => {
    const text = shareGrid(1, [row({})], false, 0);
    expect(text).toContain('X/6');
    expect(text).not.toContain('NVDA');
  });

  it('ride brags cover both endings', () => {
    expect(rideBrag('GME', 3.5, 250, false)).toContain('3.50x on GME');
    expect(rideBrag('GME', 0, -100, true)).toContain('Liquidated by GME');
  });
});

describe('streaks', () => {
  it('consecutive-day wins build a streak; a gap resets it', () => {
    let s = recordResult(10, true, 3, {
      games: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: -1, dist: [0, 0, 0, 0, 0, 0],
    });
    s = recordResult(11, true, 2, s);
    expect(s.streak).toBe(2);
    s = recordResult(13, true, 1, s); // skipped day 12
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(2);
    s = recordResult(14, false, 6, s);
    expect(s.streak).toBe(0);
    expect(s.dist).toEqual([1, 1, 1, 0, 0, 0]);
  });
});

describe('crash engine', () => {
  it('cash-out pays stake times the live multiplier', () => {
    // +10% per bar at 3x leverage.
    const engine = new CrashEngine([100, 110, 121], 3, 200);
    engine.step();
    const state = engine.cashOut();
    expect(state.status).toBe('cashed');
    expect(state.multiplier).toBeCloseTo(1.3, 10);
    expect(state.payout).toBeCloseTo(260, 10);
  });

  it('liquidates exactly when leveraged equity hits zero', () => {
    // 10x leverage dies on a -10% bar.
    const engine = new CrashEngine([100, 95, 89.9], 10, 100);
    let state = engine.step();
    expect(state.status).toBe('riding'); // -5% at 10x = 0.5x, still alive
    state = engine.step();
    expect(state.status).toBe('liquidated');
    expect(state.payout).toBe(0);
    // terminal state is absorbing
    expect(engine.step().status).toBe('liquidated');
    expect(engine.cashOut().payout).toBe(0);
  });

  it('surviving the whole episode auto-cashes at the final bar', () => {
    const engine = new CrashEngine([100, 90, 120], 1, 50);
    engine.step();
    const state = engine.step();
    expect(state.status).toBe('ended');
    expect(state.payout).toBeCloseTo(60, 10);
    expect(state.peak).toBeCloseTo(1.2, 10);
  });

  it('1x leverage can never be liquidated by a normal price path', () => {
    const engine = new CrashEngine([100, 40, 10, 1], 1, 100);
    let state = engine.current;
    while (state.status === 'riding') state = engine.step();
    expect(state.status).toBe('ended'); // battered, never busted
    expect(state.multiplier).toBeCloseTo(0.01, 10);
  });

  it('pickSegment respects bounds and is driven by the injected rng', () => {
    const closes = Array.from({ length: 500 }, (_, i) => 100 + i);
    const seg = pickSegment(closes, () => 0.5, 45, 140);
    expect(seg.length).toBeGreaterThanOrEqual(45);
    expect(seg.length).toBeLessThanOrEqual(140);
    const again = pickSegment(closes, () => 0.5, 45, 140);
    expect(again).toEqual(seg); // deterministic under a fixed rng
  });
});

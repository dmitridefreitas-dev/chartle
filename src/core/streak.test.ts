import { describe, expect, it } from 'vitest';

import { applyCall, buildRound, HORIZON, outcome, SHOWN_BARS } from './streak';
import type { Dataset } from './types';

const data: Dataset = {
  version: 1,
  meta: {},
  puzzles: [{
    t: 'NVDA', start: '2022-01-03', end: '2022-05-13',
    bars: Array.from({ length: 90 }, (_, i) => {
      const c = 100 + i; // monotone rise
      return [c, c + 1, c - 1, c] as [number, number, number, number];
    }),
    story: '',
  }],
  rides: [{
    t: 'GME', start: '2020-12-01',
    closes: Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 9) * 40 + i * 0.01),
    story: '',
  }],
};

describe('streak rounds', () => {
  it('slices exactly SHOWN + HORIZON bars, renormalised to 100', () => {
    const round = buildRound(data, () => 0.4);
    expect(round.closes.length).toBe(SHOWN_BARS + HORIZON);
    expect(round.closes[0]).toBeCloseTo(100, 6);
    expect(['NVDA', 'GME']).toContain(round.ticker);
  });

  it('is deterministic under an injected rng', () => {
    const a = buildRound(data, () => 0.123);
    const b = buildRound(data, () => 0.123);
    expect(a).toEqual(b);
  });

  it('outcome compares the horizon end to the decision bar', () => {
    const up = buildRound({ ...data, rides: [] }, () => 0.99); // monotone rise puzzle
    expect(outcome(up)).toBe('up');

    const falling: Dataset = {
      ...data, rides: [],
      puzzles: [{ ...data.puzzles[0],
        bars: Array.from({ length: 90 }, (_, i) => {
          const c = 200 - i;
          return [c, c + 1, c - 1, c] as [number, number, number, number];
        }) }],
    };
    expect(outcome(buildRound(falling, () => 0.5))).toBe('down');
  });
});

describe('streak scoring', () => {
  const fresh = () => ({ streak: 0, best: 0, rounds: 0, wins: 0, todayBest: 0, todayDay: -1 });

  it('grows on wins, records best, dies on a loss', () => {
    let s = fresh();
    s = applyCall(s, true);
    s = applyCall(s, true);
    s = applyCall(s, true);
    expect(s.streak).toBe(3);
    expect(s.best).toBe(3);
    s = applyCall(s, false);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(3);
    expect(s.rounds).toBe(4);
    s = applyCall(s, true);
    expect(s.streak).toBe(1); // rebuilding
    expect(s.best).toBe(3);
  });

  it("today's best resets on a new day while all-time survives", () => {
    let s = fresh();
    s = applyCall(s, true, 10);
    s = applyCall(s, true, 10);
    expect(s.todayBest).toBe(2);
    s = applyCall(s, false, 10);
    s = applyCall(s, true, 11); // next day
    expect(s.todayBest).toBe(1);
    expect(s.best).toBe(2);
  });
});

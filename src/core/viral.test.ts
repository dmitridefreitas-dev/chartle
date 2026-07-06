import { describe, expect, it } from 'vitest';

import { isMilestone, nextMilestone, RANKS, titleFor } from './progress';
import { mulberry32, randomSeedString, seedFromString } from './rng';
import { streakBrag } from './share';

describe('seeded rng (challenge links)', () => {
  it('same seed, same sequence — the whole point', () => {
    const a = mulberry32(seedFromString('abc123'));
    const b = mulberry32(seedFromString('abc123'));
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('different seeds diverge and stay in [0, 1)', () => {
    const a = mulberry32(seedFromString('abc123'));
    const c = mulberry32(seedFromString('abc124'));
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const va = a(), vc = c();
      expect(va).toBeGreaterThanOrEqual(0);
      expect(va).toBeLessThan(1);
      if (va === vc) same++;
    }
    expect(same).toBeLessThan(3);
  });

  it('seed strings are url-safe base36', () => {
    for (let i = 0; i < 20; i++) expect(randomSeedString()).toMatch(/^[0-9a-z]{6}$/);
  });
});

describe('ranks', () => {
  it('titles are monotone in best streak', () => {
    expect(titleFor(0)).toBe('Paper Hands');
    expect(titleFor(4)).toBe('Intern');
    expect(titleFor(12)).toBe('Senior PM');
    expect(titleFor(99)).toBe('The Oracle');
  });

  it('milestones fire exactly at thresholds', () => {
    for (const rank of RANKS) {
      if (rank.streak > 0) expect(isMilestone(rank.streak)).toBe(true);
    }
    expect(isMilestone(4)).toBe(false);
    expect(isMilestone(0)).toBe(false);
  });

  it('next milestone points upward and tops out', () => {
    expect(nextMilestone(0)?.streak).toBe(3);
    expect(nextMilestone(12)?.streak).toBe(17);
    expect(nextMilestone(30)).toBeNull();
  });
});

describe('challenge brag', () => {
  it('carries the tape, the rank, and the seeded rematch link', () => {
    const text = streakBrag(7, 'GME', [true, true, false, true], 'k3x9zz', 'Analyst', 'https://x.test/');
    expect(text).toContain('7 in a row · Analyst');
    expect(text).toContain('\u{1F7E9}\u{1F7E9}\u{1F7E5}\u{1F7E9}');
    expect(text).toContain('Same charts, your turn:');
    expect(text).toContain('https://x.test/?view=streak&seed=k3x9zz');
  });

  it('tape is capped at the last 15 calls', () => {
    const calls = Array.from({ length: 40 }, (_, i) => i % 2 === 0);
    const text = streakBrag(20, 'SPY', calls, '', '');
    const tapeLine = text.split('\n')[1];
    expect([...tapeLine].length).toBeLessThanOrEqual(30); // 15 surrogate-pair emoji
  });
});

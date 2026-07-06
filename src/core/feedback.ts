// Wordle-style structured feedback: every guess teaches you something
// about the answer along four dimensions — asset class, sector, market-cap
// bucket, and volatility bucket. Ordinal dimensions (cap, vol) also tell
// you the direction, which is what makes the deduction game real.

import type { CapBucket, GuessFeedback, Mark, TickerMeta, VolBucket } from './types';

const CAP_ORDER: CapBucket[] = ['micro', 'small', 'mid', 'large', 'mega'];
const VOL_ORDER: VolBucket[] = ['low', 'medium', 'high', 'extreme'];

function ordinalMark(order: string[], guess: string, answer: string): { mark: Mark; dir: -1 | 0 | 1 } {
  const gi = order.indexOf(guess);
  const ai = order.indexOf(answer);
  if (gi === ai) return { mark: 'hit', dir: 0 };
  const mark: Mark = Math.abs(gi - ai) === 1 ? 'close' : 'miss';
  return { mark, dir: ai > gi ? 1 : -1 };
}

export function scoreGuess(
  guess: string,
  answer: string,
  meta: Record<string, TickerMeta>,
): GuessFeedback {
  const g = meta[guess];
  const a = meta[answer];
  if (!g || !a) throw new Error(`unknown ticker in guess scoring: ${guess} vs ${answer}`);

  const cap = ordinalMark(CAP_ORDER, g.cap, a.cap);
  const vol = ordinalMark(VOL_ORDER, g.vol, a.vol);

  return {
    guess,
    correct: guess === answer,
    class: g.class === a.class ? 'hit' : 'miss',
    sector: g.sector === a.sector ? 'hit' : 'miss',
    cap: cap.mark,
    capDir: cap.dir,
    vol: vol.mark,
    volDir: vol.dir,
  };
}

export const MAX_GUESSES = 6;

// Chart reveal schedule: start partially hidden, wrong guesses buy candles.
export function barsVisible(guessesMade: number, totalBars: number): number {
  const initial = Math.floor(totalBars * 0.6);
  const step = Math.ceil((totalBars - initial) / (MAX_GUESSES - 2));
  return Math.min(totalBars, initial + step * Math.max(0, guessesMade));
}

// The era hint (start year) unlocks after the second wrong guess.
export function eraRevealed(guessesMade: number): boolean {
  return guessesMade >= 2;
}

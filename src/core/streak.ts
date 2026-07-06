// Streak mode — the mass-market loop: a real chart, one binary call
// (up or down over the next HORIZON bars), instant reveal, streak or death.
//
// Rounds are sliced from the same real-data pools as the other modes
// (daily-puzzle OHLC windows and ride episodes), so every chart you call
// actually happened. Randomness is injected for testability; outcome is
// pure arithmetic on the closes.

import type { Dataset } from './types';

export const SHOWN_BARS = 48;   // what you see before deciding
export const HORIZON = 10;      // how far ahead you're calling
const TOTAL = SHOWN_BARS + HORIZON;

export type Call = 'up' | 'down';

export interface StreakRound {
  closes: number[];             // SHOWN_BARS + HORIZON, renormalised to 100
  ticker: string;
  era: string;                  // e.g. "Mar 2020"
}

export interface StreakState {
  streak: number;
  best: number;
  rounds: number;
  wins: number;
  todayBest: number;
  todayDay: number;   // dayNumber the todayBest belongs to
}

export function buildRound(data: Dataset, rand: () => number = Math.random): StreakRound {
  // Pool A: ride episodes (long series). Pool B: daily-puzzle windows.
  const useRide = data.rides.length > 0 && rand() < 0.5;
  let closes: number[];
  let ticker: string;
  let startIso: string;

  if (useRide) {
    const ride = data.rides[Math.floor(rand() * data.rides.length)];
    closes = ride.closes;
    ticker = ride.t;
    startIso = ride.start;
  } else {
    const puzzle = data.puzzles[Math.floor(rand() * data.puzzles.length)];
    closes = puzzle.bars.map(b => b[3]);
    ticker = puzzle.t;
    startIso = puzzle.start;
  }

  const maxStart = closes.length - TOTAL;
  const start = maxStart <= 0 ? 0 : Math.floor(rand() * maxStart);
  const slice = closes.slice(start, start + TOTAL);
  const base = slice[0];
  const normalised = slice.map(c => Math.round((c / base) * 10000) / 100);

  // Rough era label: start date + start offset in trading days.
  const approx = new Date(startIso);
  approx.setDate(approx.getDate() + Math.round(start * 1.45)); // ~252/365
  const era = approx.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return { closes: normalised, ticker, era };
}

export function outcome(round: StreakRound): Call {
  const last = round.closes[round.closes.length - 1];
  const decision = round.closes[SHOWN_BARS - 1];
  return last >= decision ? 'up' : 'down';
}

export function applyCall(state: StreakState, correct: boolean, day = 0): StreakState {
  const next: StreakState = { ...state, rounds: state.rounds + 1 };
  if (next.todayDay !== day) {         // fresh day → fresh beatable target
    next.todayDay = day;
    next.todayBest = 0;
  }
  if (correct) {
    next.wins = state.wins + 1;
    next.streak = state.streak + 1;
    next.best = Math.max(state.best, next.streak);
    next.todayBest = Math.max(next.todayBest, next.streak);
  } else {
    next.streak = 0;
  }
  return next;
}

// ---- persistence ----------------------------------------------------------

const KEY = 'chartle.streak.v1';
const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage;

const FALLBACK: StreakState = {
  streak: 0, best: 0, rounds: 0, wins: 0, todayBest: 0, todayDay: -1,
};

export function loadStreak(): StreakState {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? { ...FALLBACK, ...(JSON.parse(raw) as StreakState) } : { ...FALLBACK };
  } catch {
    return { ...FALLBACK };
  }
}

export function saveStreak(state: StreakState): void {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch { /* forgetting is fine */ }
}

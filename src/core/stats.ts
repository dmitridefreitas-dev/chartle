// Local persistence: per-day game state (refresh-proof), win streaks, and
// the Ride-mode bankroll. Everything lives in localStorage — the original
// Wordle architecture: no accounts, no server, nothing to leak.

import type { GuessFeedback } from './types';

const STATS_KEY = 'chartle.stats.v1';
const STATE_KEY = (day: number) => `chartle.state.v1.${day}`;
const BANK_KEY = 'chartle.bank.v1';

export interface Stats {
  games: number;
  wins: number;
  streak: number;
  maxStreak: number;
  lastWinDay: number;      // -1 = never
  dist: number[];          // wins by guess count, index 0 = won in 1
}

export interface DayState {
  day: number;
  feedback: GuessFeedback[];
  done: boolean;
  won: boolean;
}

export interface Bank {
  balance: number;
  best: number;            // highest balance ever reached
  bestMult: number;        // highest multiplier ever cashed
  bailouts: number;        // times the player went bust and took the loan
  lastRefillDay: number;
}

const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the game still plays, it just forgets */
  }
}

export function loadStats(): Stats {
  return read<Stats>(STATS_KEY, {
    games: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: -1,
    dist: [0, 0, 0, 0, 0, 0],
  });
}

export function recordResult(day: number, won: boolean, guesses: number, prior?: Stats): Stats {
  const s = prior ?? loadStats();
  s.games += 1;
  if (won) {
    s.wins += 1;
    s.dist[Math.min(guesses - 1, 5)] += 1;
    // A streak survives only across consecutive days.
    s.streak = s.lastWinDay === day - 1 ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastWinDay = day;
  } else {
    s.streak = 0;
  }
  write(STATS_KEY, s);
  return s;
}

export function loadDayState(day: number): DayState {
  return read<DayState>(STATE_KEY(day), { day, feedback: [], done: false, won: false });
}

export function saveDayState(state: DayState): void {
  write(STATE_KEY(state.day), state);
}

// ---- Ride-mode bankroll ---------------------------------------------------

export const STARTING_BANKROLL = 1000;

export function loadBank(day: number): Bank {
  const bank = read<Bank>(BANK_KEY, {
    balance: STARTING_BANKROLL, best: STARTING_BANKROLL, bestMult: 0,
    bailouts: 0, lastRefillDay: day,
  });
  // Broke and it's a new day? The market reopens with fresh (fake) capital.
  if (bank.balance < 1 && day > bank.lastRefillDay) {
    bank.balance = STARTING_BANKROLL;
    bank.lastRefillDay = day;
  }
  return bank;
}

export function saveBank(bank: Bank): void {
  write(BANK_KEY, bank);
}

export function takeBailout(bank: Bank, day: number): Bank {
  bank.balance = STARTING_BANKROLL;
  bank.bailouts += 1;
  bank.lastRefillDay = day;
  saveBank(bank);
  return bank;
}

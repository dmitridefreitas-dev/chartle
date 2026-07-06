// Deterministic daily puzzle selection — the original Wordle architecture:
// no server, everyone on Earth gets the same puzzle from the UTC date.
//
// The day index maps to a puzzle through multiplication by a constant
// coprime to the puzzle count, which walks a full permutation of the list
// before any repeat — no two consecutive days share a ticker (the dataset
// is pre-shuffled), and the sequence is stable forever.

export const EPOCH_UTC = Date.UTC(2026, 6, 6); // launch day = puzzle #1

const STRIDE = 2654435761; // Knuth's multiplicative constant, odd → coprime with any even N±

export function dayNumber(now: Date = new Date()): number {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((todayUtc - EPOCH_UTC) / 86_400_000);
}

export function puzzleNumber(now: Date = new Date()): number {
  return dayNumber(now) + 1; // human-facing: launch day is Chartle #1
}

export function puzzleIndexForDay(day: number, puzzleCount: number): number {
  if (puzzleCount <= 0) throw new Error('empty puzzle list');
  // BigInt keeps the multiply exact; Number(% count) is safe afterwards.
  const idx = (BigInt(day < 0 ? 0 : day) * BigInt(STRIDE)) % BigInt(puzzleCount);
  return Number(idx);
}

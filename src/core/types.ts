// Shared domain types. Bars are OHLC normalised to close[0] = 100 so the
// price level never leaks the answer; rides are close-only series.

export type AssetClass = 'stock' | 'etf' | 'crypto';
export type CapBucket = 'micro' | 'small' | 'mid' | 'large' | 'mega';
export type VolBucket = 'low' | 'medium' | 'high' | 'extreme';

export interface TickerMeta {
  name: string;
  class: AssetClass;
  sector: string;
  cap: CapBucket;
  vol: VolBucket;
}

export interface Puzzle {
  t: string;                    // ticker
  start: string;                // ISO date of first bar
  end: string;
  bars: [number, number, number, number][]; // O H L C, normalised
  story: string;
}

export interface Ride {
  t: string;
  start: string;
  closes: number[];             // normalised to 100
  story: string;
}

export interface Dataset {
  version: number;
  meta: Record<string, TickerMeta>;
  puzzles: Puzzle[];
  rides: Ride[];
}

export type Mark = 'hit' | 'close' | 'miss';

export interface GuessFeedback {
  guess: string;
  class: Mark;                  // asset class match
  sector: Mark;
  cap: Mark;                    // 'close' = adjacent bucket; arrows via capDir
  vol: Mark;
  capDir: -1 | 0 | 1;           // answer is smaller / equal / bigger than guess
  volDir: -1 | 0 | 1;
  correct: boolean;
}

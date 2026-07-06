// The Ride engine — the crash-game loop, honestly sourced.
//
// Classic crash gambling (Aviator, etc.) draws its multiplier from an RNG
// with a house edge. Ride mode replays REAL historical price paths instead:
// your multiplier is a leveraged position in an actual market episode, the
// crash points are real crashes, and the house edge is history itself.
//
// equity multiplier at bar i:  m_i = 1 + L * (p_i / p_0 - 1)
// liquidation:                 m_i <= 0  (your margin is gone — stake lost)
// cash out any time:           payout = stake * m_i
// survive to the end:          auto cash-out at the final bar.
//
// The engine is a pure state machine over a fixed price path — no RNG, no
// timers — so every rule is unit-testable; the view supplies animation.

export interface CrashState {
  bar: number;                  // index of the latest applied bar
  multiplier: number;           // current equity multiplier (>= 0)
  peak: number;                 // best multiplier seen this ride
  status: 'riding' | 'cashed' | 'liquidated' | 'ended';
  payout: number;               // set when status is terminal
}

export class CrashEngine {
  private readonly prices: number[];
  private readonly leverage: number;
  private readonly stake: number;
  private state: CrashState;

  constructor(prices: number[], leverage: number, stake: number) {
    if (prices.length < 2) throw new Error('ride needs at least two bars');
    if (leverage <= 0 || stake <= 0) throw new Error('leverage and stake must be positive');
    this.prices = prices;
    this.leverage = leverage;
    this.stake = stake;
    this.state = { bar: 0, multiplier: 1, peak: 1, status: 'riding', payout: 0 };
  }

  get current(): CrashState {
    return { ...this.state };
  }

  multiplierAt(bar: number): number {
    const m = 1 + this.leverage * (this.prices[bar] / this.prices[0] - 1);
    return Math.max(0, m);
  }

  // Advance one bar. Returns the new state (terminal states are absorbing).
  step(): CrashState {
    if (this.state.status !== 'riding') return this.current;
    const next = this.state.bar + 1;
    const m = this.multiplierAt(next);
    this.state.bar = next;
    this.state.multiplier = m;
    this.state.peak = Math.max(this.state.peak, m);
    if (m <= 0) {
      this.state.status = 'liquidated';
      this.state.payout = 0;
    } else if (next === this.prices.length - 1) {
      this.state.status = 'ended';           // survived the whole episode
      this.state.payout = this.stake * m;
    }
    return this.current;
  }

  cashOut(): CrashState {
    if (this.state.status !== 'riding') return this.current;
    this.state.status = 'cashed';
    this.state.payout = this.stake * this.state.multiplier;
    return this.current;
  }
}

// Slice a random playable window out of a ride's full price series.
// Randomness is injected so tests can drive it deterministically.
export function pickSegment(
  closes: number[],
  rand: () => number = Math.random,
  minBars = 45,
  maxBars = 140,
): number[] {
  if (closes.length <= minBars) return closes.slice();
  const length = Math.min(
    closes.length,
    minBars + Math.floor(rand() * (maxBars - minBars)),
  );
  const start = Math.floor(rand() * (closes.length - length));
  return closes.slice(start, start + length);
}

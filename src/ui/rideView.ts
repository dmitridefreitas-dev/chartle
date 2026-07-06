// Ride mode: the crash-game loop on real market history. Pick leverage,
// stake play-money points, watch a hidden historical chart replay live,
// and cash out before your leveraged position hits zero. The ticker and
// dates are revealed only when the ride ends — every liquidation here
// actually happened to someone.

import { CrashEngine, pickSegment } from '../core/crash';
import { rideBrag } from '../core/share';
import { dayNumber } from '../core/daily';
import { Bank, loadBank, saveBank, takeBailout } from '../core/stats';
import type { Dataset, Ride } from '../core/types';
import { drawRideLine } from './chartRenderer';
import { buzz, shake, toast } from './fx';
import { sound } from './sound';

const LEVERAGES = [1, 2, 3, 5, 10];
const BARS_PER_SECOND = 9;

export function mountRide(root: HTMLElement, data: Dataset): void {
  let bank: Bank = loadBank(dayNumber());
  let engine: CrashEngine | null = null;
  let ride: Ride | null = null;
  let segment: number[] = [];
  let stake = 0;
  let leverage = 3;
  let animation = 0;
  let startTime = 0;
  let multsHit = new Set<number>();
  const MULT_TOASTS = [2, 3, 5, 10];

  root.innerHTML = `
    <div class="panel">
      <div class="ride-head">
        <div class="bank">
          <span class="bank-label">bankroll</span>
          <span class="bank-value" id="bank-value"></span>
        </div>
        <div class="mult" id="mult">1.00x</div>
        <div class="bank">
          <span class="bank-label">best cash-out</span>
          <span class="bank-value" id="best-mult"></span>
        </div>
      </div>
      <canvas id="ride-chart" class="chart"></canvas>
      <div id="ride-story" class="microcopy">A hidden real market episode. Cash out before history liquidates you.</div>
      <div id="controls" class="ride-controls">
        <div class="lev-row" id="lev-row">
          ${LEVERAGES.map(l => `<button class="btn lev ${l === 3 ? 'active' : ''}" data-l="${l}">${l}x</button>`).join('')}
        </div>
        <div class="stake-row">
          <input id="stake" type="number" min="1" step="1" value="100" />
          <button class="btn" id="stake-half">½</button>
          <button class="btn" id="stake-max">max</button>
          <button class="btn primary" id="go">RIDE</button>
        </div>
      </div>
      <button class="btn cashout hidden" id="cashout">CASH OUT</button>
      <div id="ride-result" class="result"></div>
      <p class="microcopy disclaimer">Play money. No purchases, no payouts — the only thing at risk is your ego.
      Every price path is real market history; the house edge is hindsight.</p>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#ride-chart')!;
  const multEl = root.querySelector<HTMLElement>('#mult')!;
  const bankEl = root.querySelector<HTMLElement>('#bank-value')!;
  const bestEl = root.querySelector<HTMLElement>('#best-mult')!;
  const storyEl = root.querySelector<HTMLElement>('#ride-story')!;
  const controls = root.querySelector<HTMLElement>('#controls')!;
  const cashoutBtn = root.querySelector<HTMLButtonElement>('#cashout')!;
  const resultEl = root.querySelector<HTMLElement>('#ride-result')!;
  const stakeInput = root.querySelector<HTMLInputElement>('#stake')!;

  function refreshBank(): void {
    bankEl.textContent = Math.floor(bank.balance).toLocaleString();
    bestEl.textContent = bank.bestMult > 0 ? `${bank.bestMult.toFixed(2)}x` : '—';
  }

  function setMult(m: number, status: string): void {
    multEl.textContent = `${m.toFixed(2)}x`;
    multEl.className = `mult ${status === 'liquidated' ? 'dead' : m >= 1 ? 'up' : 'down'}`;
  }

  function beginRide(): void {
    stake = Math.floor(Number(stakeInput.value));
    if (!Number.isFinite(stake) || stake < 1) return;
    if (stake > bank.balance) { stake = Math.floor(bank.balance); }
    if (stake < 1) return;

    ride = data.rides[Math.floor(Math.random() * data.rides.length)];
    segment = pickSegment(ride.closes);
    engine = new CrashEngine(segment, leverage, stake);
    bank.balance -= stake;
    saveBank(bank);
    refreshBank();

    controls.classList.add('hidden');
    cashoutBtn.classList.remove('hidden');
    resultEl.innerHTML = '';
    multsHit = new Set();
    storyEl.textContent = `Riding ${leverage}x leverage with ${stake} pts on a mystery chart…`;
    setMult(1, 'riding');
    startTime = performance.now();
    animation = requestAnimationFrame(tick);
  }

  function tick(now: number): void {
    if (!engine) return;
    const elapsed = (now - startTime) / 1000;
    const targetBar = Math.min(segment.length - 1, elapsed * BARS_PER_SECOND);

    let state = engine.current;
    while (state.status === 'riding' && state.bar < Math.floor(targetBar)) {
      state = engine.step();
    }

    const frac = state.status === 'riding' ? targetBar : state.bar;
    drawRideLine(canvas, segment, frac, state.multiplier < 1);
    setMult(state.multiplier, state.status);

    for (const threshold of MULT_TOASTS) {
      if (state.multiplier >= threshold && !multsHit.has(threshold)) {
        multsHit.add(threshold);
        toast(`${threshold}x 🔥 don't get greedy`);
        sound.win(threshold * 3);
      }
    }

    if (state.status === 'riding') {
      animation = requestAnimationFrame(tick);
    } else {
      finishRide(state.status, state.payout, state.multiplier, state.peak);
    }
  }

  function finishRide(
    status: 'cashed' | 'liquidated' | 'ended', payout: number, mult: number, peak: number,
  ): void {
    cancelAnimationFrame(animation);
    if (!ride) return;
    bank.balance += payout;
    bank.best = Math.max(bank.best, bank.balance);
    if (status !== 'liquidated' && mult > bank.bestMult) bank.bestMult = mult;
    saveBank(bank);
    refreshBank();

    const profit = payout - stake;
    const liquidated = status === 'liquidated';
    if (liquidated) {
      sound.lose();
      shake();
      buzz([80, 50, 120]);
    } else {
      sound.cash();
      buzz(25);
    }
    const title = liquidated
      ? `\u{1F4A5} LIQUIDATED at ${leverage}x`
      : status === 'ended'
        ? `Ride over — auto cash-out at ${mult.toFixed(2)}x`
        : `\u{1F680} Cashed out at ${mult.toFixed(2)}x`;
    const peakNote = liquidated && peak > 1.05
      ? `<div class="reveal-story">It touched ${peak.toFixed(2)}x. Greed is a hell of a drug.</div>` : '';

    resultEl.innerHTML = `
      <div class="reveal ${liquidated || profit < 0 ? 'loss' : 'win'}">
        <div class="reveal-title">${title} <b>${profit >= 0 ? '+' : ''}${Math.round(profit)}</b> pts</div>
        <div class="reveal-story">That was <b>${ride.t}</b> — ${ride.story}</div>
        ${peakNote}
        <div class="stake-row">
          <button class="btn primary" id="again">Ride again</button>
          <button class="btn" id="brag">Share</button>
          <span id="brag-ok" class="hint"></span>
        </div>
      </div>`;
    resultEl.querySelector('#again')!.addEventListener('click', resetControls);
    resultEl.querySelector('#brag')!.addEventListener('click', async () => {
      const text = rideBrag(ride!.t, mult, profit, liquidated);
      try {
        await navigator.clipboard.writeText(text);
        resultEl.querySelector('#brag-ok')!.textContent = 'copied!';
      } catch {
        prompt('Copy:', text);
      }
    });

    cashoutBtn.classList.add('hidden');
    if (bank.balance < 1) {
      resultEl.insertAdjacentHTML('beforeend', `
        <div class="reveal loss">
          <div class="reveal-title">You're broke.</div>
          <div class="reveal-story">The market reopens tomorrow with fresh points — or swallow your pride now.</div>
          <button class="btn primary" id="bailout">Take the bailout (#${bank.bailouts + 1})</button>
        </div>`);
      resultEl.querySelector('#bailout')!.addEventListener('click', () => {
        bank = takeBailout(bank, dayNumber());
        refreshBank();
        resetControls();
      });
    }
    engine = null;
  }

  function resetControls(): void {
    resultEl.innerHTML = '';
    controls.classList.remove('hidden');
    storyEl.textContent = 'A hidden real market episode. Cash out before history liquidates you.';
    drawRideLine(canvas, [100, 100], 1, false);
    setMult(1, 'riding');
  }

  root.querySelectorAll<HTMLButtonElement>('.lev').forEach(el =>
    el.addEventListener('click', () => {
      leverage = Number(el.dataset.l);
      root.querySelectorAll('.lev').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
    }));
  root.querySelector('#stake-half')!.addEventListener('click', () => {
    stakeInput.value = String(Math.max(1, Math.floor(bank.balance / 2)));
  });
  root.querySelector('#stake-max')!.addEventListener('click', () => {
    stakeInput.value = String(Math.floor(bank.balance));
  });
  root.querySelector('#go')!.addEventListener('click', beginRide);
  cashoutBtn.addEventListener('click', () => {
    if (engine) {
      const state = engine.cashOut();
      finishRide('cashed', state.payout, state.multiplier, state.peak);
    }
  });

  refreshBank();
  drawRideLine(canvas, [100, 100], 1, false);
}

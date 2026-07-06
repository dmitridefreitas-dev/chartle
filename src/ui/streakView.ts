// Streak view — the loop you can't look away from.
//
// draw-in (0.5s) -> frozen at the fog line -> UP / DOWN -> the future
// animates in (0.9s) -> green flash & streak++ or red flash & death
// screen -> next chart in under a second. Keyboard: arrow up / down.

import { applyCall, buildRound, HORIZON, loadStreak, outcome, saveStreak,
  SHOWN_BARS, StreakRound } from '../core/streak';
import { streakBrag } from '../core/share';
import type { Dataset } from '../core/types';
import { drawRideLine } from './chartRenderer';

type Phase = 'drawing' | 'deciding' | 'revealing' | 'dead';

export function mountStreak(root: HTMLElement, data: Dataset): void {
  let state = loadStreak();
  let round: StreakRound = buildRound(data);
  let phase: Phase = 'drawing';
  let animation = 0;

  root.innerHTML = `
    <div class="panel">
      <div class="ride-head">
        <div class="bank">
          <span class="bank-label">streak</span>
          <span class="bank-value streak-now" id="streak-now">0</span>
        </div>
        <div class="mult" id="streak-flame">⚡</div>
        <div class="bank">
          <span class="bank-label">best</span>
          <span class="bank-value" id="streak-best">0</span>
        </div>
      </div>
      <canvas id="streak-chart" class="chart"></canvas>
      <div class="reveal-tag" id="reveal-tag">&nbsp;</div>
      <div class="updown" id="updown">
        <button class="btn call up" id="call-up">📈 UP</button>
        <button class="btn call down" id="call-down">📉 DOWN</button>
      </div>
      <p class="microcopy">A real chart from market history. Call the next ${HORIZON} days.
      Arrow keys work. Streak dies on one wrong call.</p>
      <div id="streak-result" class="result"></div>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#streak-chart')!;
  const streakEl = root.querySelector<HTMLElement>('#streak-now')!;
  const bestEl = root.querySelector<HTMLElement>('#streak-best')!;
  const flameEl = root.querySelector<HTMLElement>('#streak-flame')!;
  const tagEl = root.querySelector<HTMLElement>('#reveal-tag')!;
  const upBtn = root.querySelector<HTMLButtonElement>('#call-up')!;
  const downBtn = root.querySelector<HTMLButtonElement>('#call-down')!;
  const resultEl = root.querySelector<HTMLElement>('#streak-result')!;

  function refreshHud(): void {
    streakEl.textContent = String(state.streak);
    bestEl.textContent = String(state.best);
    flameEl.textContent = state.streak >= 10 ? '🔥' : state.streak >= 5 ? '⚡' : '📊';
    const accuracy = state.rounds ? Math.round((100 * state.wins) / state.rounds) : 0;
    flameEl.title = `${accuracy}% lifetime accuracy over ${state.rounds} calls`;
  }

  function setButtons(enabled: boolean): void {
    upBtn.disabled = !enabled;
    downBtn.disabled = !enabled;
  }

  function startRound(): void {
    cancelAnimationFrame(animation);
    round = buildRound(data);
    phase = 'drawing';
    tagEl.innerHTML = '&nbsp;';
    resultEl.innerHTML = '';
    setButtons(false);
    const t0 = performance.now();
    const drawInMs = 500;
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / drawInMs);
      drawRideLine(canvas, round.closes.slice(0, SHOWN_BARS), progress * (SHOWN_BARS - 1), false);
      if (progress < 1) {
        animation = requestAnimationFrame(step);
      } else {
        phase = 'deciding';
        setButtons(true);
      }
    };
    animation = requestAnimationFrame(step);
  }

  function call(direction: 'up' | 'down'): void {
    if (phase !== 'deciding') return;
    phase = 'revealing';
    setButtons(false);
    const correct = outcome(round) === direction;
    const t0 = performance.now();
    const revealMs = 900;
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / revealMs);
      const upTo = (SHOWN_BARS - 1) + progress * HORIZON;
      const last = Math.min(round.closes.length - 1, Math.ceil(upTo));
      const underwater = round.closes[last] < round.closes[SHOWN_BARS - 1];
      drawRideLine(canvas, round.closes, upTo, underwater);
      if (progress < 1) {
        animation = requestAnimationFrame(step);
      } else {
        settle(correct);
      }
    };
    animation = requestAnimationFrame(step);
  }

  function settle(correct: boolean): void {
    state = applyCall(state, correct);
    saveStreak(state);
    refreshHud();
    tagEl.textContent = `${round.ticker} · ${round.era}`;

    const flash = document.createElement('div');
    flash.className = `flash ${correct ? 'good' : 'bad'}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 450);

    if (correct) {
      phase = 'drawing';
      setTimeout(startRound, 750);
    } else {
      phase = 'dead';
      const humbled = state.rounds && state.best > 0 ? state.best : 0;
      const acc = state.rounds ? Math.round((100 * state.wins) / state.rounds) : 0;
      resultEl.innerHTML = `
        <div class="reveal loss">
          <div class="reveal-title">💀 Streak over. <b>${round.ticker}</b> · ${round.era}</div>
          <div class="reveal-story">Best streak: <b>${humbled}</b> · lifetime accuracy ${acc}%.
          The market drifts up ~53% of weeks — and it still got you.</div>
          <div class="stake-row">
            <button class="btn primary" id="streak-again">Run it back</button>
            <button class="btn" id="streak-share">Share</button>
            <span id="streak-ok" class="hint"></span>
          </div>
        </div>`;
      resultEl.querySelector('#streak-again')!.addEventListener('click', startRound);
      resultEl.querySelector('#streak-share')!.addEventListener('click', async () => {
        const text = streakBrag(state.best, round.ticker);
        try {
          await navigator.clipboard.writeText(text);
          resultEl.querySelector('#streak-ok')!.textContent = 'copied!';
        } catch {
          prompt('Copy:', text);
        }
      });
    }
  }

  upBtn.addEventListener('click', () => call('up'));
  downBtn.addEventListener('click', () => call('down'));
  window.addEventListener('keydown', e => {
    if (root.closest('.hidden')) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); call('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); call('down'); }
    if (e.key === 'Enter' && phase === 'dead') startRound();
  });

  refreshHud();
  startRound();
}

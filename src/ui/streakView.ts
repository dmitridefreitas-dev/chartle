// Streak view — the loop you can't look away from, now with the full
// juice pass: rising win chimes, milestone rank-ups with particle bursts,
// screen shake + haptics on death, a today-vs-all-time target, first-run
// onboarding, and CHALLENGE LINKS — the share URL carries the run seed,
// so a rival plays the exact same chart sequence. Zero backend.

import { dayNumber } from '../core/daily';
import { isMilestone, nextMilestone, titleFor } from '../core/progress';
import { mulberry32, randomSeedString, sanitizeSeed, seedFromString } from '../core/rng';
import { applyCall, buildRound, HORIZON, loadStreak, outcome, saveStreak,
  SHOWN_BARS, StreakRound } from '../core/streak';
import { streakBrag } from '../core/share';
import type { Dataset } from '../core/types';
import { drawRideLine } from './chartRenderer';
import { esc } from './escape';
import { burst, buzz, pop, shake, toast } from './fx';
import { sound } from './sound';

type Phase = 'drawing' | 'deciding' | 'revealing' | 'dead';

const ONBOARD_KEY = 'chartle.onboarded.v1';

export function mountStreak(root: HTMLElement, data: Dataset): void {
  let state = loadStreak();
  const urlSeed = sanitizeSeed(new URLSearchParams(location.search).get('seed'));
  const isChallenge = !!urlSeed;
  let runSeed = urlSeed ?? randomSeedString();
  let rand = mulberry32(seedFromString(runSeed));
  let round: StreakRound = buildRound(data, rand);
  let runCalls: boolean[] = [];
  let phase: Phase = 'drawing';
  let animation = 0;
  let lastTick = -1;

  root.innerHTML = `
    <div class="panel">
      ${isChallenge ? `<div class="challenge-banner">⚔️ Challenge run — same charts as your rival. Seed <b>${runSeed}</b></div>` : ''}
      <div class="streak-hud">
        <div class="bank">
          <span class="bank-label">today</span>
          <span class="bank-value" id="today-best">0</span>
        </div>
        <div class="streak-center">
          <span class="streak-big" id="streak-now">0</span>
          <span class="streak-title" id="streak-title"></span>
        </div>
        <div class="bank right">
          <span class="bank-label">all-time</span>
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
      ↑/↓ keys work. One wrong call ends the run.</p>
      <div id="streak-result" class="result"></div>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#streak-chart')!;
  const streakEl = root.querySelector<HTMLElement>('#streak-now')!;
  const titleEl = root.querySelector<HTMLElement>('#streak-title')!;
  const bestEl = root.querySelector<HTMLElement>('#streak-best')!;
  const todayEl = root.querySelector<HTMLElement>('#today-best')!;
  const tagEl = root.querySelector<HTMLElement>('#reveal-tag')!;
  const upBtn = root.querySelector<HTMLButtonElement>('#call-up')!;
  const downBtn = root.querySelector<HTMLButtonElement>('#call-down')!;
  const resultEl = root.querySelector<HTMLElement>('#streak-result')!;

  function refreshHud(): void {
    streakEl.textContent = String(state.streak);
    bestEl.textContent = String(state.best);
    todayEl.textContent = String(state.todayDay === dayNumber() ? state.todayBest : 0);
    titleEl.textContent = titleFor(state.best);
  }

  function setButtons(enabled: boolean): void {
    upBtn.disabled = !enabled;
    downBtn.disabled = !enabled;
  }

  function newRun(freshSeed: boolean): void {
    if (freshSeed) {
      runSeed = randomSeedString();
      history.replaceState(null, '', '?view=streak');
    }
    rand = mulberry32(seedFromString(runSeed));
    runCalls = [];
    startRound();
  }

  function startRound(): void {
    cancelAnimationFrame(animation);
    round = buildRound(data, rand);
    phase = 'drawing';
    lastTick = -1;
    tagEl.innerHTML = '&nbsp;';
    resultEl.innerHTML = '';
    setButtons(false);
    const t0 = performance.now();
    const drawInMs = 450;
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
    const revealMs = 850;
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / revealMs);
      const upTo = (SHOWN_BARS - 1) + progress * HORIZON;
      const bar = Math.min(round.closes.length - 1, Math.floor(upTo));
      if (bar > lastTick && bar > SHOWN_BARS - 1) {
        sound.tick(bar - SHOWN_BARS);
        lastTick = bar;
      }
      const underwater = round.closes[Math.min(round.closes.length - 1, Math.ceil(upTo))]
        < round.closes[SHOWN_BARS - 1];
      drawRideLine(canvas, round.closes, upTo, underwater, SHOWN_BARS - 1);
      if (progress < 1) {
        animation = requestAnimationFrame(step);
      } else {
        settle(correct);
      }
    };
    animation = requestAnimationFrame(step);
  }

  function settle(correct: boolean): void {
    state = applyCall(state, correct, dayNumber());
    saveStreak(state);
    runCalls.push(correct);
    refreshHud();

    const move = (round.closes[round.closes.length - 1] / round.closes[SHOWN_BARS - 1] - 1) * 100;
    tagEl.innerHTML = `<b>${esc(round.ticker)}</b> · ${esc(round.era)} · ${move >= 0 ? '+' : ''}${move.toFixed(1)}% in ${HORIZON}d`;

    const flash = document.createElement('div');
    flash.className = `flash ${correct ? 'good' : 'bad'}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 450);

    if (correct) {
      pop(streakEl);
      sound.win(state.streak);
      buzz(20);
      if (isMilestone(state.streak)) {
        sound.milestone();
        burst(streakEl);
        toast(`🏆 ${titleFor(state.streak)} — streak ${state.streak}`);
        buzz([40, 60, 40]);
      }
      phase = 'drawing';
      setTimeout(startRound, 700);
    } else {
      sound.lose();
      shake();
      buzz([80, 50, 120]);
      die();
    }
  }

  function die(): void {
    phase = 'dead';
    const finished = runCalls.filter(c => c).length;
    const tape = runCalls.slice(-15).map(c => (c ? '🟩' : '🟥')).join('');
    const next = nextMilestone(state.best);
    const acc = state.rounds ? Math.round((100 * state.wins) / state.rounds) : 0;
    resultEl.innerHTML = `
      <div class="reveal loss">
        <div class="reveal-title">💀 Run over at <b>${finished}</b> — killed by <b>${esc(round.ticker)}</b> · ${esc(round.era)}</div>
        <div class="tape">${tape}</div>
        <div class="reveal-story">
          Rank: <b>${titleFor(state.best)}</b>${next ? ` — ${next.streak - state.best} more for ${next.title}` : ' — maximum rank'}
          · today's best ${state.todayBest} · all-time ${state.best} · lifetime accuracy ${acc}%
        </div>
        <div class="stake-row">
          <button class="btn primary" id="streak-again">Run it back</button>
          <button class="btn" id="streak-share">⚔️ Challenge a friend</button>
          <span id="streak-ok" class="hint"></span>
        </div>
      </div>`;
    resultEl.querySelector('#streak-again')!.addEventListener('click', () => newRun(!isChallenge));
    resultEl.querySelector('#streak-share')!.addEventListener('click', async () => {
      const text = streakBrag(finished, round.ticker, runCalls, runSeed, titleFor(state.best));
      try {
        await navigator.clipboard.writeText(text);
        resultEl.querySelector('#streak-ok')!.textContent = 'copied — send it!';
      } catch {
        prompt('Copy:', text);
      }
    });
  }

  upBtn.addEventListener('click', () => call('up'));
  downBtn.addEventListener('click', () => call('down'));
  window.addEventListener('keydown', e => {
    if (root.classList.contains('hidden')) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); call('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); call('down'); }
    if (e.key === 'Enter' && phase === 'dead') newRun(!isChallenge);
  });

  // First-run onboarding: three seconds, one idea. ?nointro=1 skips it
  // (embeds, screenshots).
  let onboarded = new URLSearchParams(location.search).has('nointro');
  try { onboarded ||= localStorage.getItem(ONBOARD_KEY) === '1'; } catch { /* fine */ }
  if (!onboarded) {
    const overlay = document.createElement('div');
    overlay.className = 'onboard';
    overlay.innerHTML = `
      <div class="onboard-card">
        <div class="onboard-emoji">📈</div>
        <h2>Call the market</h2>
        <p>A <b>real chart from history</b> appears. You call the next ${HORIZON} days:
        up or down. Right = streak grows. Wrong = it dies.</p>
        <button class="btn primary" id="onboard-go">Let's go</button>
      </div>`;
    root.appendChild(overlay);
    overlay.querySelector('#onboard-go')!.addEventListener('click', () => {
      overlay.remove();
      try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* fine */ }
    });
  }

  refreshHud();
  startRound();
}

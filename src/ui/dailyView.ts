// The Daily view: one real chart per UTC day, six guesses, structured
// feedback, streaks, and the emoji share grid. State survives refresh.

import { dayNumber, puzzleIndexForDay, puzzleNumber } from '../core/daily';
import { barsVisible, eraRevealed, MAX_GUESSES, scoreGuess } from '../core/feedback';
import { shareGrid } from '../core/share';
import {
  DayState, loadDayState, loadStats, recordResult, saveDayState,
} from '../core/stats';
import type { Dataset, GuessFeedback, Mark } from '../core/types';
import { drawCandles } from './chartRenderer';

const MARK_EMOJI: Record<Mark, string> = { hit: '\u{1F7E9}', close: '\u{1F7E8}', miss: '⬛' };
const DIMS = ['class', 'sector', 'cap', 'vol'] as const;
const DIM_LABEL: Record<(typeof DIMS)[number], string> = {
  class: 'type', sector: 'sector', cap: 'mkt cap', vol: 'volatility',
};

export function mountDaily(root: HTMLElement, data: Dataset): void {
  const day = dayNumber();
  const puzzle = data.puzzles[puzzleIndexForDay(day, data.puzzles.length)];
  const answerMeta = data.meta[puzzle.t];
  let state: DayState = loadDayState(day);

  const universe = Object.entries(data.meta)
    .map(([t, m]) => ({ ticker: t, name: m.name }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  root.innerHTML = `
    <div class="panel">
      <div class="puzzle-head">
        <span class="puzzle-no">Chartle #${puzzleNumber()}</span>
        <span class="hint" id="era-hint"></span>
      </div>
      <canvas id="daily-chart" class="chart"></canvas>
      <p class="microcopy">A real ${puzzle.bars.length}-day chart, rebased to 100. Wrong guesses reveal more candles.</p>
      <div class="guess-box">
        <input id="guess-input" type="text" autocomplete="off" spellcheck="false"
               placeholder="Guess the ticker… (${MAX_GUESSES} tries)" />
        <button id="guess-btn" class="btn primary">Guess</button>
      </div>
      <div id="suggestions" class="suggestions"></div>
      <div class="feedback-legend">
        ${DIMS.map(d => `<span>${DIM_LABEL[d]}</span>`).join('')}
        <span></span>
      </div>
      <div id="rows" class="feedback-rows"></div>
      <div id="result" class="result"></div>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#daily-chart')!;
  const input = root.querySelector<HTMLInputElement>('#guess-input')!;
  const button = root.querySelector<HTMLButtonElement>('#guess-btn')!;
  const suggestions = root.querySelector<HTMLElement>('#suggestions')!;
  const rows = root.querySelector<HTMLElement>('#rows')!;
  const result = root.querySelector<HTMLElement>('#result')!;
  const eraHint = root.querySelector<HTMLElement>('#era-hint')!;

  function wrongCount(): number {
    return state.feedback.filter(f => !f.correct).length;
  }

  function redraw(): void {
    drawCandles(canvas, puzzle.bars, state.done ? puzzle.bars.length
      : barsVisible(wrongCount(), puzzle.bars.length));
    eraHint.textContent = (state.done || eraRevealed(wrongCount()))
      ? `era: ${puzzle.start.slice(0, 4)}` : 'era: locked';
    renderRows();
    if (state.done) renderResult();
  }

  function renderRows(): void {
    rows.innerHTML = state.feedback.map(f => {
      const dirArrow = (mark: Mark, dir: -1 | 0 | 1) =>
        mark === 'hit' ? '' : dir > 0 ? '↑' : dir < 0 ? '↓' : '';
      return `<div class="frow ${f.correct ? 'won' : ''}">
        <span class="cell">${MARK_EMOJI[f.class]}</span>
        <span class="cell">${MARK_EMOJI[f.sector]}</span>
        <span class="cell">${MARK_EMOJI[f.cap]}<i>${dirArrow(f.cap, f.capDir)}</i></span>
        <span class="cell">${MARK_EMOJI[f.vol]}<i>${dirArrow(f.vol, f.volDir)}</i></span>
        <span class="cell ticker">${f.guess}</span>
      </div>`;
    }).join('');
  }

  function renderResult(): void {
    const stats = loadStats();
    result.innerHTML = `
      <div class="reveal ${state.won ? 'win' : 'loss'}">
        <div class="reveal-title">${state.won ? 'Solved.' : 'The market wins.'}
          <b>${puzzle.t}</b> — ${answerMeta.name}</div>
        <div class="reveal-story">${puzzle.story}</div>
        <div class="statline">
          <span><b>${stats.streak}</b> streak</span>
          <span><b>${stats.maxStreak}</b> best</span>
          <span><b>${stats.games ? Math.round((100 * stats.wins) / stats.games) : 0}%</b> win rate</span>
          <span><b>${stats.games}</b> played</span>
        </div>
        <button id="share-btn" class="btn primary">Share result</button>
        <span id="share-ok" class="hint"></span>
      </div>`;
    result.querySelector<HTMLButtonElement>('#share-btn')!.addEventListener('click', async () => {
      const text = shareGrid(puzzleNumber(), state.feedback, state.won, loadStats().streak);
      try {
        await navigator.clipboard.writeText(text);
        result.querySelector('#share-ok')!.textContent = 'copied!';
      } catch {
        prompt('Copy your result:', text);
      }
    });
    input.disabled = true;
    button.disabled = true;
    suggestions.innerHTML = '';
  }

  function submit(raw: string): void {
    const guess = raw.trim().toUpperCase();
    if (state.done || !data.meta[guess]) return;
    if (state.feedback.some(f => f.guess === guess)) return; // no repeats
    const fb: GuessFeedback = scoreGuess(guess, puzzle.t, data.meta);
    state.feedback.push(fb);
    if (fb.correct) {
      state.done = true; state.won = true;
      recordResult(day, true, state.feedback.length);
    } else if (state.feedback.length >= MAX_GUESSES) {
      state.done = true; state.won = false;
      recordResult(day, false, state.feedback.length);
    }
    saveDayState(state);
    input.value = '';
    suggestions.innerHTML = '';
    redraw();
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toUpperCase();
    if (!q) { suggestions.innerHTML = ''; return; }
    const guessed = new Set(state.feedback.map(f => f.guess));
    const hits = universe
      .filter(u => !guessed.has(u.ticker) &&
        (u.ticker.startsWith(q) || u.name.toUpperCase().includes(q)))
      .slice(0, 6);
    suggestions.innerHTML = hits.map(u =>
      `<button class="sugg" data-t="${u.ticker}"><b>${u.ticker}</b> ${u.name}</button>`).join('');
    suggestions.querySelectorAll<HTMLButtonElement>('.sugg').forEach(el =>
      el.addEventListener('click', () => submit(el.dataset.t!)));
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = suggestions.querySelector<HTMLButtonElement>('.sugg');
      submit(input.value.trim() ? (data.meta[input.value.trim().toUpperCase()]
        ? input.value : first?.dataset.t ?? input.value) : '');
    }
  });
  button.addEventListener('click', () => submit(input.value));
  window.addEventListener('resize', redraw);

  redraw();
}

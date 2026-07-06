// The share artifact — the single most important growth feature. A
// spoiler-free emoji grid that brags for you, exactly like Wordle's,
// with one row per guess: asset class / sector / market cap / volatility.

import type { GuessFeedback, Mark } from './types';
import { MAX_GUESSES } from './feedback';

const EMOJI: Record<Mark, string> = { hit: '\u{1F7E9}', close: '\u{1F7E8}', miss: '⬛' };

export function shareGrid(
  puzzleNo: number,
  feedback: GuessFeedback[],
  won: boolean,
  streak: number,
  url = 'https://dmitridefreitas-dev.github.io/chartle/',
): string {
  const score = won ? `${feedback.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const flame = streak > 1 ? ` \u{1F525}${streak}` : '';
  const rows = feedback.map(f =>
    EMOJI[f.class] + EMOJI[f.sector] + EMOJI[f.cap] + EMOJI[f.vol],
  );
  return `Chartle #${puzzleNo} ${score}${flame}\n${rows.join('\n')}\n${url}`;
}

export function streakBrag(
  best: number, killedBy: string,
  url = 'https://dmitridefreitas-dev.github.io/chartle/?view=streak',
): string {
  return `⚡ Chartle Streak: ${best} charts called in a row.\nFinally humbled by ${killedBy}.\n${url}`;
}

export function rideBrag(
  ticker: string, mult: number, profit: number, liquidated: boolean,
  url = 'https://dmitridefreitas-dev.github.io/chartle/?view=ride',
): string {
  return liquidated
    ? `\u{1F4A5} Liquidated by ${ticker}. History wins again.\n${url}`
    : `\u{1F680} Cashed out ${mult.toFixed(2)}x on ${ticker} (+${Math.round(profit)} pts)\n${url}`;
}

// Titles and milestones — identity investment. A number resets; a rank is
// something you defend. Thresholds are spaced so early ranks come fast
// (hook) and late ranks are genuinely rare (status).

export interface Rank {
  streak: number;
  title: string;
}

export const RANKS: Rank[] = [
  { streak: 0, title: 'Paper Hands' },
  { streak: 3, title: 'Intern' },
  { streak: 5, title: 'Junior Analyst' },
  { streak: 8, title: 'Analyst' },
  { streak: 12, title: 'Senior PM' },
  { streak: 17, title: 'Hedge Fund Manager' },
  { streak: 23, title: 'Market Wizard' },
  { streak: 30, title: 'The Oracle' },
];

export function titleFor(bestStreak: number): string {
  let title = RANKS[0].title;
  for (const rank of RANKS) if (bestStreak >= rank.streak) title = rank.title;
  return title;
}

// A milestone fires the moment the CURRENT streak reaches a rank threshold.
export function isMilestone(streak: number): boolean {
  return RANKS.some(r => r.streak === streak && r.streak > 0);
}

export function nextMilestone(streak: number): Rank | null {
  for (const rank of RANKS) if (rank.streak > streak) return rank;
  return null;
}

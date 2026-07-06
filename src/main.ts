import './style.css';
import type { Dataset } from './core/types';
import { mountDaily } from './ui/dailyView';
import { mountRide } from './ui/rideView';
import { mountStreak } from './ui/streakView';

const app = document.querySelector<HTMLElement>('#app')!;

async function boot(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}dataset.json`);
  if (!res.ok) {
    app.innerHTML = '<p class="microcopy">Failed to load market data. Refresh?</p>';
    return;
  }
  const data = (await res.json()) as Dataset;

  const roots: Record<string, HTMLElement> = {
    streak: document.querySelector<HTMLElement>('#view-streak')!,
    daily: document.querySelector<HTMLElement>('#view-daily')!,
    ride: document.querySelector<HTMLElement>('#view-ride')!,
  };
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
  const mounted = new Set<string>();
  const mounts: Record<string, (el: HTMLElement, d: Dataset) => void> = {
    streak: mountStreak, daily: mountDaily, ride: mountRide,
  };

  function show(view: string): void {
    if (!(view in roots)) view = 'streak';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
    for (const [name, el] of Object.entries(roots)) el.classList.toggle('hidden', name !== view);
    if (!mounted.has(view)) {
      mounts[view](roots[view], data);
      mounted.add(view);
    }
    history.replaceState(null, '', view === 'streak' ? location.pathname : `?view=${view}`);
  }

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.view!)));
  show(new URLSearchParams(location.search).get('view') ?? 'streak');
}

void boot();

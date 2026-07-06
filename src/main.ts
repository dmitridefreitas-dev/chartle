import './style.css';
import type { Dataset } from './core/types';
import { mountDaily } from './ui/dailyView';
import { mountRide } from './ui/rideView';

const app = document.querySelector<HTMLElement>('#app')!;

async function boot(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}dataset.json`);
  if (!res.ok) {
    app.innerHTML = '<p class="microcopy">Failed to load market data. Refresh?</p>';
    return;
  }
  const data = (await res.json()) as Dataset;

  const dailyRoot = document.querySelector<HTMLElement>('#view-daily')!;
  const rideRoot = document.querySelector<HTMLElement>('#view-ride')!;
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');

  let rideMounted = false;
  mountDaily(dailyRoot, data);

  function show(view: string): void {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
    dailyRoot.classList.toggle('hidden', view !== 'daily');
    rideRoot.classList.toggle('hidden', view !== 'ride');
    if (view === 'ride' && !rideMounted) {
      mountRide(rideRoot, data);
      rideMounted = true;
    }
    history.replaceState(null, '', view === 'ride' ? '?view=ride' : location.pathname);
  }

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.view!)));
  show(new URLSearchParams(location.search).get('view') === 'ride' ? 'ride' : 'daily');
}

void boot();

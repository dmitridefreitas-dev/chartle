// Game feel: particles, screen shake, number pops, toasts, haptics.
// All DOM + Web Animations API — no canvas overlay, no dependencies.
// Everything respects prefers-reduced-motion.

export const reducedMotion: boolean =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export function burst(anchor: HTMLElement, colors: string[] = ['#26a69a', '#fbbf24', '#4f8ff7']): void {
  if (reducedMotion) return;
  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 90;
    p.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 40}px) scale(0.2)`,
          opacity: 0,
        },
      ],
      { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(0.1,0.8,0.3,1)' },
    ).onfinish = () => p.remove();
  }
}

export function shake(): void {
  if (reducedMotion) return;
  document.body.classList.remove('shake');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 450);
}

export function pop(el: HTMLElement): void {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

export function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('gone'), 1400);
  setTimeout(() => el.remove(), 1900);
}

export function buzz(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* fine */ }
}

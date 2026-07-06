// Dependency-free WebAudio synth. The win chime's pitch RISES with the
// streak — the variable-reward audio trick slot machines use: the sound
// itself tells you your streak is getting valuable. Context is created
// lazily on the first user gesture (autoplay policy), mute is persisted.

const MUTE_KEY = 'chartle.muted.v1';
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* fine */ }

function ensure(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number, duration: number, type: OscillatorType = 'sine',
  gain = 0.05, delay = 0,
): void {
  const audio = ensure();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const t0 = audio.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sound = {
  isMuted: (): boolean => muted,
  toggle(): boolean {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* fine */ }
    return muted;
  },
  // reveal heartbeat — one soft tick per future bar
  tick(i: number): void { tone(280 + i * 22, 0.03, 'square', 0.015); },
  // win chime climbs a semitone per streak step (capped two octaves up)
  win(streak: number): void {
    const base = 440 * 2 ** (Math.min(streak, 24) / 12);
    tone(base, 0.09, 'sine', 0.05);
    tone(base * 1.5, 0.12, 'sine', 0.04, 0.07);
  },
  lose(): void {
    tone(160, 0.18, 'sawtooth', 0.06);
    tone(80, 0.35, 'sawtooth', 0.07, 0.1);
  },
  milestone(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.06, i * 0.08));
  },
  cash(): void {
    tone(880, 0.07, 'triangle', 0.06);
    tone(1320, 0.12, 'triangle', 0.05, 0.06);
  },
};

// Seeded RNG — the engine behind challenge links. A share URL carries the
// run's seed, so a rival plays the EXACT same chart sequence: "beat my 12
// on the same charts" with zero backend. mulberry32: tiny, fast, and good
// enough for shuffling charts (not for cryptography, which this is not).

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeedString(): string {
  return Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
}

// Challenge-link seeds arrive from an attacker-influenceable place: the
// ?seed= URL parameter, which is reflected into the DOM (the challenge
// banner) and into the shared rematch URL. Constrain it to the exact
// base36 charset randomSeedString emits, so a crafted seed can never carry
// HTML/markup into innerHTML. Returns null when nothing usable survives,
// which tells the caller to fall back to a fresh random seed.
export function sanitizeSeed(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/[^0-9a-z]/g, '').slice(0, 12);
  return clean.length > 0 ? clean : null;
}

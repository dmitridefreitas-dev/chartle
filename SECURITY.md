# Security

Chartle is a fully static, client-side game. There is **no backend, no
database, no accounts, no authentication, and no secrets** — the entire app
is prebuilt HTML/CSS/JS served from GitHub Pages, plus one static
`dataset.json`. That shape removes most of the usual web attack surface
(there is no server to inject into, no session to steal, no API key to leak,
and the game deals only in play money — nothing is purchasable or payable).

## Threat model & what's done about it

- **Reflected XSS via the `?seed=` challenge link.** Challenge links carry a
  run seed in the URL, and that seed is both reflected into the DOM (the
  challenge banner) and echoed into the shared rematch URL — a shared,
  attacker-influenceable string, so the highest-value target. The seed is
  constrained to the base36 charset it's supposed to be (`sanitizeSeed` in
  `src/core/rng.ts`) *before* it is used anywhere, so a crafted seed such as
  `?seed="><img src=x onerror=…>` is stripped to inert alphanumerics. Covered
  by regression tests in `src/core/viral.test.ts`.
- **Content injection via rendered data.** Every string interpolated into
  `innerHTML` (ticker, company name, era, episode story, guesses) is passed
  through an HTML-escaper (`esc`, `src/ui/escape.ts`). These strings come
  from our own `dataset.json` today, so this is defense-in-depth rather than
  a live hole — but it also fixes correct rendering of names with `&`
  (AT&T, S&P 500) and means any future community- or API-sourced string is
  safe by default. Covered by `src/ui/escape.test.ts`.
- **Untrusted local state.** All persistence is `localStorage` on the
  player's own device (streaks, bankroll, mute/onboarding flags). It is read
  defensively (`JSON.parse` wrapped in try/catch with typed fallbacks), so a
  corrupted or hand-edited value degrades gracefully instead of crashing.
  The only party who can tamper with it is the player, affecting only their
  own scores.
- **Supply chain / CI.** Zero runtime dependencies ship to users. Build/test
  tooling is dev-only and `npm audit` is clean. The GitHub Actions workflow
  runs with least privilege (`contents: read`), and deployment is gated to
  the `main` branch, so pull requests from forks can build but never deploy.

## Reporting

Found something? Open an issue on the repository. Because there is no server
or user data involved, the realistic blast radius of any bug is a single
player's own browser tab.

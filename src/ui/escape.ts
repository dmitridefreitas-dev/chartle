// Every place we build markup with innerHTML and interpolate a *string*
// (ticker, company name, era, or the human-written episode story) runs it
// through esc() first. Those strings come from our own dataset.json today,
// so this is defense-in-depth rather than a live hole — but it also fixes a
// real rendering bug (names like "AT&T" and "S&P 500" contain characters
// HTML would otherwise swallow), and it means the day this app ever renders
// a community- or API-sourced string, it is already safe.
const ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ENTITIES[c]);
}

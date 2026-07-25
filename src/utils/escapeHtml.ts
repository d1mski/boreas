// HTML-escaping for the one place the app builds markup by hand: Leaflet's
// openPopup takes an HTML string, not JSX. Titles come from OSM/Wikipedia,
// which anyone on earth can edit, so they are untrusted input.
//
// Lives here rather than inline in MapCanvas so it can be tested directly —
// rendering Leaflet under jsdom to assert an escape is not worth it.

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/**
 * Escaped URL if it is https, otherwise null. Rejects javascript:, data:, and
 * protocol-relative URLs outright — escaping alone would not make those safe
 * in an href.
 */
export function safeHttpsUrl(url: unknown): string | null {
  return typeof url === 'string' && /^https:\/\//.test(url) ? escapeHtml(url) : null;
}

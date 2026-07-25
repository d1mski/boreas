/**
 * Builds the Umami tracker <script> tag.
 *
 * Extracted from main.tsx so the privacy-critical attributes can be asserted.
 * The app writes the pinned location into the URL as `?lat=…&lon=…`
 * (useUrlState), and Umami's tracker patches history so every pin drop becomes
 * a pageview — which would ship the exact queried coordinates to the analytics
 * host. `data-exclude-search` makes Umami strip the query string before it
 * sends anything.
 *
 * If that attribute ever goes missing, nothing breaks and nothing looks wrong;
 * coordinates just start leaving the browser. Hence the test.
 */
export function createUmamiScript(src: string, websiteId: string): HTMLScriptElement {
  const s = document.createElement('script');
  s.defer = true;
  s.src = src;
  s.dataset.websiteId = websiteId;
  // Non-negotiable: the URL carries the user's pinned coordinates.
  s.dataset.excludeSearch = 'true';
  return s;
}

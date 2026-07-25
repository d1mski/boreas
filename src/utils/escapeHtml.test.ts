import { describe, expect, it } from 'vitest';
import { escapeHtml, safeHttpsUrl } from './escapeHtml';

describe('escapeHtml', () => {
  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('neutralises the attribute-breakout payload', () => {
    // The realistic OSM attack: close the attribute, add an event handler.
    const out = escapeHtml('" onerror="alert(1)');
    expect(out).not.toContain('"');
    expect(out).toBe('&quot; onerror=&quot;alert(1)');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("' onload='x")).toBe('&#39; onload=&#39;x');
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary place names alone', () => {
    expect(escapeHtml('Café Ναυπάκτου — 3rd St.')).toBe('Café Ναυπάκτου — 3rd St.');
  });
});

describe('safeHttpsUrl', () => {
  it('accepts https', () => {
    expect(safeHttpsUrl('https://en.wikipedia.org/?curid=1')).toBe(
      'https://en.wikipedia.org/?curid=1',
    );
  });

  it.each([
    ['javascript:alert(1)', 'javascript'],
    ['data:text/html,<script>alert(1)</script>', 'data'],
    ['http://example.com', 'plain http'],
    ['//evil.com', 'protocol-relative'],
    [' https://evil.com', 'leading-space bypass'],
  ])('rejects %s (%s)', (url) => {
    expect(safeHttpsUrl(url)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeHttpsUrl(undefined)).toBeNull();
    expect(safeHttpsUrl({ toString: () => 'https://ok.com' })).toBeNull();
  });

  it('escapes quotes in an otherwise valid https url', () => {
    expect(safeHttpsUrl('https://x.com/"onmouseover="alert(1)')).toBe(
      'https://x.com/&quot;onmouseover=&quot;alert(1)',
    );
  });
});

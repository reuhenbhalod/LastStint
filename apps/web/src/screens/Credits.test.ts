import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Disclaimer } from '../components/Disclaimer.js';
import { SOURCES } from '../data/credits.js';
import { Credits } from './Credits.js';

const html = renderToStaticMarkup(createElement(Credits));
const text = html
  .replace(/<[^>]+>/g, '')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&amp;/g, '&');

describe('the credits page', () => {
  it('has one h1 and a heading per source', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('>Credits</h1>');
    expect(html.match(/<h3/g)).toHaveLength(SOURCES.length);
  });

  it('credits and links every source', () => {
    for (const s of SOURCES) {
      expect(html).toContain(`href="${s.url}"`);
      expect(text).toContain(s.name);
    }
    expect(text).toContain('Technical University of Munich');
    expect(text).toContain('Ergast');
    expect(text).toContain('Jules Roy');
  });

  it('links each licence, marked rel="license"', () => {
    for (const url of [
      'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      'https://creativecommons.org/licenses/by/4.0/',
    ])
      expect(html).toContain(`href="${url}" rel="license"`);
    expect(text).toContain('CC BY-NC-SA 3.0');
    expect(text).toContain('CC BY-NC-SA 4.0');
    expect(text).toContain('CC BY 4.0');
  });

  it('says the game is non-commercial and shares its race files under the same licence', () => {
    expect(text).toContain('LastStint is non-commercial');
    expect(text).toContain('shared under the same licence');
    expect(text).toContain('Version used: commit 9eaad9c');
    expect(text).toContain('v2026.19.0');
  });

  it('keeps to one column that wraps long words (no sideways scroll on a phone)', () => {
    expect(html).not.toContain('<table');
    expect(html).not.toMatch(/whitespace-nowrap|[\s"](min-)?w-\[\d+px\]/);
    expect(html).toContain('[overflow-wrap:anywhere]');
  });

  it('underlines its links so they don’t rely on colour', () => {
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(SOURCES.length);
    for (const a of links.filter((l) => !l.includes('href="/"'))) expect(a).toContain('underline');
  });
});

describe('the footer', () => {
  it('links the credits next to privacy and terms', () => {
    const footer = renderToStaticMarkup(createElement(Disclaimer));
    const order = ['/privacy', '/terms', '/credits'].map((p) => footer.indexOf(`href="${p}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(footer).toContain('>Credits</a>');
  });
});

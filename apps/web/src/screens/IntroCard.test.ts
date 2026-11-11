import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModePills } from './IntroCard.js';

describe('ModePills', () => {
  it('links to the Gauntlet and then Eras, styled alike', () => {
    const html = renderToStaticMarkup(createElement(ModePills));
    const pills = [...html.matchAll(/<a href="([^"]+)" class="([^"]+)">([^<]+)<\/a>/g)];
    expect(pills.map((m) => [m[1], m[3]])).toEqual([
      ['/gauntlet', 'Gauntlet'],
      ['/eras', 'Eras'],
    ]);
    expect(pills[0]?.[2]).toBe(pills[1]?.[2]);
    expect(pills[0]?.[2]).toContain('rounded-full');
  });
});

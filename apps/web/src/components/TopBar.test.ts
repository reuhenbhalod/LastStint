import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TopBar } from './TopBar.js';

describe('TopBar', () => {
  it('links the four ways to play, in order, and marks the page you are on', () => {
    const html = renderToStaticMarkup(createElement(TopBar, { active: 'eras' }));
    const tabs = [
      ...html.matchAll(/<a href="([^"]+)"(?: aria-current="page")? class="[^"]+">([^<]+)/g),
    ];
    expect(tabs.map((m) => [m[1], m[2]])).toEqual([
      ['/', 'Daily'],
      ['/gauntlet', 'Gauntlet'],
      ['/eras', 'Eras'],
      ['/versus', 'Versus'],
    ]);
    expect(html).toMatch(/href="\/eras" aria-current="page"/);
    expect(html.match(/aria-current/g)?.length).toBe(1);
  });
});

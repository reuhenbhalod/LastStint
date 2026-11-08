import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Eras } from './ErasScreen.js';
import { erasRoute } from './catalog.js';

function render(path: string): string {
  const route = erasRoute(path);
  if (!route) throw new Error(`${path} is not an Eras path`);
  return renderToStaticMarkup(createElement(Eras, { route }));
}

describe('Eras screens', () => {
  it('lists every era on the map, in play order, linking to its detail', () => {
    const html = render('/eras');
    expect(html).toContain('>Eras</h1>');
    const links = [...html.matchAll(/href="\/eras\/(\d+)"/g)].map((m) => Number(m[1]));
    expect(links).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(html).toContain('Ground-effect era');
    expect(html).toContain('1983–1988');
  });

  it("shows an era's name on its detail", () => {
    const html = render('/eras/2');
    expect(html).toContain('Senna vs Prost</h1>');
    expect(html).toContain('1989–1993');
    expect(html).toContain('href="/eras"');
  });

  it('says so for an era that does not exist', () => {
    expect(render('/eras/99')).toContain('No such era');
  });
});

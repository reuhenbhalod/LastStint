import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, routeOf } from './App.js';
import { versusOn } from './features.js';

describe('Versus in the first release', () => {
  it('is on in a dev build and off in a production build unless VITE_VERSUS=1', () => {
    expect(versusOn({ PROD: false })).toBe(true);
    expect(versusOn({ PROD: true })).toBe(false);
    expect(versusOn({ PROD: true, VITE_VERSUS: '1' })).toBe(true);
  });

  it('sends /versus to the home page where it is off', () => {
    expect(routeOf('/versus', true)).toEqual({ page: 'versus' });
    expect(routeOf('/versus/ABCD', false)).toEqual({ page: 'daily' });
  });
});

describe('routeOf', () => {
  it('keeps the daily, Gauntlet, admin and legal routes', () => {
    expect(routeOf('/')).toEqual({ page: 'daily' });
    expect(routeOf('/anything-else')).toEqual({ page: 'daily' });
    expect(routeOf('/gauntlet')).toEqual({ page: 'gauntlet' });
    expect(routeOf('/survivor')).toEqual({ page: 'gauntlet' });
    expect(routeOf('/admin/tickets')).toEqual({ page: 'admin' });
    expect(routeOf('/privacy')).toEqual({ page: 'privacy' });
    expect(routeOf('/terms')).toEqual({ page: 'terms' });
    expect(routeOf('/credits')).toEqual({ page: 'credits' });
    expect(routeOf('/tutorial')).toEqual({ page: 'tutorial' });
    expect(routeOf('/versus')).toEqual({ page: 'versus' });
    expect(routeOf('/versus/ABCD')).toEqual({ page: 'versus' });
  });

  it('routes /eras and /eras/<eraId>', () => {
    expect(routeOf('/eras')).toEqual({ page: 'eras', eras: { kind: 'map' } });
    expect(routeOf('/eras/10')).toMatchObject({
      page: 'eras',
      eras: { kind: 'era', era: { id: 10, playOrder: 1 } },
    });
    expect(routeOf('/eras/12')).toEqual({
      page: 'eras',
      eras: { kind: 'unknown', segment: '12' },
    });
  });

  it('does not take paths that only start like /eras', () => {
    expect(routeOf('/erasmus')).toEqual({ page: 'daily' });
  });
});

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals());
  const at = (pathname: string) => {
    vi.stubGlobal('location', { pathname, search: '' });
    return renderToStaticMarkup(createElement(App));
  };

  it('renders the credits page at /credits', () => {
    expect(at('/credits')).toContain('>Credits</h1>');
  });

  it('renders the era map at /eras', () => {
    expect(at('/eras')).toContain('>Eras</h1>');
  });

  it("renders an era's screen at /eras/<eraId>", () => {
    expect(at('/eras/10')).toContain('Ground-effect era</h1>');
  });
});

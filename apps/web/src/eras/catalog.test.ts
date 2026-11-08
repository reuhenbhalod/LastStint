import { describe, expect, it } from 'vitest';
import { ERAS, eraById, erasRoute } from './catalog.js';

describe('ERAS', () => {
  it('has the ten eras in play order, Era 10 first', () => {
    expect(ERAS.map((e) => e.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(ERAS.map((e) => e.playOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(eraById(10)).toMatchObject({ name: 'Ground-effect era', years: '2022–2025' });
    expect(eraById(1)).toMatchObject({ name: 'Turbo era', years: '1983–1988' });
    expect(eraById(11)).toBeUndefined();
  });
});

describe('erasRoute', () => {
  it('routes /eras to the map', () => {
    expect(erasRoute('/eras')).toEqual({ kind: 'map' });
    expect(erasRoute('/eras/')).toEqual({ kind: 'map' });
  });

  it('routes /eras/<eraId> to that era', () => {
    expect(erasRoute('/eras/10')).toMatchObject({ kind: 'era', era: { id: 10 } });
    expect(erasRoute('/eras/1/')).toMatchObject({ kind: 'era', era: { id: 1 } });
  });

  it('flags an era id that is not an era', () => {
    expect(erasRoute('/eras/11')).toEqual({ kind: 'unknown', segment: '11' });
    expect(erasRoute('/eras/0')).toEqual({ kind: 'unknown', segment: '0' });
    expect(erasRoute('/eras/ten')).toEqual({ kind: 'unknown', segment: 'ten' });
  });

  it('leaves paths that are not Eras paths alone', () => {
    expect(erasRoute('/')).toBeNull();
    expect(erasRoute('/erasmus')).toBeNull();
    expect(erasRoute('/eras/10/races')).toBeNull();
    expect(erasRoute('/gauntlet')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { callWords } from './RunsPage.js';

describe('callWords', () => {
  it('puts call and option ids in words', () => {
    expect(callWords('stay')).toBe('Stay out');
    expect(callWords('box-HARD')).toBe('Box: hards');
    expect(callWords('sc-stop')).toBe('SC stop');
    expect(callWords('vsc-cover')).toBe('VSC cover');
    expect(callWords('restart-stance')).toBe('Restart stance');
  });
});

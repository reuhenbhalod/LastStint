import type { DecisionMoment, Modes } from '@laststint/sim';
import { describe, expect, it } from 'vitest';
import { defaultOption } from './autoStay.js';

const moment = (options: DecisionMoment['options']): DecisionMoment => ({
  id: 'm',
  lap: 20,
  trigger: 'SC',
  target: { kind: 'win' },
  options,
  realOptionId: null,
});
const modes: Modes = { pace: 'standard', fuel: 'normal', battle: 'hold', ers: 'balanced' };

describe('defaultOption (the decision timer runs out)', () => {
  it('stays out when the moment offers it', () => {
    const m = moment([
      { id: 'box', label: 'Box', decisions: [{ lap: 20, kind: 'pit', compound: 'HARD' }] },
      { id: 'stay', label: 'Stay out', decisions: [] },
    ]);
    expect(defaultOption(m, modes)?.id).toBe('stay');
  });

  it('keeps the current mode on a headset moment', () => {
    const m = moment([
      {
        id: 'push',
        label: 'Push',
        decisions: [{ lap: 20, kind: 'mode', key: 'pace', value: 'push' }],
      },
      {
        id: 'standard',
        label: 'Standard pace',
        decisions: [{ lap: 20, kind: 'mode', key: 'pace', value: 'standard' }],
      },
    ]);
    expect(defaultOption(m, modes)?.id).toBe('standard');
    expect(defaultOption(m, { ...modes, pace: 'push' })?.id).toBe('push');
  });

  it('prefers the option with fewer calls when both keep the modes', () => {
    const m = moment([
      {
        id: 'push-attack',
        label: 'Push and attack',
        decisions: [
          { lap: 20, kind: 'mode', key: 'pace', value: 'push' },
          { lap: 20, kind: 'mode', key: 'battle', value: 'attack' },
        ],
      },
      {
        id: 'push',
        label: 'Push',
        decisions: [{ lap: 20, kind: 'mode', key: 'pace', value: 'push' }],
      },
    ]);
    expect(defaultOption(m, { ...modes, pace: 'push', battle: 'attack' })?.id).toBe('push');
  });

  it('takes the fewest changes when no option keeps everything, earlier first on a tie', () => {
    const m = moment([
      {
        id: 'both',
        label: 'Manage and defend',
        decisions: [
          { lap: 20, kind: 'mode', key: 'pace', value: 'manage' },
          { lap: 20, kind: 'mode', key: 'battle', value: 'defend' },
        ],
      },
      {
        id: 'defend',
        label: 'Defend',
        decisions: [{ lap: 20, kind: 'mode', key: 'battle', value: 'defend' }],
      },
      {
        id: 'attack',
        label: 'Attack',
        decisions: [{ lap: 20, kind: 'mode', key: 'battle', value: 'attack' }],
      },
    ]);
    expect(defaultOption(m, modes)?.id).toBe('defend');
  });

  it('counts every call as a change without the car’s modes, and is null with no options', () => {
    const m = moment([
      { id: 'a', label: 'A', decisions: [{ lap: 20, kind: 'mode', key: 'pace', value: 'push' }] },
      {
        id: 'b',
        label: 'B',
        decisions: [{ lap: 20, kind: 'mode', key: 'pace', value: 'standard' }],
      },
    ]);
    expect(defaultOption(m)?.id).toBe('a');
    expect(defaultOption(moment([]))).toBeNull();
  });
});

// How a moment's options are offered: the stop options fold into a "Box" button per timing
// ("Box" this lap, "Box next lap"), and the tyre is picked after it (a second step only when
// there's more than one compound). Options that stop and change something else, and options
// with no stop, are offered as they are. The options themselves, which the server grades,
// are unchanged.

import type { DecisionMoment, MomentOption } from '@boxthislap/sim';

export interface BoxChoice {
  /** 'now' boxes on the moment's lap, 'next' a lap later. */
  key: 'now' | 'next';
  label: string;
  /** The lap the car boxes at the end of. */
  lap: number;
  /** The stop options, one per compound, softest first. */
  tyres: Array<{ option: MomentOption; compound: string }>;
}

export interface Choices {
  /** Options other than a plain stop (stay out, push, defend…), in the moment's order. */
  direct: MomentOption[];
  /** The Box buttons: this lap first, then next lap. */
  boxes: BoxChoice[];
  /** Where the Box buttons sit among the direct options (the stop options' first position). */
  boxIndex: number;
}

const SOFTEST = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

/** The stop an option is, if it's only a stop. */
function plainStop(option: MomentOption): { compound: string; lap: number } | null {
  const [only, ...rest] = option.decisions;
  return only?.kind === 'pit' && rest.length === 0
    ? { compound: only.compound, lap: only.lap }
    : null;
}

export function choicesFor(moment: DecisionMoment): Choices {
  const direct: MomentOption[] = [];
  const groups = new Map<'now' | 'next', BoxChoice>();
  let boxIndex = -1;
  for (const option of moment.options) {
    const stop = plainStop(option);
    if (!stop || stop.lap > moment.lap + 1) {
      direct.push(option);
      continue;
    }
    if (boxIndex < 0) boxIndex = direct.length;
    const key = stop.lap > moment.lap ? 'next' : 'now';
    const group = groups.get(key) ?? {
      key,
      label: key === 'now' ? 'Box' : 'Box next lap',
      lap: stop.lap,
      tyres: [],
    };
    group.tyres.push({ option, compound: stop.compound });
    groups.set(key, group);
  }
  const boxes = (['now', 'next'] as const).flatMap((k) => {
    const g = groups.get(k);
    if (!g) return [];
    g.tyres.sort((a, b) => SOFTEST.indexOf(a.compound) - SOFTEST.indexOf(b.compound));
    return [g];
  });
  return { direct, boxes, boxIndex };
}

const NAME: Record<string, string> = {
  SOFT: 'Softs',
  MEDIUM: 'Mediums',
  HARD: 'Hards',
  INTERMEDIATE: 'Inters',
  WET: 'Wets',
};
export const tyreName = (compound: string) => NAME[compound] ?? compound.toLowerCase();

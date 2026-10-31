// How a moment's options are offered: every stop option folds into one "Box" button, and
// the tyre is picked after it (a second step only when there's more than one compound). The
// options themselves, which the server grades, are unchanged.

import type { DecisionMoment, MomentOption } from '@boxthislap/sim';

export interface BoxChoice {
  /** The stop options, one per compound, softest first. */
  tyres: Array<{ option: MomentOption; compound: string }>;
}

export interface Choices {
  /** Options other than a stop (stay out, push, defend…), in the moment's order. */
  direct: MomentOption[];
  box: BoxChoice | null;
  /** Where "Box" sits among the direct options (the stop options' first position). */
  boxIndex: number;
}

const SOFTEST = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

function stopCompound(option: MomentOption): string | null {
  const pit = option.decisions.find((d) => d.kind === 'pit');
  return pit?.kind === 'pit' ? pit.compound : null;
}

export function choicesFor(moment: DecisionMoment): Choices {
  const direct: MomentOption[] = [];
  const tyres: BoxChoice['tyres'] = [];
  let boxIndex = -1;
  for (const option of moment.options) {
    const compound = stopCompound(option);
    if (compound) {
      if (boxIndex < 0) boxIndex = direct.length;
      tyres.push({ option, compound });
    } else {
      direct.push(option);
    }
  }
  tyres.sort((a, b) => SOFTEST.indexOf(a.compound) - SOFTEST.indexOf(b.compound));
  return { direct, box: tyres.length ? { tyres } : null, boxIndex };
}

const NAME: Record<string, string> = { SOFT: 'Softs', MEDIUM: 'Mediums', HARD: 'Hards' };
export const tyreName = (compound: string) => NAME[compound] ?? compound.toLowerCase();

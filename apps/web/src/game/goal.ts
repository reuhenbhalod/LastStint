// What the player is racing for. Usually to beat the rival, the car that finished ahead; in a
// "defend" race (feedback round 2: the winner was out of reach) the rival is the car that
// finished behind, and the job is to hold your place. Worked out from the real result, so a
// race needs no extra setting.

import type { RaceModel } from '@laststint/sim';
import { surname } from '../data/names.js';

export interface Goal {
  kind: 'beat' | 'defend';
  /** Your real finishing place (0 if not classified). */
  place: number;
  /** "Beat VER" / "Hold P2 from LEC". */
  short: string;
  /** "finish ahead of VER" / "hold P2: stay ahead of LEC". */
  line: string;
}

export function goalOf(model: RaceModel): Goal {
  const order = model.realResult;
  const me = order.indexOf(model.userSide);
  const them = order.indexOf(model.rival);
  const place = me + 1;
  const defend = me >= 0 && them >= 0 && me < them;
  const rival = surname(model.rival);
  return defend
    ? {
        kind: 'defend',
        place,
        short: `Hold P${place} from ${rival}`,
        line: `hold P${place}: stay ahead of ${rival}`,
      }
    : { kind: 'beat', place, short: `Beat ${rival}`, line: `finish ahead of ${rival}` };
}

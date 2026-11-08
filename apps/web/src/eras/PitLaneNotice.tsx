// The pit lane closed under the safety car (2007-08, `rules.pitLaneClosedUnderSC`; eras build
// plan 8.5): as the SC comes out the pit entry shuts until the field is queued behind it, and
// a car that stops anyway serves a ten-second stop-go. Shown over the pit stop buttons, with
// what the stop-go costs.

import { STOP_GO_SECONDS } from '@laststint/sim';

export function PitLaneNotice({ cost }: { cost: number }) {
  return (
    <p
      role="alert"
      className="m-0 rounded-md border border-[var(--box)] px-2 py-1 text-[12px] font-semibold leading-snug"
    >
      Pit lane closed: the safety car is out. Box now and it’s a {STOP_GO_SECONDS}-second stop-go,
      about +{Math.round(cost)}s.
    </p>
  );
}

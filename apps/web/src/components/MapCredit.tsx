// The OpenStreetMap credit on a map that shows a circuit's real ground (track/ground.ts): the
// ground is drawn from OpenStreetMap data, whose licence (ODbL) asks for the credit beside the
// map. Nothing for a race with no ground image.

import { groundFor } from '../track/ground.js';

export function MapCredit({ raceId, className = '' }: { raceId: string; className?: string }) {
  if (!groundFor(raceId)) return null;
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      className={`pointer-events-auto rounded bg-black/35 px-1.5 py-0.5 text-[10px] leading-none text-white/70 hover:text-white ${className}`}
    >
      © OpenStreetMap contributors
    </a>
  );
}

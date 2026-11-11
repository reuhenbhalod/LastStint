// What the track map hands any other view of the race each frame (the 3D view: docs/3d-spec.md):
// where every car is (the map's motion is the one source of that), and what's going on.

import type { CarPlace } from './motion.js';

export interface MapFeed {
  places: Map<string, CarPlace>;
  team: Map<string, string>;
  compound: Map<string, string>;
  userSide: string;
  rival: string;
  /** The safety car's place round the lap, while it's out. */
  sc: number | null;
  /** A battle the camera should show. */
  battle: { codes: string[]; at: number } | null;
  /** The car whose card is open. */
  selected: string | null;
  /** Versus: each player's car shape (bullet, glider...). */
  shapes: Record<string, string> | null;
}

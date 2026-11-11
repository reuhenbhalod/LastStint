// The race's era presentation for the components deep in the race screen (tyre badges, the
// call cards), so the timing tower and the driver cards don't need a new prop. RaceScreen
// provides it from the model (raceRules.ts); the default is today's screen: compound badges
// and team radio, as for every race without `rules` or `eras`.

import { createContext, useContext } from 'react';
import type { RaceScreenEra } from './raceRules.js';

export type RaceEraLook = Pick<RaceScreenEra, 'tyres' | 'lockedTyre' | 'prompts'>;

export const TODAY_LOOK: RaceEraLook = { tyres: 'compounds', lockedTyre: null, prompts: 'radio' };

export const RaceEraContext = createContext<RaceEraLook>(TODAY_LOOK);

export const useRaceEra = (): RaceEraLook => useContext(RaceEraContext);

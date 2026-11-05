// Drivers by name (Nov 5 feedback): the track map and the standings use the three-letter codes
// (as the broadcast does); everywhere else the game says the driver's surname: "Verstappen is
// 1.2 s behind", not "VER is 1.2 s behind". The game's logic and data keep the codes; this
// turns them into names where text is shown.

import { driverInfo } from './drivers.js';

/** A driver's surname ("Verstappen"), or the code if the driver isn't known. */
export function surname(code: string): string {
  return driverInfo(code)?.name.split(' ').at(-1) ?? code;
}

/** `text` with every driver code in it (a whole word in capitals) said as the surname. */
export function named(text: string): string {
  return text.replace(/\b[A-Z]{3}\b/g, (code) => (driverInfo(code) ? surname(code) : code));
}

/** The same, in capitals (for the map's banners: "PAST HAMILTON!"). */
export function namedUpper(text: string): string {
  return text.replace(/\b[A-Z]{3}\b/g, (code) =>
    driverInfo(code) ? surname(code).toUpperCase() : code,
  );
}

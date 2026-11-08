// The decision timer's accessibility setting (eras spec §7): on by default; turning it off
// lets every call wait for you, and marks the attempts played that way "untimed" (see
// untimed.ts). Remembered in this browser like the radio sound (game/sound.ts); storage
// being unavailable (private mode) means the choice lasts this page only.

const KEY = 'pitwall.decisionTimer';

/** Whether decisions are timed. On unless this viewer turned it off. */
export function timerOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setTimerOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // private mode: the choice lasts this page only
  }
}

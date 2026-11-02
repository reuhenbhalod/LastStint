// The radio chirp when the race stops for a call (feedback spec S2). Off by default; the
// choice is remembered in this browser. Web Audio, so there's no file to load, and browsers
// only allow it after the player has clicked something (they have: Start).

const KEY = 'pitwall.sound';

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // private mode: the choice lasts this page only
  }
}

let ctx: AudioContext | null = null;

/** Two short beeps, like a radio channel opening. */
export function radioChirp(): void {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = t0 + i * 0.13;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    }
  } catch {
    // no audio: the visual alert still shows
  }
}

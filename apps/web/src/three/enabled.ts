// The 3D race view (docs/3d-spec.md): on or off, and for whom.
//
// THE SWITCH: set SCENE_3D to false and the game is back to the 2D track map alone (with the
// main cars' icons), everywhere. Nothing else needs to change.
export const SCENE_3D = true;

/** Computers only: a wide screen, a mouse or trackpad. Phones and tablets keep the 2D map. */
export const DESKTOP = '(min-width: 900px) and (hover: hover) and (pointer: fine)';

import { useEffect, useState } from 'react';
import { circuitFor } from './scenery.js';

/** The 3D view shows for this race: switched on, a computer, a circuit with scenery, and a
 * browser that draws WebGL. Automated browsers (the e2e tests) keep the 2D map unless the URL
 * asks for 3D (?view=3d). */
export function use3D(raceId: string | null | undefined): boolean {
  const [desktop, setDesktop] = useState(() => matches());
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const q = matchMedia(DESKTOP);
    const on = () => setDesktop(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  if (!SCENE_3D || !raceId || !circuitFor(raceId)) return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver && !forced()) return false;
  return (desktop || forced()) && webgl();
}

function matches(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia(DESKTOP).matches;
}

function forced(): boolean {
  return (
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('view') === '3d'
  );
}

let gl: boolean | null = null;
function webgl(): boolean {
  if (gl === null) {
    try {
      const c = document.createElement('canvas');
      gl = !!c.getContext('webgl2');
    } catch {
      gl = false;
    }
  }
  return gl;
}

/** Which view the player last chose as the main one (kept per browser). */
const VIEW_KEY = 'laststint:view';
export function savedView(): '3d' | '2d' {
  try {
    return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}
export function saveView(v: '3d' | '2d'): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // private mode: the choice lasts this visit
  }
}

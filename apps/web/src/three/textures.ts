// Textures for the 3D view, drawn in code (no image files): ground detail, tarmac, building
// windows, catch fencing and trackside boards. Tileable where they repeat.

import * as THREE from 'three';

let seed = 7;
export function reseed(s: number): void {
  seed = s;
}
export function rnd(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

/** Tileable fractal value noise, 0..1, `size` square. */
export function tileNoise(size: number, base: number, octaves: number, s: number): Float32Array {
  let sd = s;
  const r = () => {
    sd = (sd * 16807) % 2147483647;
    return sd / 2147483647;
  };
  const out = new Float32Array(size * size);
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const P = base << o;
    const amp = 0.5 ** o;
    const lat = new Float32Array(P * P);
    for (let k = 0; k < lat.length; k++) lat[k] = r();
    norm += amp;
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * P;
      const j = Math.floor(fy);
      const v = fy - j;
      const sv = v * v * (3 - 2 * v);
      const j1 = (j + 1) % P;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * P;
        const i = Math.floor(fx);
        const u = fx - i;
        const su = u * u * (3 - 2 * u);
        const i1 = (i + 1) % P;
        const a = lat[j * P + i] as number;
        const b = lat[j * P + i1] as number;
        const c = lat[j1 * P + i] as number;
        const d = lat[j1 * P + i1] as number;
        out[y * size + x] =
          (out[y * size + x] as number) +
          amp * ((a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv);
      }
    }
  }
  for (let k = 0; k < out.length; k++) out[k] = (out[k] as number) / norm;
  return out;
}

export function canvasOf(
  size: number,
  fn: (x: number, y: number, k: number) => [number, number, number, number?],
  height = size,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const img = g.createImageData(size, height);
  for (let k = 0; k < size * height; k++) {
    const [r, gg, b, a] = fn(k % size, Math.floor(k / size), k);
    img.data[k * 4] = r;
    img.data[k * 4 + 1] = gg;
    img.data[k * 4 + 2] = b;
    img.data[k * 4 + 3] = a ?? 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A tangent-space normal map from a tileable height field. */
export function normalMap(h: Float32Array, size: number, strength: number): THREE.CanvasTexture {
  const at = (x: number, y: number) =>
    h[((y + size) % size) * size + ((x + size) % size)] as number;
  const c = canvasOf(size, (x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [
      ((-dx / l) * 0.5 + 0.5) * 255,
      ((-dy / l) * 0.5 + 0.5) * 255,
      ((1 / l) * 0.5 + 0.5) * 255,
    ];
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tiled(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Ground detail: a grey multiplier (blades, clumps, soil) and its normal map. */
export function groundDetail(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const fine = tileNoise(512, 32, 4, 3);
  const clumps = tileNoise(512, 8, 3, 5);
  const h = new Float32Array(512 * 512);
  for (let k = 0; k < h.length; k++) h[k] = (fine[k] as number) * 0.7 + (clumps[k] as number) * 0.3;
  const albedo = tiled(
    canvasOf(512, (_x, _y, k) => {
      const v = 120 + (fine[k] as number) * 90 + (clumps[k] as number) * 45;
      return [v, v, v];
    }),
    false,
  );
  return { albedo, normal: normalMap(h, 512, 6) };
}

/** The track's tarmac, across (u: edge to edge) and along (v): aggregate, a rubbered racing
 * line, white edge lines. */
export function tarmac(): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
} {
  const S = 512;
  const grit = tileNoise(S, 128, 3, 9);
  const blotch = tileNoise(S, 4, 3, 13);
  const map = tiled(
    canvasOf(S, (x, _y, k) => {
      const across = x / (S - 1);
      const n = (grit[k] as number) * 30 + (blotch[k] as number) * 14;
      let v = 52 + n;
      const line = Math.abs(across - 0.5);
      if (line < 0.2) v -= 14 * (1 - line / 0.2) ** 1.5;
      if (across < 0.028 || across > 0.972) v = 214 + (grit[k] as number) * 22;
      return [v, v, v + 3];
    }),
    true,
  );
  const rough = tiled(
    canvasOf(S, (x, _y, k) => {
      const across = x / (S - 1);
      const line = Math.abs(across - 0.5);
      let v = 210 + (grit[k] as number) * 40;
      if (line < 0.2) v -= 50 * (1 - line / 0.2);
      return [v, v, v];
    }),
    false,
  );
  return { map, normal: normalMap(grit, S, 3), rough };
}

/** Walls: rows of windows on render, tiling 7 m by 9.5 m. */
export function windows(): THREE.CanvasTexture {
  return tiled(
    canvasOf(256, (x, y) => {
      const wx = x % 64;
      const wy = y % 84;
      const win = wx > 12 && wx < 52 && wy > 18 && wy < 62;
      const n = ((x * 7 + y * 13) % 17) / 17;
      return win
        ? [58 + n * 12, 70 + n * 12, 84 + n * 14]
        : [206 + n * 8, 201 + n * 8, 190 + n * 8];
    }),
    true,
  );
}

/** Chain-link catch fence (alpha). */
export function fence(): THREE.CanvasTexture {
  const t = tiled(
    canvasOf(64, (x, y) => {
      const a = (x + y) % 16 < 2 || (x - y + 64) % 16 < 2 ? 255 : 0;
      const post = x < 3 ? 255 : 0;
      return [150, 156, 160, Math.max(a, post)];
    }),
    true,
  );
  return t;
}

/** Trackside boards: our own made-up names, never real brands. */
const BOARDS: Array<[string, string, string]> = [
  ['LASTSTINT', '#19c7b4', '#0d1110'],
  ['BOX BOX', '#f5c518', '#141716'],
  ['PIT WALL', '#ffffff', '#d4432f'],
  ['UNDERCUT', '#0d1110', '#f2a13a'],
  ['TYRE TALK', '#ffffff', '#1d3557'],
  ['DRS', '#141716', '#e9ece9'],
];
export function boards(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64 * BOARDS.length;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  BOARDS.forEach(([text, fg, bg], k) => {
    g.fillStyle = bg;
    g.fillRect(0, k * 64, 1024, 64);
    g.fillStyle = fg;
    g.font = '900 44px Archivo, Arial, sans-serif';
    g.textBaseline = 'middle';
    for (let x = 30; x < 1024; x += 340) g.fillText(text, x, k * 64 + 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
export const BOARD_ROWS = BOARDS.length;

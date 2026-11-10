// The circuit in 3D (docs/3d-spec.md): built from its scenery file (data/scenery) in the
// browser. The ground with its land cover, the track with kerbs, lines and the grid, the pit
// lane and wall, barriers, catch fencing and boards, buildings and grandstands with crowds,
// trees (spruce, broadleaf or palm by region), landmarks, and the sky and light for the
// circuit's time of day. Everything stands where it really is; only the trackside furniture
// (barriers, fences, boards, floodlights) is placed by rule, as no open map has it.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Scenery, heights } from './scenery.js';
import {
  BOARD_ROWS,
  boards,
  canvasOf,
  fence,
  groundDetail,
  reseed,
  rnd,
  tarmac,
  tileNoise,
  windows,
} from './textures.js';

const n = (a: ArrayLike<number>, i: number) => a[i] as number;
const W = 12.5; // track width (m)

/** The light for each time of day: the sun's height and bearing (degrees), the sky, the haze. */
const LIGHT = {
  afternoon: {
    elev: 40,
    azim: 220,
    turbidity: 3.5,
    rayleigh: 1.1,
    mie: 0.004,
    sun: 3.4,
    hemi: 1.1,
    haze: 0xc6d4df,
    exposure: 0.62,
    floodlights: false,
  },
  overcast: {
    elev: 34,
    azim: 205,
    turbidity: 9,
    rayleigh: 2.2,
    mie: 0.01,
    sun: 2.0,
    hemi: 1.6,
    haze: 0xbac4cb,
    exposure: 0.66,
    floodlights: false,
  },
  dusk: {
    elev: 4.5,
    azim: 255,
    turbidity: 6,
    rayleigh: 2.6,
    mie: 0.006,
    sun: 2.6,
    hemi: 0.7,
    haze: 0xcf9f7c,
    exposure: 0.7,
    floodlights: true,
  },
  summer: {
    elev: 54,
    azim: 195,
    turbidity: 2.8,
    rayleigh: 1,
    mie: 0.003,
    sun: 3.8,
    hemi: 1.0,
    haze: 0xd0dbe2,
    exposure: 0.58,
    floodlights: false,
  },
} as const;

/** Land cover colours by region. */
const GROUND = {
  park: {
    base: '#485d2f',
    grass: '#506639',
    farm: '#6f7444',
    forest: '#29331f',
    scrub: '#465531',
    urban: '#7a7b72',
    sand: '#c4b088',
    gravel: '#b5a37c',
    asphalt: '#5a5d59',
    water: '#3c5f73',
    verge: '#57703c',
    outer: ['#46592e', '#26301d'],
  },
  forest: {
    base: '#465c2e',
    grass: '#4e6538',
    farm: '#6b7243',
    forest: '#262f1d',
    scrub: '#43532f',
    urban: '#787970',
    sand: '#c4b088',
    gravel: '#b5a37c',
    asphalt: '#5a5d59',
    water: '#3c5f73',
    verge: '#556e3b',
    outer: ['#43572c', '#232c1b'],
  },
  desert: {
    base: '#c2a578',
    grass: '#6f8240',
    farm: '#8f8a52',
    forest: '#55633a',
    scrub: '#9d8e62',
    urban: '#a69f8f',
    sand: '#cfb487',
    gravel: '#b8a27a',
    asphalt: '#5e5f5b',
    water: '#45708a',
    verge: '#7b8a48',
    outer: ['#c4a87b', '#b89c70'],
  },
  dry: {
    base: '#77764a',
    grass: '#6f7444',
    farm: '#9b9060',
    forest: '#323d28',
    scrub: '#666a3e',
    urban: '#8a887d',
    sand: '#c4b088',
    gravel: '#b5a37c',
    asphalt: '#5a5d59',
    water: '#3c5f73',
    verge: '#737a47',
    outer: ['#7c7a4d', '#35402a'],
  },
} as const;

export interface World {
  scene: THREE.Scene;
  sky: Sky;
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
  exposure: number;
  floodlit: boolean;
  /** Ground height (m, scene units) at a point. */
  heightAt: (x: number, z: number) => number;
  /** A point on the lap (fractional index): position and direction. */
  lapAt: (f: number) => { x: number; y: number; z: number; tx: number; tz: number };
  lapCount: number;
  centre: THREE.Vector3;
  radius: number;
  /** Fixed TV camera spots round the lap. */
  tv: THREE.Vector3[];
  dispose: () => void;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function buildWorld(s: Scenery, maxAniso: number): Promise<World> {
  reseed(11);
  const L = LIGHT[s.light];
  const C = GROUND[s.ground];
  const [SX, SZ] = s.size;
  const G = s.grid;
  const H = heights(s);
  const hAt = (x: number, z: number) => {
    const fx = Math.min(Math.max(x / G.step, 0), G.nx - 1.001);
    const fz = Math.min(Math.max(z / G.step, 0), G.nz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = j * G.nx + i;
    return (
      n(H, a) * (1 - u) * (1 - v) +
      n(H, a + 1) * u * (1 - v) +
      n(H, a + G.nx) * (1 - u) * v +
      n(H, a + G.nx + 1) * u * v
    );
  };
  const scene = new THREE.Scene();
  const disposables: Array<{ dispose: () => void }> = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // ---- the lap
  const P = s.lap.pts;
  const N = P.length;
  const LX = new Float64Array(N);
  const LZ = new Float64Array(N);
  const LY = new Float64Array(N);
  P.forEach(([x, z], i) => {
    LX[i] = x;
    LZ[i] = z;
    LY[i] = n(s.lap.y, i) - G.min + 0.06;
  });
  const TX = new Float64Array(N);
  const TZ = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 2 + N) % N;
    const b = (i + 2) % N;
    const dx = n(LX, b) - n(LX, a);
    const dz = n(LZ, b) - n(LZ, a);
    const l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l;
    TZ[i] = dz / l;
  }
  // normal (to the right of travel, in x/z with z south): (-tz, tx)
  const NX = (i: number) => -n(TZ, i);
  const NZ = (i: number) => n(TX, i);
  const TURN = new Float64Array(N);
  const SIDE = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 7 + N) % N;
    const b = (i + 7) % N;
    const dot = n(TX, a) * n(TX, b) + n(TZ, a) * n(TZ, b);
    TURN[i] = Math.acos(Math.max(-1, Math.min(1, dot)));
    SIDE[i] = Math.sign(n(TX, a) * n(TZ, b) - n(TZ, a) * n(TX, b));
  }
  const DIST = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    DIST[i + 1] = n(DIST, i) + Math.hypot(n(LX, j) - n(LX, i), n(LZ, j) - n(LZ, i));
  }
  const lapAt = (f: number) => {
    const ff = ((f % N) + N) % N;
    const i = Math.floor(ff);
    const j = (i + 1) % N;
    const u = ff - i;
    const tx = n(TX, i) * (1 - u) + n(TX, j) * u;
    const tz = n(TZ, i) * (1 - u) + n(TZ, j) * u;
    const l = Math.hypot(tx, tz) || 1;
    return {
      x: n(LX, i) * (1 - u) + n(LX, j) * u,
      y: n(LY, i) * (1 - u) + n(LY, j) * u,
      z: n(LZ, i) * (1 - u) + n(LZ, j) * u,
      tx: tx / l,
      tz: tz / l,
    };
  };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, n(LX, i));
    maxX = Math.max(maxX, n(LX, i));
    minZ = Math.min(minZ, n(LZ, i));
    maxZ = Math.max(maxZ, n(LZ, i));
  }
  const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  centre.y = hAt(centre.x, centre.z);
  const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2;

  // Spatial lookup of the lap (and pit lane) so placed things keep clear of them.
  const CELL = 40;
  const cells = new Map<string, Array<[number, number, number]>>();
  const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  const addPt = (x: number, z: number, tag: number) => {
    const k = key(x, z);
    let c = cells.get(k);
    if (!c) {
      c = [];
      cells.set(k, c);
    }
    c.push([x, z, tag]);
  };
  for (let i = 0; i < N; i++) addPt(n(LX, i), n(LZ, i), i);
  const pitLine = s.pit ?? s.races[Object.keys(s.races)[0] as string]?.pit ?? null;
  if (pitLine) for (const [x, z] of densify(pitLine, 3)) addPt(x, z, -1);
  /** Nothing of the track or pit lane within r (ignoring the lap near point `me`). */
  const clearOf = (x: number, z: number, me: number, r: number) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const reach = Math.ceil(r / CELL);
    for (let a = -reach; a <= reach; a++)
      for (let b = -reach; b <= reach; b++)
        for (const [px, pz, tag] of cells.get(`${cx + a},${cz + b}`) ?? []) {
          if (me >= 0 && tag >= 0 && Math.abs(((tag - me + N + N / 2) % N) - N / 2) < 14) continue;
          if ((px - x) ** 2 + (pz - z) ** 2 < r * r) return false;
        }
    return true;
  };
  /** Distance to the nearest lap point (within 120 m; else 120). */
  const trackDist = (x: number, z: number) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = 120 * 120;
    for (let a = -3; a <= 3; a++)
      for (let b = -3; b <= 3; b++)
        for (const [px, pz, tag] of cells.get(`${cx + a},${cz + b}`) ?? []) {
          if (tag < 0) continue;
          best = Math.min(best, (px - x) ** 2 + (pz - z) ** 2);
        }
    return Math.sqrt(best);
  };

  // ---- sky, light, haze
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - L.elev),
    THREE.MathUtils.degToRad(L.azim),
  );
  const sky = new Sky();
  sky.scale.setScalar(45000);
  const su = sky.material.uniforms;
  (su.turbidity as THREE.IUniform).value = L.turbidity;
  (su.rayleigh as THREE.IUniform).value = L.rayleigh;
  (su.mieCoefficient as THREE.IUniform).value = L.mie;
  (su.mieDirectionalG as THREE.IUniform).value = 0.82;
  (su.sunPosition as THREE.IUniform).value.copy(sunDir);
  scene.add(sky);
  scene.fog = new THREE.FogExp2(L.haze, 0.115 / radius);
  const hemi = new THREE.HemisphereLight(0xdfe9f4, 0x5a5f45, L.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(s.light === 'dusk' ? 0xffb780 : 0xfff0dc, L.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  await tick();

  // ---- ground: land cover painted from the map, fine detail on top
  const PX = Math.min(4096 / SX, 4096 / SZ, 2);
  const cover = document.createElement('canvas');
  cover.width = Math.round(SX * PX);
  cover.height = Math.round(SZ * PX);
  const g = cover.getContext('2d') as CanvasRenderingContext2D;
  g.scale(PX, PX);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const ring = (ctx: CanvasRenderingContext2D, r: Array<[number, number]>, closed: boolean) => {
    ctx.beginPath();
    r.forEach(([x, z], k) => (k ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    if (closed) ctx.closePath();
  };
  const lapRing: Array<[number, number]> = P;
  g.fillStyle = C.base;
  g.fillRect(0, 0, SX, SZ);
  const fill = (kind: string, color: string) => {
    g.fillStyle = color;
    for (const r of s.areas[kind] ?? []) {
      ring(g, r, true);
      g.fill();
    }
  };
  fill('farm', C.farm);
  fill('grass', C.grass);
  fill('scrub', C.scrub);
  fill('urban', C.urban);
  fill('sand', C.sand);
  fill('forest', C.forest);
  fill('water', C.water);
  fill('asphalt', C.asphalt);
  // mown verges and the asphalt run-off either side of the track
  g.globalAlpha = 0.7;
  ring(g, lapRing, true);
  g.strokeStyle = C.verge;
  g.lineWidth = 64;
  g.stroke();
  g.globalAlpha = 1;
  ring(g, lapRing, true);
  g.strokeStyle = '#6c6f69';
  g.lineWidth = W + 9;
  g.stroke();
  fill('gravel', C.gravel);
  for (const st of s.streams) {
    g.strokeStyle = C.water;
    g.lineWidth = st.w;
    ring(g, st.p, false);
    g.stroke();
  }
  for (const r of s.roads) {
    g.strokeStyle = '#55585a';
    g.lineWidth = r.w;
    ring(g, r.p, false);
    g.stroke();
  }
  for (const r of s.rails) {
    g.strokeStyle = '#5b5248';
    g.lineWidth = 4;
    ring(g, r, false);
    g.stroke();
  }
  if (pitLine) {
    ring(g, pitLine, false);
    g.strokeStyle = '#5d605c';
    g.lineWidth = 22;
    g.stroke();
  }
  g.fillStyle = '#5f615c';
  for (const b of s.buildings) {
    ring(g, b.p, true);
    g.lineWidth = 5;
    g.strokeStyle = '#5f615c';
    g.fill();
    g.stroke();
  }
  // large-scale variation, so open ground isn't one flat colour
  const big = tileNoise(256, 6, 4, 21);
  const bigC = canvasOf(256, (_x, _y, k) => {
    const v = n(big, k) * 255;
    return [v, v, v];
  });
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = 0.3;
  g.drawImage(bigC, 0, 0, SX, SZ);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const coverTex = keep(new THREE.CanvasTexture(cover));
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.anisotropy = maxAniso;
  coverTex.flipY = false;

  const detail = groundDetail();
  keep(detail.albedo);
  keep(detail.normal);
  const groundMat = keep(
    new THREE.MeshStandardMaterial({
      map: coverTex,
      normalMap: detail.normal,
      roughness: 1,
      metalness: 0,
    }),
  );
  detail.normal.repeat.set(SX / 5, SZ / 5);
  groundMat.normalScale.set(0.9, 0.9);
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail.albedo };
    sh.uniforms.detailRepeat = { value: new THREE.Vector2(SX / 5, SZ / 5) };
    sh.fragmentShader = `uniform sampler2D detailMap; uniform vec2 detailRepeat;\n${sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float d1 = texture2D(detailMap, vMapUv * detailRepeat).r;
      float d2 = texture2D(detailMap, vMapUv * detailRepeat * 0.11).r;
      diffuseColor.rgb *= mix(0.74, 1.18, d1) * mix(0.86, 1.1, d2);`,
    )}`;
  };
  {
    const pos = new Float32Array(G.nx * G.nz * 3);
    const uv = new Float32Array(G.nx * G.nz * 2);
    for (let j = 0; j < G.nz; j++)
      for (let i = 0; i < G.nx; i++) {
        const k = j * G.nx + i;
        pos[k * 3] = i * G.step;
        pos[k * 3 + 1] = n(H, k);
        pos[k * 3 + 2] = j * G.step;
        uv[k * 2] = (i * G.step) / SX;
        uv[k * 2 + 1] = (j * G.step) / SZ;
      }
    const idx: number[] = [];
    for (let j = 0; j < G.nz - 1; j++)
      for (let i = 0; i < G.nx - 1; i++) {
        const a = j * G.nx + i;
        idx.push(a, a + G.nx, a + 1, a + 1, a + G.nx, a + G.nx + 1);
      }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, groundMat);
    m.receiveShadow = true;
    scene.add(m);
  }
  // The land carries on past the scenery: its edge heights rolling on, coloured by region.
  const OUT = 9000;
  const OS = 90;
  const forestN = tileNoise(256, 5, 4, 33);
  const forestAt = (x: number, z: number) => {
    const u = (((x / 3000) % 1) + 1) % 1;
    const v = (((z / 3000) % 1) + 1) % 1;
    return n(forestN, Math.floor(v * 255) * 256 + Math.floor(u * 255));
  };
  const rollAt = (x: number, z: number) => {
    const dx = Math.max(0, -x, x - SX);
    const dz = Math.max(0, -z, z - SZ);
    const d = Math.hypot(dx, dz);
    const amp = s.ground === 'desert' ? 6 : s.ground === 'forest' ? 60 : 22;
    return (
      hAt(x, z) +
      (amp * Math.sin(x / 900) * Math.cos(z / 1100) + amp * 0.6 * Math.sin((x + z) / 600)) *
        Math.min(1, d / 1500)
    );
  };
  {
    const cx = Math.round((SX + 2 * OUT) / OS);
    const cz = Math.round((SZ + 2 * OUT) / OS);
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const cA = new THREE.Color(C.outer[0]);
    const cB = new THREE.Color(C.outer[1]);
    const base = new THREE.Color(C.base);
    const c = new THREE.Color();
    for (let j = 0; j <= cz; j++)
      for (let i = 0; i <= cx; i++) {
        const x = -OUT + i * OS;
        const z = -OUT + j * OS;
        const inside = x > 40 && x < SX - 40 && z > 40 && z < SZ - 40;
        pos.push(x, inside ? hAt(x, z) - 14 : rollAt(x, z), z);
        const edge = Math.min(
          1,
          Math.hypot(Math.max(0, -x, x - SX), Math.max(0, -z, z - SZ)) / 900,
        );
        c.copy(forestAt(x, z) > 0.5 ? cB : cA)
          .lerp(base, 1 - edge)
          .multiplyScalar(0.88 + rnd() * 0.18);
        col.push(c.r, c.g, c.b);
      }
    for (let j = 0; j < cz; j++)
      for (let i = 0; i < cx; i++) {
        const a = j * (cx + 1) + i;
        idx.push(a, a + cx + 1, a + 1, a + 1, a + cx + 1, a + cx + 2);
      }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })),
    );
    m.receiveShadow = true;
    scene.add(m);
  }

  await tick();

  // ---- the track
  const tex = tarmac();
  for (const t of [tex.map, tex.normal, tex.rough]) {
    keep(t);
    t.anisotropy = maxAniso;
  }
  const offset = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  const trackMat = keep(
    new THREE.MeshStandardMaterial({
      map: tex.map,
      normalMap: tex.normal,
      roughnessMap: tex.rough,
      roughness: 1,
      ...offset,
    }),
  );
  const ribbon = (
    a: number,
    b: number,
    mat: THREE.Material,
    opts: {
      filter?: (i: number) => boolean;
      color?: (i: number) => number;
      lift?: number;
      vScale?: number;
    } = {},
  ) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const vs = opts.vScale ?? 30;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (opts.filter && !opts.filter(i)) continue;
      const q = (k: number, o: number): [number, number, number] => [
        n(LX, k) + NX(k) * o,
        n(LY, k) + (opts.lift ?? 0) - 0.06,
        n(LZ, k) + NZ(k) * o,
      ];
      const A = q(i, a);
      const B = q(i, b);
      const Cc = q(j, a);
      const D = q(j, b);
      pos.push(...A, ...Cc, ...B, ...B, ...Cc, ...D);
      const v0 = n(DIST, i) / vs;
      const v1 = n(DIST, i + 1) / vs;
      uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
      c.set(opts.color ? opts.color(i) : 0xffffff);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  };
  scene.add(ribbon(-W / 2, W / 2, trackMat));
  // kerbs: red and white, raised a little, on both sides through the corners
  const kerbMat = keep(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, ...offset }),
  );
  const kerbOn = (i: number) => n(TURN, i) > 0.09;
  const kerbCol = (i: number) => (Math.floor(n(DIST, i) / 2.5) % 2 ? 0xc22a22 : 0xeeeeea);
  scene.add(ribbon(W / 2, W / 2 + 1.5, kerbMat, { filter: kerbOn, color: kerbCol, lift: 0.07 }));
  scene.add(ribbon(-W / 2 - 1.5, -W / 2, kerbMat, { filter: kerbOn, color: kerbCol, lift: 0.07 }));
  // bridges: where the deck spans the road beneath (the ground well below it), a concrete
  // deck with its underside and parapets; the approaches are embankments in the ground itself
  if (s.lap.bridge.length) {
    const concrete = keep(
      new THREE.MeshStandardMaterial({ color: 0xa3a19b, roughness: 0.85, side: THREE.DoubleSide }),
    );
    const span = new Set(s.lap.bridge.filter((i) => hAt(n(LX, i), n(LZ, i)) < n(LY, i) - 2.5));
    const pos: number[] = [];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (!span.has(i) || !span.has(j)) continue;
      for (const sd of [-1, 1]) {
        const o = sd * (W / 2 + 0.5);
        const x1 = n(LX, i) + NX(i) * o;
        const z1 = n(LZ, i) + NZ(i) * o;
        const x2 = n(LX, j) + NX(j) * o;
        const z2 = n(LZ, j) + NZ(j) * o;
        const top1 = n(LY, i) + 1.0;
        const top2 = n(LY, j) + 1.0;
        const bot1 = n(LY, i) - 1.5;
        const bot2 = n(LY, j) - 1.5;
        pos.push(
          x1,
          bot1,
          z1,
          x2,
          bot2,
          z2,
          x1,
          top1,
          z1,
          x1,
          top1,
          z1,
          x2,
          bot2,
          z2,
          x2,
          top2,
          z2,
        );
      }
    }
    if (pos.length) {
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, concrete);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      scene.add(
        ribbon(-W / 2 - 0.5, W / 2 + 0.5, concrete, {
          filter: (i) => span.has(i) && span.has((i + 1) % N),
          lift: -1.5,
        }),
      );
    }
  }
  // start line and grid boxes: the game's lap starts at its line
  {
    const race = s.races[Object.keys(s.races)[0] as string];
    const start = race ? Math.round((((n(race.frac, 0) % 1) + 1) % 1) * N) % N : 0;
    const white = keep(
      new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.6, ...offset }),
    );
    const mark = (i: number, o: number, len: number, wid: number) => {
      const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, wid)), white);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(n(TZ, i), n(TX, i));
      m.position.set(n(LX, i) + NX(i) * o, n(LY, i) + 0.02, n(LZ, i) + NZ(i) * o);
      m.receiveShadow = true;
      scene.add(m);
    };
    mark(start, 0, 1.0, W - 0.5);
    for (let k = 1; k <= 20; k++) {
      const i = (start - Math.round((k * 8) / 3) - 2 + N) % N;
      mark(i, k % 2 ? -2.6 : 2.6, 0.35, 3.0);
    }
  }

  // ---- pit lane and pit wall
  if (pitLine) {
    const pts = densify(pitLine, 3);
    const pos: number[] = [];
    const uv: number[] = [];
    let d = 0;
    const wall: number[] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x1, z1] = pts[k] as [number, number];
      const [x2, z2] = pts[k + 1] as [number, number];
      const len = Math.hypot(x2 - x1, z2 - z1) || 1;
      const nx = (-(z2 - z1) / len) * 6;
      const nz = ((x2 - x1) / len) * 6;
      const y1 = hAt(x1, z1) + 0.22;
      const y2 = hAt(x2, z2) + 0.22;
      pos.push(
        x1 - nx,
        y1,
        z1 - nz,
        x2 - nx,
        y2,
        z2 - nz,
        x1 + nx,
        y1,
        z1 + nz,
        x1 + nx,
        y1,
        z1 + nz,
        x2 - nx,
        y2,
        z2 - nz,
        x2 + nx,
        y2,
        z2 + nz,
      );
      uv.push(
        0.15,
        d / 30,
        0.15,
        (d + len) / 30,
        0.85,
        d / 30,
        0.85,
        d / 30,
        0.15,
        (d + len) / 30,
        0.85,
        (d + len) / 30,
      );
      d += len;
      // the pit wall on the track's side of the lane
      const side =
        trackDist(x1 + nx * 2, z1 + nz * 2) < trackDist(x1 - nx * 2, z1 - nz * 2) ? 1 : -1;
      const wx1 = x1 + nx * side * 1.25;
      const wz1 = z1 + nz * side * 1.25;
      const wx2 = x2 + nx * side * 1.25;
      const wz2 = z2 + nz * side * 1.25;
      if (trackDist(wx1, wz1) < 30 && k > 4 && k < pts.length - 6)
        wall.push(
          wx1,
          y1,
          wz1,
          wx2,
          y2,
          wz2,
          wx1,
          y1 + 1.1,
          wz1,
          wx1,
          y1 + 1.1,
          wz1,
          wx2,
          y2,
          wz2,
          wx2,
          y2 + 1.1,
          wz2,
        );
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const lane = new THREE.Mesh(
      geo,
      keep(
        new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normal,
          roughness: 0.9,
          color: 0xd8d8d4,
          ...offset,
        }),
      ),
    );
    lane.receiveShadow = true;
    scene.add(lane);
    const wg = keep(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3));
    wg.computeVertexNormals();
    const w = new THREE.Mesh(
      wg,
      keep(
        new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.8, side: THREE.DoubleSide }),
      ),
    );
    w.castShadow = true;
    w.receiveShadow = true;
    scene.add(w);
  }

  await tick();

  // ---- barriers: armco both sides (further out on the outside of corners), tyre walls where
  // it's tight, catch fencing on top, boards along the main straight and the big stops
  {
    const rail: number[] = [];
    const tyres: number[] = [];
    const tyC: number[] = [];
    const fenceP: number[] = [];
    const fenceUV: number[] = [];
    const boardP: number[] = [];
    const boardUV: number[] = [];
    const posts: Array<[number, number, number]> = [];
    const lights: Array<[number, number, number, number]> = [];
    const c = new THREE.Color();
    // the big stops: the four tightest corners after a straight
    const stops: number[] = [];
    const order = [...Array(N).keys()]
      .filter((i) => n(TURN, i) > 0.35)
      .sort((a, b) => n(TURN, b) - n(TURN, a));
    for (const i of order)
      if (
        stops.every((s2) => Math.abs(((s2 - i + N + N / 2) % N) - N / 2) > 120) &&
        stops.length < 4
      )
        stops.push(i);
    const nearStop = (i: number) =>
      stops.some((s2) => {
        const d = (s2 - i + N) % N;
        return d < 60 || d > N - 8;
      });
    const race0 = s.races[Object.keys(s.races)[0] as string];
    const start = race0 ? Math.round((((n(race0.frac, 0) % 1) + 1) % 1) * N) % N : 0;
    const nearStart = (i: number) => {
      const d = (i - start + N) % N;
      return d < 90 || d > N - 160;
    };
    for (const sd of [-1, 1]) {
      let off = Array.from({ length: N }, (_, i) => {
        const outside = n(SIDE, i) !== 0 && -n(SIDE, i) === sd;
        return W / 2 + 6 + (outside ? Math.min(34, n(TURN, i) * 110) : 2.5);
      });
      for (let r = 0; r < 5; r++)
        off = off.map(
          (_, i) =>
            (n(off, (i - 4 + N) % N) +
              n(off, (i - 1 + N) % N) +
              n(off, i) +
              n(off, (i + 1) % N) +
              n(off, (i + 4) % N)) /
            5,
        );
      const BX = new Float64Array(N);
      const BZ = new Float64Array(N);
      const ok = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        BX[i] = n(LX, i) + NX(i) * n(off, i) * sd;
        BZ[i] = n(LZ, i) + NZ(i) * n(off, i) * sd;
        const x = n(BX, i);
        const z = n(BZ, i);
        ok[i] =
          clearOf(x, z, i, W / 2 + 5) &&
          x > 0 &&
          z > 0 &&
          x < SX &&
          z < SZ &&
          !s.lap.bridge.includes(i)
            ? 1
            : 0;
      }
      let run = 0;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        if (!ok[i] || !ok[j]) continue;
        const x1 = n(BX, i);
        const z1 = n(BZ, i);
        const x2 = n(BX, j);
        const z2 = n(BZ, j);
        const y1 = hAt(x1, z1);
        const y2 = hAt(x2, z2);
        const seg = Math.hypot(x2 - x1, z2 - z1);
        // two steel beams
        for (const [lo, hi] of [
          [0.45, 0.75],
          [0.85, 1.15],
        ] as Array<[number, number]>)
          rail.push(
            x1,
            y1 + lo,
            z1,
            x2,
            y2 + lo,
            z2,
            x1,
            y1 + hi,
            z1,
            x1,
            y1 + hi,
            z1,
            x2,
            y2 + lo,
            z2,
            x2,
            y2 + hi,
            z2,
          );
        if (i % 2 === 0) posts.push([x1, y1, z1]);
        // catch fence above it, where cars pass close
        const close = n(off, i) < W / 2 + 22;
        if (close) {
          fenceP.push(
            x1,
            y1 + 1.15,
            z1,
            x2,
            y2 + 1.15,
            z2,
            x1,
            y1 + 4.2,
            z1,
            x1,
            y1 + 4.2,
            z1,
            x2,
            y2 + 1.15,
            z2,
            x2,
            y2 + 4.2,
            z2,
          );
          const u1 = run / 2.5;
          const u2 = (run + seg) / 2.5;
          fenceUV.push(u1, 0, u2, 0, u1, 1.2, u1, 1.2, u2, 0, u2, 1.2);
        }
        // boards on the barrier, track side
        if (nearStart(i) || nearStop(i)) {
          const row = (Math.floor(n(DIST, i) / 60) + (sd > 0 ? 1 : 3)) % BOARD_ROWS;
          const inx = -NX(i) * sd * 0.12;
          const inz = -NZ(i) * sd * 0.12;
          const v0 = 1 - (row + 1) / BOARD_ROWS;
          const v1 = 1 - row / BOARD_ROWS;
          const u1 = run / 24;
          const u2 = (run + seg) / 24;
          boardP.push(
            x1 + inx,
            y1 + 0.4,
            z1 + inz,
            x2 + inx,
            y2 + 0.4,
            z2 + inz,
            x1 + inx,
            y1 + 1.2,
            z1 + inz,
            x1 + inx,
            y1 + 1.2,
            z1 + inz,
            x2 + inx,
            y2 + 0.4,
            z2 + inz,
            x2 + inx,
            y2 + 1.2,
            z2 + inz,
          );
          boardUV.push(u1, v0, u2, v0, u1, v1, u1, v1, u2, v0, u2, v1);
        }
        // tyre walls on the outside of the tight corners
        const outside = -n(SIDE, i) === sd && n(TURN, i) > 0.16;
        if (outside) {
          const ix = -NX(i) * sd * 1.1;
          const iz = -NZ(i) * sd * 1.1;
          tyres.push(
            x1 + ix,
            y1,
            z1 + iz,
            x2 + ix,
            y2,
            z2 + iz,
            x1 + ix,
            y1 + 1.0,
            z1 + iz,
            x1 + ix,
            y1 + 1.0,
            z1 + iz,
            x2 + ix,
            y2,
            z2 + iz,
            x2 + ix,
            y2 + 1.0,
            z2 + iz,
          );
          c.set(Math.floor(n(DIST, i) / 4) % 2 ? 0x1e2122 : sd > 0 ? 0xdcdcd6 : 0xc22a22);
          for (let k = 0; k < 6; k++) tyC.push(c.r, c.g, c.b);
        }
        if (L.floodlights && i % 22 === 0)
          lights.push([
            x1 - NX(i) * sd * -7,
            y1,
            z1 - NZ(i) * sd * -7,
            Math.atan2(-NZ(i) * sd, -NX(i) * sd),
          ]);
        run += seg;
      }
    }
    const mk = (pos: number[], mat: THREE.Material, extra?: [string, number[], number]) => {
      if (!pos.length) return;
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (extra) geo.setAttribute(extra[0], new THREE.Float32BufferAttribute(extra[1], extra[2]));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    };
    mk(
      rail,
      keep(
        new THREE.MeshStandardMaterial({
          color: 0xc4c9cc,
          metalness: 0.85,
          roughness: 0.32,
          side: THREE.DoubleSide,
        }),
      ),
    );
    mk(
      tyres,
      keep(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.85,
          side: THREE.DoubleSide,
        }),
      ),
      ['color', tyC, 3],
    );
    const fenceTex = keep(fence());
    mk(
      fenceP,
      keep(
        new THREE.MeshStandardMaterial({
          map: fenceTex,
          alphaTest: 0.45,
          metalness: 0.6,
          roughness: 0.5,
          side: THREE.DoubleSide,
        }),
      ),
      ['uv', fenceUV, 2],
    );
    const boardTex = keep(boards());
    mk(
      boardP,
      keep(
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.55, side: THREE.DoubleSide }),
      ),
      ['uv', boardUV, 2],
    );
    const pg = keep(new THREE.BoxGeometry(0.1, 4.3, 0.1));
    pg.translate(0, 2.15, 0);
    const postMesh = new THREE.InstancedMesh(
      pg,
      keep(new THREE.MeshStandardMaterial({ color: 0x8e9396, metalness: 0.6, roughness: 0.45 })),
      posts.length,
    );
    const mm = new THREE.Matrix4();
    posts.forEach(([x, y, z], k) => {
      mm.makeTranslation(x, y, z);
      postMesh.setMatrixAt(k, mm);
    });
    postMesh.castShadow = true;
    scene.add(postMesh);
    if (lights.length) {
      const pole = keep(
        mergeGeometries([
          new THREE.CylinderGeometry(0.25, 0.4, 24, 8).translate(0, 12, 0).toNonIndexed(),
          new THREE.BoxGeometry(0.6, 3, 5).translate(0.6, 24, 0).toNonIndexed(),
        ]) as THREE.BufferGeometry,
      );
      const head = keep(new THREE.BoxGeometry(0.2, 2.6, 4.6));
      head.translate(0.95, 24, 0);
      const poles = new THREE.InstancedMesh(
        pole,
        keep(new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.7, roughness: 0.4 })),
        lights.length,
      );
      const heads = new THREE.InstancedMesh(
        head,
        keep(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfff2d6,
            emissiveIntensity: 6,
          }),
        ),
        lights.length,
      );
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      lights.forEach(([x, y, z, a], k) => {
        q.setFromAxisAngle(up, -a);
        mm.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
        poles.setMatrixAt(k, mm);
        heads.setMatrixAt(k, mm);
      });
      poles.castShadow = true;
      scene.add(poles, heads);
      // the floodlit track: a broad warm fill
      const flood = new THREE.HemisphereLight(0xfff1dd, 0x3a3326, 0.9);
      scene.add(flood);
    }
  }

  await tick();

  // ---- buildings and grandstands
  const crowd: Array<[number, number, number]> = [];
  {
    const wpos: number[] = [];
    const wcol: number[] = [];
    const TINTS = [0xffffff, 0xf3e9d8, 0xe9e3da, 0xd9d6cf, 0xefe2c6, 0xcfd3d6, 0xe8d6c0, 0xbfc3c5];
    const wuv: number[] = [];
    const rpos: number[] = [];
    const rcol: number[] = [];
    const spos: number[] = [];
    const scol: number[] = [];
    const c = new THREE.Color();
    const box = (
      arr: number[],
      cols: number[],
      color: number,
      [u0, u1]: [number, number],
      [y0, y1]: [number, number],
      [v0, v1]: [number, number],
      [ux, uz]: [number, number],
      [vx, vz]: [number, number],
      [ox, oz]: [number, number],
    ) => {
      const p = (u: number, y: number, v: number): [number, number, number] => [
        ox + ux * u + vx * v,
        y,
        oz + uz * u + vz * v,
      ];
      const quads: Array<Array<[number, number, number]>> = [
        [p(u0, y1, v0), p(u1, y1, v0), p(u1, y1, v1), p(u0, y1, v1)],
        [p(u0, y0, v0), p(u1, y0, v0), p(u1, y1, v0), p(u0, y1, v0)],
        [p(u1, y0, v1), p(u0, y0, v1), p(u0, y1, v1), p(u1, y1, v1)],
        [p(u0, y0, v1), p(u0, y0, v0), p(u0, y1, v0), p(u0, y1, v1)],
        [p(u1, y0, v0), p(u1, y0, v1), p(u1, y1, v1), p(u1, y1, v0)],
      ];
      c.set(color);
      for (const [a, b, cc, d] of quads as Array<
        [
          [number, number, number],
          [number, number, number],
          [number, number, number],
          [number, number, number],
        ]
      >) {
        arr.push(...a, ...b, ...cc, ...a, ...cc, ...d);
        for (let k = 0; k < 6; k++) cols.push(c.r, c.g, c.b);
      }
    };
    const nearestLap = (x: number, z: number) => {
      let b = 0;
      let bd = Number.POSITIVE_INFINITY;
      for (let i = 0; i < N; i += 3) {
        const d = (n(LX, i) - x) ** 2 + (n(LZ, i) - z) ** 2;
        if (d < bd) {
          bd = d;
          b = i;
        }
      }
      return b;
    };
    const stand = (p: Array<[number, number]>, h: number) => {
      // the longest side sets its length; the tiers rise away from the track
      let len = 0;
      let ux = 1;
      let uz = 0;
      for (let k = 0; k < p.length; k++) {
        const [a1, a2] = p[k] as [number, number];
        const [b1, b2] = p[(k + 1) % p.length] as [number, number];
        const l = Math.hypot(b1 - a1, b2 - a2);
        if (l > len) {
          len = l;
          ux = (b1 - a1) / l;
          uz = (b2 - a2) / l;
        }
      }
      let vx = -uz;
      let vz = ux;
      const cx = p.reduce((a, q) => a + q[0], 0) / p.length;
      const cz = p.reduce((a, q) => a + q[1], 0) / p.length;
      const ni = nearestLap(cx, cz);
      if ((n(LX, ni) - cx) * vx + (n(LZ, ni) - cz) * vz > 0) {
        vx = -vx;
        vz = -vz;
      }
      const us = p.map(([x, z]) => (x - cx) * ux + (z - cz) * uz);
      const vs = p.map(([x, z]) => (x - cx) * vx + (z - cz) * vz);
      const u0 = Math.min(...us);
      const u1 = Math.max(...us);
      const v0 = Math.min(...vs);
      const v1 = Math.max(...vs);
      const base = Math.min(...p.map(([x, z]) => hAt(x, z))) - 0.4;
      const rows = Math.max(6, Math.round((v1 - v0) / 1.3));
      const dv = (v1 - v0) / rows;
      const top = Math.max(8, h);
      const U: [number, number] = [ux, uz];
      const V: [number, number] = [vx, vz];
      const O: [number, number] = [cx, cz];
      const seat = [0x1f6f8b, 0x2a86a6, 0x1a5d76][Math.floor(rnd() * 3)] as number;
      for (let r = 0; r < rows; r++) {
        const y = base + 1.4 + ((top - 1.4) * (r + 1)) / rows;
        box(
          spos,
          scol,
          0x8f9493,
          [u0, u1],
          [base, y - 0.32],
          [v0 + r * dv, v0 + (r + 1) * dv],
          U,
          V,
          O,
        );
        box(
          spos,
          scol,
          r % 2 ? seat : 0x2c3135,
          [u0 + 0.3, u1 - 0.3],
          [y - 0.32, y],
          [v0 + r * dv + 0.25, v0 + (r + 1) * dv],
          U,
          V,
          O,
        );
        for (let u = u0 + 0.6; u < u1 - 0.6; u += 0.62)
          if (rnd() < 0.85)
            crowd.push([
              cx + ux * u + vx * (v0 + (r + 0.62) * dv),
              y,
              cz + uz * u + vz * (v0 + (r + 0.62) * dv),
            ]);
      }
      box(spos, scol, 0x767d80, [u0, u1], [base, base + top + 0.4], [v1, v1 + 0.5], U, V, O);
      box(
        spos,
        scol,
        0xe6e8e6,
        [u0 - 1.5, u1 + 1.5],
        [base + top + 4.5, base + top + 4.9],
        [v0 - 3, v1 + 0.8],
        U,
        V,
        O,
      );
      for (let u = u0; u <= u1 + 0.01; u += Math.max(9, (u1 - u0) / 7))
        box(
          spos,
          scol,
          0x8d9295,
          [u - 0.18, u + 0.18],
          [base, base + top + 4.5],
          [v1 + 0.1, v1 + 0.45],
          U,
          V,
          O,
        );
    };
    let stands = 0;
    for (const b of s.buildings) {
      let p = b.p;
      const f = p[0] as [number, number];
      const l = p[p.length - 1] as [number, number];
      if (p.length > 2 && f[0] === l[0] && f[1] === l[1]) p = p.slice(0, -1);
      if (p.length < 3) continue;
      if (b.stand) {
        stand(p, b.h);
        stands++;
        continue;
      }
      const base = Math.min(...p.map(([x, z]) => hAt(x, z))) - 0.4;
      const bottom = base + (b.min ?? 0);
      const top = base + 0.4 + b.h;
      const tint = new THREE.Color(TINTS[Math.floor(rnd() * TINTS.length)] as number);
      if (!b.min) {
        for (let k = 0; k < p.length; k++) {
          const [x1, z1] = p[k] as [number, number];
          const [x2, z2] = p[(k + 1) % p.length] as [number, number];
          const len = Math.hypot(x2 - x1, z2 - z1);
          wpos.push(
            x1,
            bottom,
            z1,
            x2,
            bottom,
            z2,
            x1,
            top,
            z1,
            x1,
            top,
            z1,
            x2,
            bottom,
            z2,
            x2,
            top,
            z2,
          );
          const u = len / 7;
          const v = (top - bottom) / 9.5;
          wuv.push(0, 0, u, 0, 0, v, 0, v, u, 0, u, v);
          for (let m = 0; m < 6; m++) wcol.push(tint.r, tint.g, tint.b);
        }
      }
      const area =
        Math.abs(
          p.reduce((a, q, k) => {
            const r = p[(k + 1) % p.length] as [number, number];
            return a + q[0] * r[1] - r[0] * q[1];
          }, 0),
        ) / 2;
      const small = b.h <= 10 && area < 500 && !b.min;
      c.set(
        small
          ? ([0x7d4a3a, 0x5c4a44, 0x444749, 0x8a5a44][Math.floor(rnd() * 4)] as number)
          : b.min
            ? 0xd9dbd8
            : 0x707375,
      );
      if (small) {
        const cx = p.reduce((a, q) => a + q[0], 0) / p.length;
        const cz = p.reduce((a, q) => a + q[1], 0) / p.length;
        const apex = top + Math.min(4.5, Math.sqrt(area) * 0.38);
        for (let k = 0; k < p.length; k++) {
          const [x1, z1] = p[k] as [number, number];
          const [x2, z2] = p[(k + 1) % p.length] as [number, number];
          rpos.push(x1, top, z1, cx, apex, cz, x2, top, z2);
          for (let m = 0; m < 3; m++) rcol.push(c.r, c.g, c.b);
        }
      } else {
        const tris = THREE.ShapeUtils.triangulateShape(
          p.map(([x, z]) => new THREE.Vector2(x, z)),
          [],
        );
        for (const t of tris)
          for (const v of t) {
            const q = p[v] as [number, number];
            rpos.push(q[0], top, q[1]);
            rcol.push(c.r, c.g, c.b);
          }
      }
    }
    // Every circuit has a main grandstand opposite the pits; where the map has none near the
    // line, one is built there.
    const race0 = s.races[Object.keys(s.races)[0] as string];
    const start = race0 ? Math.round((((n(race0.frac, 0) % 1) + 1) % 1) * N) % N : 0;
    const sx = n(LX, start);
    const sz = n(LZ, start);
    const anyNear = s.buildings.some(
      (b) => b.stand && b.p.some(([x, z]) => Math.hypot(x - sx, z - sz) < 350),
    );
    if (!anyNear) {
      // the side away from the pit lane
      let side = 1;
      if (pitLine) {
        const [px, pz] = pitLine[Math.floor(pitLine.length / 2)] as [number, number];
        side = (px - sx) * NX(start) + (pz - sz) * NZ(start) > 0 ? -1 : 1;
      }
      const from = (start - 70 + N) % N;
      const to = (start + 10) % N;
      const a = from;
      const b = to;
      const o1 = side * (W / 2 + 16);
      const o2 = side * (W / 2 + 40);
      const poly: Array<[number, number]> = [
        [n(LX, a) + NX(a) * o1, n(LZ, a) + NZ(a) * o1],
        [n(LX, b) + NX(b) * o1, n(LZ, b) + NZ(b) * o1],
        [n(LX, b) + NX(b) * o2, n(LZ, b) + NZ(b) * o2],
        [n(LX, a) + NX(a) * o2, n(LZ, a) + NZ(a) * o2],
      ];
      if (poly.every(([x, z]) => clearOf(x, z, -1, W / 2 + 10))) stand(poly, 16);
    }
    void stands;
    const mk = (pos: number[], extra: [string, number[], number], mat: THREE.Material) => {
      if (!pos.length) return;
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute(extra[0], new THREE.Float32BufferAttribute(extra[1], extra[2]));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    };
    const winTex = keep(windows());
    {
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
      geo.computeVertexNormals();
      const walls = new THREE.Mesh(
        geo,
        keep(
          new THREE.MeshStandardMaterial({
            map: winTex,
            vertexColors: true,
            roughness: 0.78,
            side: THREE.DoubleSide,
          }),
        ),
      );
      walls.castShadow = true;
      walls.receiveShadow = true;
      if (wpos.length) scene.add(walls);
    }
    mk(
      rpos,
      ['color', rcol, 3],
      keep(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          side: THREE.DoubleSide,
        }),
      ),
    );
    mk(
      spos,
      ['color', scol, 3],
      keep(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.7,
          side: THREE.DoubleSide,
        }),
      ),
    );
    if (crowd.length) {
      const body = keep(
        mergeGeometries([
          new THREE.CylinderGeometry(0.2, 0.24, 0.95, 6).translate(0, 0.48, 0).toNonIndexed(),
          new THREE.SphereGeometry(0.13, 6, 5).translate(0, 1.08, 0).toNonIndexed(),
        ]) as THREE.BufferGeometry,
      );
      const people = new THREE.InstancedMesh(
        body,
        keep(new THREE.MeshStandardMaterial({ roughness: 0.9 })),
        crowd.length,
      );
      const mm = new THREE.Matrix4();
      const cc = new THREE.Color();
      const PAL = [
        0xe8e8e8, 0x1d3557, 0xe63946, 0xf1c453, 0x2a9d8f, 0x222222, 0xf4a261, 0x6d597a, 0xff8000,
        0x3a86ff, 0xc1121f, 0x00d2be,
      ];
      crowd.forEach(([x, y, z], k) => {
        mm.makeTranslation(x, y, z);
        people.setMatrixAt(k, mm);
        people.setColorAt(k, cc.set(PAL[Math.floor(rnd() * PAL.length)] as number));
      });
      scene.add(people);
    }
  }

  await tick();

  // ---- trees
  {
    const MS = 0.5;
    const mask = document.createElement('canvas');
    mask.width = Math.ceil(SX * MS);
    mask.height = Math.ceil(SZ * MS);
    const m = mask.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    m.scale(MS, MS);
    m.lineJoin = 'round';
    m.lineCap = 'round';
    m.fillStyle = '#000';
    m.fillRect(0, 0, SX, SZ);
    const fa = (kind: string, color: string) => {
      m.fillStyle = color;
      for (const r of s.areas[kind] ?? []) {
        ring(m, r, true);
        m.fill();
      }
    };
    fa('forest', '#ff0000');
    fa('scrub', '#900000');
    fa('urban', '#280000');
    fa('grass', s.ground === 'park' ? '#1c0000' : '#000000');
    m.strokeStyle = '#000';
    ring(m, lapRing, true);
    m.lineWidth = 54;
    m.stroke();
    if (pitLine) {
      ring(m, pitLine, false);
      m.lineWidth = 40;
      m.stroke();
    }
    for (const r of s.roads) {
      m.lineWidth = r.w + 7;
      ring(m, r.p, false);
      m.stroke();
    }
    m.fillStyle = '#000';
    for (const b of s.buildings) {
      ring(m, b.p, true);
      m.lineWidth = 10;
      m.fill();
      m.stroke();
    }
    for (const a of ['water', 'asphalt', 'gravel', 'sand']) {
      for (const r of s.areas[a] ?? []) {
        ring(m, r, true);
        m.fill();
      }
    }
    const img = m.getImageData(0, 0, mask.width, mask.height).data;
    const conifer =
      s.ground === 'forest' ? 0.75 : s.ground === 'dry' ? 0.25 : s.ground === 'desert' ? 0 : 0.3;
    const geoms = treeGeometries();
    const mat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    const MAX = 26000;
    const OUTER = s.ground === 'desert' ? 0 : 9000;
    const spruce = new THREE.InstancedMesh(keep(geoms.spruce), mat, MAX + OUTER);
    const leafy = new THREE.InstancedMesh(keep(geoms.leafy), mat, MAX);
    const palm = new THREE.InstancedMesh(keep(geoms.palm), mat, 4000);
    for (const t of [spruce, leafy, palm]) {
      t.castShadow = true;
      t.receiveShadow = true;
    }
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    let ns = 0;
    let nl = 0;
    let np = 0;
    const put = (x: number, z: number, kind: 'spruce' | 'leafy' | 'palm', sc: number) => {
      Q.setFromAxisAngle(up, rnd() * 6.28);
      M.compose(
        new THREE.Vector3(x, hAt(x, z) - 0.4, z),
        Q,
        new THREE.Vector3(sc, sc * (0.85 + rnd() * 0.35), sc),
      );
      if (kind === 'spruce' && ns < MAX + OUTER) {
        spruce.setMatrixAt(ns, M);
        spruce.setColorAt(
          ns++,
          col.setHSL(0.33 + rnd() * 0.06, 0.24 + rnd() * 0.12, 0.12 + rnd() * 0.06),
        );
      } else if (kind === 'leafy' && nl < MAX) {
        leafy.setMatrixAt(nl, M);
        leafy.setColorAt(
          nl++,
          col.setHSL(0.21 + rnd() * 0.08, 0.3 + rnd() * 0.14, 0.11 + rnd() * 0.06),
        );
      } else if (kind === 'palm' && np < 4000) {
        palm.setMatrixAt(np, M);
        palm.setColorAt(np++, col.setHSL(0.21 + rnd() * 0.06, 0.4, 0.26 + rnd() * 0.06));
      }
    };
    // single trees and rows the map has
    for (const [x, z] of s.trees) {
      if (trackDist(x, z) < 20) continue;
      put(
        x,
        z,
        s.ground === 'desert' ? 'palm' : rnd() < conifer * 0.6 ? 'spruce' : 'leafy',
        0.75 + rnd() * 0.45,
      );
    }
    // woods and scrub
    let tries = 0;
    while (ns + nl + np < MAX && tries < 700000) {
      tries++;
      const x = rnd() * SX;
      const z = rnd() * SZ;
      const v = n(img, (Math.floor(z * MS) * mask.width + Math.floor(x * MS)) * 4);
      if (v < 20 || (v < 40 && rnd() < 0.85) || (v < 160 && rnd() < 0.6)) continue;
      const kind =
        s.ground === 'desert'
          ? v > 200
            ? 'leafy'
            : 'palm'
          : rnd() < (v > 200 ? conifer : conifer * 0.4)
            ? 'spruce'
            : 'leafy';
      put(x, z, kind, v > 200 ? 0.8 + rnd() * 0.55 : 0.55 + rnd() * 0.4);
    }
    // the woods beyond the scenery
    for (let k = 0; k < OUTER * 7 && ns < MAX + OUTER; k++) {
      const x = -3200 + rnd() * (SX + 6400);
      const z = -3200 + rnd() * (SZ + 6400);
      if (x > 0 && x < SX && z > 0 && z < SZ) continue;
      if (forestAt(x, z) < 0.5) continue;
      if (Math.hypot(Math.max(0, -x, x - SX), Math.max(0, -z, z - SZ)) < 350) continue;
      Q.setFromAxisAngle(up, rnd() * 6.28);
      const sc = 0.9 + rnd() * 0.6;
      M.compose(new THREE.Vector3(x, rollAt(x, z) - 1, z), Q, new THREE.Vector3(sc, sc, sc));
      if (rnd() < Math.max(conifer, 0.4)) {
        spruce.setMatrixAt(ns, M);
        spruce.setColorAt(ns++, col.setHSL(0.33 + rnd() * 0.05, 0.24, 0.12 + rnd() * 0.05));
      } else if (nl < MAX) {
        leafy.setMatrixAt(nl, M);
        leafy.setColorAt(nl++, col.setHSL(0.22 + rnd() * 0.06, 0.28, 0.11 + rnd() * 0.05));
      }
    }
    spruce.count = ns;
    leafy.count = nl;
    palm.count = np;
    scene.add(spruce, leafy, palm);
  }

  // ---- landmarks
  for (const lm of s.landmarks) {
    if (lm.kind === 'wheel')
      scene.add(ferrisWheel(lm.at, lm.size, hAt(lm.at[0], lm.at[1]), centre, keep));
  }

  // ---- TV camera spots: high, outside the lap, every so often
  const tv: THREE.Vector3[] = [];
  for (let k = 0; k < 14; k++) {
    const i = Math.floor(((k + 0.5) * N) / 14);
    const sd = -n(SIDE, i) || 1;
    const x = n(LX, i) + NX(i) * sd * 55;
    const z = n(LZ, i) + NZ(i) * sd * 55;
    tv.push(new THREE.Vector3(x, Math.max(hAt(x, z), n(LY, i)) + 22, z));
  }

  return {
    scene,
    sky,
    sun,
    sunDir,
    exposure: L.exposure,
    floodlit: L.floodlights,
    heightAt: hAt,
    lapAt,
    lapCount: N,
    centre,
    radius,
    tv,
    dispose: () => {
      for (const d of disposables) d.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
}

function densify(pts: Array<[number, number]>, step: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x1, z1] = pts[k] as [number, number];
    const [x2, z2] = pts[k + 1] as [number, number];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = Math.max(1, Math.round(len / step));
    for (let j = 0; j < m; j++) out.push([x1 + ((x2 - x1) * j) / m, z1 + ((z2 - z1) * j) / m]);
  }
  const last = pts[pts.length - 1];
  if (last) out.push(last);
  return out;
}

/** Trees: spruce (stacked, ragged skirts), broadleaf (a cluster of rough crowns), palm. Each
 * shaded darker low and inside, as foliage is. Unit size: spruce about 20 m, broadleaf 14 m. */
function treeGeometries(): {
  spruce: THREE.BufferGeometry;
  leafy: THREE.BufferGeometry;
  palm: THREE.BufferGeometry;
} {
  const paint = (
    geo: THREE.BufferGeometry,
    base: number,
    shade: (y: number, r: number) => number,
  ) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes))
      if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const r = Math.hypot(p.getX(i), p.getZ(i));
      c.set(base).multiplyScalar(shade(y, r));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  // one shared vertex per corner, so a roughened crown stays closed and shades smoothly
  const solid = (geo: THREE.BufferGeometry) => {
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    return mergeVertices(geo);
  };
  const rough = (geo: THREE.BufferGeometry, amt: number) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (rnd() - 0.5) * amt;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) + (rnd() - 0.5) * amt * 0.6, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const trunk = (h: number, r: number) =>
    paint(new THREE.CylinderGeometry(r * 0.6, r, h, 6).translate(0, h / 2, 0), 0x4a3a2c, () => 1);
  const skirts: THREE.BufferGeometry[] = [trunk(6, 0.35)];
  const tiers = 10;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const r = 3.3 * (1 - f * 0.86);
    const h = 3.5 - f * 1.1;
    const y = 2.6 + f * 16.8;
    skirts.push(
      paint(
        rough(new THREE.ConeGeometry(r, h, 9, 1, true).translate(0, y + h / 2, 0), 0.25),
        0xffffff,
        (yy) => 0.55 + 0.45 * Math.min(1, (yy - 2) / 18),
      ),
    );
  }
  const spruce = mergeGeometries(skirts) as THREE.BufferGeometry;
  const crowns: THREE.BufferGeometry[] = [trunk(7, 0.45)];
  for (const [x, y, z, r] of [
    [0, 9.5, 0, 4.4],
    [2.3, 8.2, 1, 3.2],
    [-2.1, 8.6, -1.2, 3.3],
    [0.6, 11.6, -1.4, 3.0],
    [-0.8, 7.6, 2.2, 2.8],
  ] as Array<[number, number, number, number]>) {
    crowns.push(
      paint(
        rough(solid(new THREE.IcosahedronGeometry(r, 2)).translate(x, y, z), 0.3),
        0xffffff,
        (yy, rr) => 0.45 + 0.55 * Math.min(1, (yy - 5) / 8) * Math.min(1, rr / 3),
      ),
    );
  }
  const leafy = mergeGeometries(crowns) as THREE.BufferGeometry;
  const fronds: THREE.BufferGeometry[] = [];
  const t = new THREE.CylinderGeometry(0.22, 0.32, 9, 7, 6);
  const tp = t.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + ((tp.getY(i) + 4.5) / 9) ** 2 * 0.9);
  fronds.push(paint(t.translate(0, 4.5, 0), 0x6b5a45, () => 1));
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const f = new THREE.ConeGeometry(0.5, 4.6, 4, 1);
    f.scale(1, 1, 0.25);
    f.rotateZ(-Math.PI / 2 + 0.35);
    f.translate(2.2, 0, 0);
    f.rotateY(a);
    f.translate(0.9, 9, 0);
    fronds.push(paint(f, 0xffffff, () => 0.85));
  }
  const palm = mergeGeometries(fronds) as THREE.BufferGeometry;
  return { spruce, leafy, palm };
}

/** A Ferris wheel of `size` m, facing the circuit. */
function ferrisWheel(
  at: [number, number],
  size: number,
  ground: number,
  centre: THREE.Vector3,
  keep: <T extends { dispose: () => void }>(x: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  const R = size / 2;
  const steel = keep(
    new THREE.MeshStandardMaterial({ color: 0xe8e8e6, metalness: 0.5, roughness: 0.4 }),
  );
  const hub = R + 6;
  for (const zz of [-1.6, 1.6]) {
    const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(R, 0.35, 8, 96)), steel);
    rim.position.set(0, hub, zz);
    g.add(rim);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const spoke = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, R, 4)), steel);
      spoke.position.set((Math.cos(a) * R) / 2, hub + (Math.sin(a) * R) / 2, zz);
      spoke.rotation.z = a - Math.PI / 2;
      g.add(spoke);
    }
  }
  const cols = [0xd62828, 0xf77f00, 0xfcbf49, 0x2a9d8f, 0x3a86ff, 0x8338ec];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const gon = new THREE.Mesh(
      keep(new THREE.BoxGeometry(2.2, 2.4, 2.4)),
      keep(
        new THREE.MeshStandardMaterial({ color: cols[k % cols.length] as number, roughness: 0.5 }),
      ),
    );
    gon.position.set(Math.cos(a) * R, hub + Math.sin(a) * R - 1.6, 0);
    g.add(gon);
  }
  for (const sx of [-1, 1])
    for (const zz of [-4, 4]) {
      const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.5, 0.7, hub * 1.05, 8)), steel);
      leg.position.set(sx * R * 0.28, hub / 2, zz * 0.85);
      leg.rotation.z = sx * 0.28;
      leg.rotation.x = zz > 0 ? 0.08 : -0.08;
      g.add(leg);
    }
  g.traverse((o) => {
    o.castShadow = true;
  });
  g.position.set(at[0], ground, at[1]);
  g.lookAt(centre.x, ground, centre.z);
  return g;
}

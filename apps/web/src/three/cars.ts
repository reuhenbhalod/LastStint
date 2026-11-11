// The cars in 3D: an original open-wheel design at real size (5.6 m nose to rear wing),
// pointing along +x, wheels on the ground. Built once from simple solids merged by material,
// then shared: each car is a handful of meshes (paint in its team's colour, the tyre's colour
// on a band round each wheel). The safety car is a road car with a light bar.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Part = THREE.BufferGeometry;

function place(g: Part, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Part {
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g.index ? g.toNonIndexed() : g;
}

function strip(g: Part): Part {
  for (const k of Object.keys(g.attributes))
    if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

/** A top-view outline (half-widths along x), extruded up `h`, bevelled. */
function plan(pts: Array<[number, number]>, h: number, bevel: number): Part {
  const sh = new THREE.Shape();
  pts.forEach(([x, w], k) => (k ? sh.lineTo(x, w) : sh.moveTo(x, w)));
  for (let k = pts.length - 1; k >= 0; k--)
    sh.lineTo((pts[k] as [number, number])[0], -(pts[k] as [number, number])[1]);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A side-view outline (x, height), extruded across `w`, centred. */
function side(pts: Array<[number, number]>, w: number, bevel: number): Part {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], k) => (k ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: w,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  g.translate(0, 0, -w / 2);
  return g;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

interface CarParts {
  paint: Part;
  carbon: Part;
  rubber: Part;
  rim: Part;
  band: Part;
  halo: Part;
  helmet: Part;
}

function buildParts(): CarParts {
  const paint: Part[] = [];
  const carbon: Part[] = [];
  const rubber: Part[] = [];
  const rim: Part[] = [];
  const band: Part[] = [];
  // Tub and nose, sidepods with their undercut, engine cover with the airbox and fin.
  paint.push(
    place(
      plan(
        [
          [2.62, 0.07],
          [2.2, 0.15],
          [1.5, 0.24],
          [0.7, 0.36],
          [-0.2, 0.42],
          [-1.4, 0.34],
          [-2.25, 0.16],
        ],
        0.3,
        0.07,
      ),
      0,
      0.17,
      0,
    ),
  );
  paint.push(
    place(
      plan(
        [
          [0.42, 0.5],
          [0.15, 0.84],
          [-0.55, 0.86],
          [-1.25, 0.62],
          [-1.95, 0.3],
        ],
        0.26,
        0.09,
      ),
      0,
      0.16,
      0,
    ),
  );
  paint.push(
    place(
      side(
        [
          [0.2, 0.48],
          [-0.12, 0.98],
          [-0.5, 1.0],
          [-1.1, 0.86],
          [-2.05, 0.66],
          [-2.3, 0.5],
        ],
        0.3,
        0.05,
      ),
      0,
      0,
      0,
    ),
  );
  carbon.push(
    place(
      side(
        [
          [-0.6, 0.98],
          [-2.1, 0.86],
          [-2.2, 0.7],
          [-0.9, 0.84],
        ],
        0.02,
        0.005,
      ),
      0,
      0,
      0,
    ),
  ); // fin
  // Floor and its edges, diffuser.
  carbon.push(place(box(4.3, 0.035, 1.55), -0.15, 0.06, 0));
  carbon.push(place(box(0.7, 0.2, 1.0), -2.25, 0.16, 0, 0, 0, -0.35));
  // Front wing: main plane, two flaps, endplates; nose pillars.
  carbon.push(place(box(0.48, 0.03, 1.96), 2.58, 0.1, 0));
  paint.push(place(box(0.3, 0.025, 1.78), 2.46, 0.16, 0, 0, 0, 0.32));
  paint.push(place(box(0.24, 0.025, 1.7), 2.38, 0.22, 0, 0, 0, 0.5));
  for (const s of [-1, 1]) carbon.push(place(box(0.6, 0.26, 0.022), 2.55, 0.2, s * 0.99));
  // Rear wing: main plane, flap (the DRS one), endplates, the swan-neck pylon, beam wing.
  carbon.push(place(box(0.36, 0.03, 1.0), -2.45, 0.88, 0, 0, 0, 0.08));
  paint.push(place(box(0.24, 0.025, 1.0), -2.33, 1.0, 0, 0, 0, -0.42));
  for (const s of [-1, 1]) paint.push(place(box(0.66, 0.56, 0.022), -2.42, 0.74, s * 0.51));
  carbon.push(place(box(0.08, 0.36, 0.06), -2.3, 0.66, 0));
  carbon.push(place(box(0.3, 0.025, 0.9), -2.4, 0.42, 0));
  // Cockpit opening, headrest, mirrors on their stalks, the T-cam.
  carbon.push(place(box(0.62, 0.06, 0.5), 0.42, 0.54, 0));
  for (const s of [-1, 1]) {
    carbon.push(place(box(0.14, 0.08, 0.05), 0.85, 0.66, s * 0.48));
    carbon.push(place(box(0.03, 0.12, 0.03), 0.86, 0.58, s * 0.44));
  }
  carbon.push(place(box(0.12, 0.05, 0.16), -0.15, 1.04, 0));
  // Suspension wishbones.
  for (const [x, s] of [
    [1.8, 1],
    [1.8, -1],
    [-1.62, 1],
    [-1.62, -1],
  ] as Array<[number, number]>) {
    carbon.push(place(box(0.04, 0.025, 0.62), x + 0.08, 0.44, s * 0.52, 0, 0.12 * s));
    carbon.push(place(box(0.04, 0.025, 0.62), x - 0.08, 0.3, s * 0.52, 0, -0.12 * s));
  }
  // Wheels: tyre, rim, the compound's band on the sidewall.
  for (const [x, z, w, r] of [
    [1.8, 0.83, 0.3, 0.36],
    [1.8, -0.83, 0.3, 0.36],
    [-1.62, 0.8, 0.4, 0.36],
    [-1.62, -0.8, 0.4, 0.36],
  ] as Array<[number, number, number, number]>) {
    rubber.push(place(new THREE.CylinderGeometry(r, r, w, 28), x, r, z, Math.PI / 2));
    rubber.push(
      place(new THREE.TorusGeometry(r - 0.02, 0.035, 8, 28), x, r, z + (Math.sign(z) * w) / 2),
    );
    rim.push(place(new THREE.CylinderGeometry(0.24, 0.24, w + 0.012, 20), x, r, z, Math.PI / 2));
    band.push(
      place(new THREE.TorusGeometry(0.29, 0.016, 6, 32), x, r, z + Math.sign(z) * (w / 2 + 0.012)),
    );
  }
  const halo = mergeGeometries(
    [
      place(
        new THREE.TorusGeometry(0.34, 0.032, 8, 20, Math.PI),
        0.42,
        0.66,
        0,
        -Math.PI / 2,
        0,
        Math.PI / 2,
      ),
      place(box(0.05, 0.2, 0.05), 0.78, 0.6, 0),
    ].map(strip),
  ) as Part;
  halo.scale(1, 1, 1);
  const helmet = place(new THREE.SphereGeometry(0.135, 16, 12), 0.36, 0.67, 0);
  const merged = (ps: Part[]) => mergeGeometries(ps.map(strip)) as Part;
  return {
    paint: merged(paint),
    carbon: merged(carbon),
    rubber: merged(rubber),
    rim: merged(rim),
    band: merged(band),
    halo,
    helmet: strip(helmet),
  };
}

export class Garage {
  private parts = buildParts();
  private paints = new Map<string, THREE.MeshStandardMaterial>();
  private bands = new Map<string, THREE.MeshStandardMaterial>();
  private carbon = new THREE.MeshStandardMaterial({
    color: 0x16191b,
    metalness: 0.35,
    roughness: 0.42,
  });
  private rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.88 });
  private rim = new THREE.MeshStandardMaterial({ color: 0x2c2f31, metalness: 0.8, roughness: 0.3 });
  private helmet = new THREE.MeshStandardMaterial({
    color: 0xf4f4f2,
    metalness: 0.1,
    roughness: 0.25,
  });

  private paint(color: string): THREE.MeshStandardMaterial {
    let m = this.paints.get(color);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        metalness: 0.25,
        roughness: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      this.paints.set(color, m);
    }
    return m;
  }

  private band(color: string): THREE.MeshStandardMaterial {
    let m = this.bands.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55 });
      this.bands.set(color, m);
    }
    return m;
  }

  /** A car in `color`, on `tyre` coloured bands. */
  car(color: string, tyre: string): THREE.Group {
    const g = new THREE.Group();
    const p = this.parts;
    const mesh = (geo: Part, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    mesh(p.paint, this.paint(color)).name = 'paint';
    mesh(p.carbon, this.carbon);
    mesh(p.rubber, this.rubber);
    mesh(p.rim, this.rim);
    mesh(p.band, this.band(tyre)).name = 'band';
    mesh(p.halo, this.carbon);
    mesh(p.helmet, this.helmet);
    return g;
  }

  /** Repaint a car (team colour, tyre). */
  dress(car: THREE.Group, color: string, tyre: string): void {
    for (const c of car.children) {
      if (c.name === 'paint') (c as THREE.Mesh).material = this.paint(color);
      if (c.name === 'band') (c as THREE.Mesh).material = this.band(tyre);
    }
  }
}

/** The safety car: a silver coupé with an amber light bar. */
export function safetyCar(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({
    color: 0xc9ccd0,
    metalness: 0.7,
    roughness: 0.25,
    clearcoat: 1,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2229, metalness: 0.6, roughness: 0.1 });
  const lights = new THREE.MeshStandardMaterial({
    color: 0xffb020,
    emissive: 0xff9a00,
    emissiveIntensity: 3,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const add = (geo: Part, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
  };
  add(
    plan(
      [
        [2.3, 0.7],
        [1.6, 0.92],
        [-1.8, 0.95],
        [-2.25, 0.8],
      ],
      0.55,
      0.12,
    ),
    body,
    0,
    0.3,
    0,
  );
  add(
    plan(
      [
        [0.9, 0.62],
        [-1.2, 0.7],
      ],
      0.42,
      0.12,
    ),
    glass,
    0,
    0.92,
    0,
  );
  add(box(0.3, 0.1, 1.1), lights, -0.2, 1.48, 0);
  for (const [x, z] of [
    [1.45, 0.82],
    [1.45, -0.82],
    [-1.45, 0.82],
    [-1.45, -0.82],
  ] as Array<[number, number]>) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 20), tyre);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.34, z);
    g.add(w);
  }
  return g;
}

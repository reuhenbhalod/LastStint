// The race in 3D (docs/3d-spec.md): the circuit built from its scenery, every car where the
// 2D map has it (the map's motion is the one source of where cars are: MapFeed), and cameras:
// the overview (drag to turn, scroll to zoom), following your car, TV cameras round the lap,
// and a battle camera that frames the fight when there is one.

import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TEAM_COLOR } from '../game/teamTheme.js';
import { Garage, safetyCar } from './cars.js';
import { type MapFeed, type Scenery, lapIndex, loadScenery, toWorld } from './scenery.js';
import { type World, buildWorld } from './world.js';

export type CameraMode = 'overview' | 'follow' | 'tv';

/** Versus cars' proportions (length, height, width), as their 2D icons. */
const PROPORTIONS: Record<string, [number, number, number]> = {
  bullet: [1.08, 0.94, 0.9],
  glider: [0.98, 1, 1.08],
  endurance: [1, 1.06, 1.12],
};

const TYRE: Record<string, string> = {
  SOFT: '#e5483b',
  MEDIUM: '#f2c230',
  HARD: '#e9ece9',
  INTERMEDIATE: '#43b047',
  WET: '#2f6fd6',
};

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function Scene3D({
  circuit,
  raceId,
  feedRef,
  main,
  camera: mode,
  onSelect,
  onReady,
  onFail,
}: {
  circuit: string;
  raceId: string;
  feedRef: MutableRefObject<MapFeed | null>;
  /** The 3D view is the main one (not the corner): full quality, every frame. */
  main: boolean;
  camera: CameraMode;
  onSelect?: (code: string) => void;
  onReady?: (name: string) => void;
  /** It can't be drawn here: the race carries on in 2D. */
  onFail?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tagYou = useRef<HTMLDivElement>(null);
  const tagRival = useRef<HTMLDivElement>(null);
  const tagSel = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [name, setName] = useState('');
  const live = useRef({ main, mode, onSelect });
  live.current = { main, mode, onSelect };

  useEffect(() => {
    const el = canvas.current;
    const box = host.current;
    if (!el || !box) return;
    let stop = false;
    let raf = 0;
    let cleanup = () => {};
    (async () => {
      let s: Scenery;
      let renderer: THREE.WebGLRenderer;
      let world: World;
      try {
        s = await loadScenery(circuit);
        if (stop) return;
        setName(s.name);
        renderer = new THREE.WebGLRenderer({
          canvas: el,
          antialias: false,
          powerPreference: 'high-performance',
        });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        world = await buildWorld(s, renderer.capabilities.getMaxAnisotropy());
        if (stop) {
          world.dispose();
          renderer.dispose();
          return;
        }
      } catch (e) {
        console.error('3D view', e);
        setStatus('failed');
        onFail?.();
        return;
      }
      renderer.toneMappingExposure = world.exposure;
      const race = s.races[raceId] ?? s.races[Object.keys(s.races)[0] as string];
      if (!race) {
        setStatus('failed');
        onFail?.();
        return;
      }
      const scene = world.scene;
      const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 60000);
      // IBL from the sky: everything picks up the sky's light and colour.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const skyCopy = world.sky.clone();
      skyCopy.scale.setScalar(50);
      envScene.add(skyCopy);
      const env = pmrem.fromScene(envScene, 0.02).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.4;

      // Post: ambient occlusion, bloom at night, then tone mapping and anti-aliasing.
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
      if (world.floodlit)
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.92));
      composer.addPass(new OutputPass());
      const smaa = new SMAAPass(1, 1);
      composer.addPass(smaa);

      const controls = new OrbitControls(camera, el);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 15;
      controls.maxDistance = world.radius * 5;
      const home = () => {
        const c = world.centre;
        const d = world.radius * 1.55;
        camera.position.set(c.x + d * 0.62, c.y + d * 0.78, c.z + d * 0.86);
        controls.target.copy(c);
        controls.update();
      };
      home();

      const size = () => {
        const w = box.clientWidth;
        const h = box.clientHeight;
        if (!w || !h) return;
        const pr = Math.min(devicePixelRatio, live.current.main ? quality.ratio : 1);
        renderer.setPixelRatio(pr);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(pr);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const quality = { ratio: 2, ao: true };
      const ro = new ResizeObserver(size);
      ro.observe(box);
      size();

      // Cars.
      const garage = new Garage();
      const cars = new Map<
        string,
        { obj: THREE.Group; color: string; tyre: string; last: THREE.Vector3; yaw: number }
      >();
      const sc = safetyCar();
      sc.visible = false;
      scene.add(sc);
      const placeOf = (
        code: string,
        feed: MapFeed,
      ): { pos: THREE.Vector3; yaw: number | null } | null => {
        const p = feed.places.get(code);
        if (!p) return null;
        if (p.lane || p.out !== undefined) {
          const [x, z] = toWorld(race, p.x, p.y);
          return { pos: new THREE.Vector3(x, world.heightAt(x, z) + 0.24, z), yaw: null };
        }
        const q = world.lapAt(lapIndex(race, world.lapCount, p.at));
        return { pos: new THREE.Vector3(q.x, q.y, q.z), yaw: Math.atan2(q.tz, q.tx) };
      };

      // Clicking a car opens its card.
      const ray = new THREE.Raycaster();
      let downAt: [number, number] | null = null;
      const onDown = (e: PointerEvent) => {
        downAt = [e.clientX, e.clientY];
      };
      const onUp = (e: PointerEvent) => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
        const r = el.getBoundingClientRect();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -((e.clientY - r.top) / r.height) * 2 + 1,
          ),
          camera,
        );
        let best: [string, number] | null = null;
        for (const [code, c] of cars) {
          const hit = ray.intersectObject(c.obj, true)[0];
          if (hit && (!best || hit.distance < best[1])) best = [code, hit.distance];
        }
        if (best) live.current.onSelect?.(best[0]);
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);

      // Cameras.
      const camPos = new THREE.Vector3().copy(camera.position);
      const camLook = new THREE.Vector3().copy(controls.target);
      let lastMode: CameraMode | 'battle' = 'overview';
      let tvSpot: THREE.Vector3 | null = null;
      let tvSince = 0;
      const head = new THREE.Vector3(1, 0, 0);
      const tmp = new THREE.Vector3();
      let youColor = cssVar('--you', '#19c7b4');
      let rivalColor = cssVar('--rival', '#f2a13a');
      let colourCheck = 0;
      const frameTimes: number[] = [];
      let last = performance.now();
      let frameNo = 0;
      let devFrozen = false;
      if (import.meta.env.DEV) {
        // Local testing: scripts can point the camera (docs/3d-spec.md, screenshots).
        (window as unknown as Record<string, unknown>).__scene3d = {
          camera,
          controls,
          world,
          cars,
          THREE,
          freeze: (on: boolean) => {
            devFrozen = on;
          },
        };
      }
      setStatus('ready');
      onReady?.(s.name);

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = now - last;
        last = now;
        frameNo++;
        const { main: isMain, mode: want } = live.current;
        if (!isMain && frameNo % 3) return;
        const feed = feedRef.current;
        if (now - colourCheck > 1000) {
          colourCheck = now;
          youColor = cssVar('--you', youColor);
          rivalColor = cssVar('--rival', rivalColor);
        }
        // cars
        let you: THREE.Vector3 | null = null;
        let other: THREE.Vector3 | null = null;
        const seen = new Set<string>();
        if (feed && !devFrozen) {
          for (const code of feed.places.keys()) {
            const at = placeOf(code, feed);
            if (!at) continue;
            seen.add(code);
            const color =
              code === feed.userSide
                ? youColor
                : code === feed.rival
                  ? rivalColor
                  : (TEAM_COLOR[feed.team.get(code) ?? ''] ?? '#b6babd');
            const tyre = TYRE[feed.compound.get(code) ?? ''] ?? '#888888';
            let c = cars.get(code);
            if (!c) {
              const obj = garage.car(color, tyre);
              scene.add(obj);
              c = { obj, color, tyre, last: at.pos.clone(), yaw: at.yaw ?? 0 };
              cars.set(code, c);
            } else if (c.color !== color || c.tyre !== tyre) {
              garage.dress(c.obj, color, tyre);
              c.color = color;
              c.tyre = tyre;
            }
            let yaw = at.yaw;
            if (yaw === null) {
              const dx = at.pos.x - c.last.x;
              const dz = at.pos.z - c.last.z;
              yaw = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dz, dx) : c.yaw;
            }
            c.obj.position.copy(at.pos);
            c.obj.rotation.set(0, -yaw, 0);
            c.last.copy(at.pos);
            c.yaw = yaw;
            const out = feed.places.get(code)?.out !== undefined;
            c.obj.rotation.z = out ? 0.05 : 0;
            if (code === feed.userSide) you = at.pos;
            if (feed.battle?.codes.includes(code) && code !== feed.userSide) other = at.pos;
          }
          // the safety car, just ahead of the leader
          if (feed.sc !== null) {
            const q = world.lapAt(lapIndex(race, world.lapCount, feed.sc));
            sc.visible = true;
            sc.position.set(q.x, q.y, q.z);
            sc.rotation.set(0, -Math.atan2(q.tz, q.tx), 0);
          } else sc.visible = false;
        }
        for (const [code, c] of cars) {
          if (!devFrozen && !seen.has(code)) {
            scene.remove(c.obj);
            cars.delete(code);
          }
        }

        // camera
        const battle = feed?.battle && you && other ? 'battle' : null;
        const m: CameraMode | 'battle' = battle ?? want;
        if (m !== lastMode) {
          if (m === 'overview') home();
          tvSpot = null;
          lastMode = m;
        }
        controls.enabled = m === 'overview';
        if (m === 'overview') {
          controls.update();
        } else if (you) {
          // A lap takes seconds, so the cars run at hundreds of m/s: the cameras are locked to
          // the car (no lag) and look from far enough out to read the track.
          const focus = m === 'battle' && other ? tmp.copy(you).lerp(other, 0.5) : you;
          const c = cars.get(feed?.userSide ?? '');
          const yaw = c?.yaw ?? 0;
          head
            .lerp(new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), Math.min(1, dt / 260))
            .normalize();
          if (m === 'follow' || m === 'battle') {
            const spread = m === 'battle' && other ? Math.min(220, you.distanceTo(other)) : 0;
            const back = 70 + spread * 0.9;
            const side = new THREE.Vector3(-head.z, 0, head.x);
            camPos
              .copy(focus)
              .addScaledVector(head, -back)
              .addScaledVector(side, 14 + spread * 0.3);
            camPos.y = focus.y + 30 + spread * 0.45;
            const ground = world.heightAt(camPos.x, camPos.z) + 8;
            if (camPos.y < ground) camPos.y = ground;
            camLook.copy(focus).addScaledVector(head, 35);
            camera.fov += (48 - camera.fov) * 0.2;
          } else {
            // TV: a high camera near where the car is about to be; each shot held a while
            const p = feed?.places.get(feed.userSide);
            const ahead = p ? world.lapAt(lapIndex(race, world.lapCount, p.at + 0.05)) : null;
            const target = ahead ? new THREE.Vector3(ahead.x, ahead.y, ahead.z) : focus;
            const far = tvSpot ? tvSpot.distanceTo(focus) : Number.POSITIVE_INFINITY;
            if (!tvSpot || (now - tvSince > 2600 && far > 260) || far > 1200) {
              let best = world.tv[0] as THREE.Vector3;
              let bd = Number.POSITIVE_INFINITY;
              for (const t of world.tv) {
                const d = t.distanceTo(target);
                if (d < bd) {
                  bd = d;
                  best = t;
                }
              }
              if (best !== tvSpot) {
                tvSpot = best;
                tvSince = now;
                camLook.copy(focus);
              }
            }
            camPos.copy(tvSpot as THREE.Vector3);
            camLook.lerp(focus, 0.5);
            const fov = THREE.MathUtils.clamp(2400 / (camPos.distanceTo(focus) + 40), 5, 42);
            camera.fov += (fov - camera.fov) * 0.25;
          }
          camera.updateProjectionMatrix();
          camera.position.copy(camPos);
          camera.lookAt(camLook);
        }
        if (m === 'overview') {
          camPos.copy(camera.position);
          camLook.copy(controls.target);
          if (Math.abs(camera.fov - 38) > 0.1) {
            camera.fov = 38;
            camera.updateProjectionMatrix();
          }
        }

        // cars grow with distance so they read from the overview
        const focus = m === 'overview' ? controls.target : camLook;
        const dist = camera.position.distanceTo(focus);
        const grow = THREE.MathUtils.clamp(dist / 150, 1, 14);
        for (const [code, c] of cars) {
          const [sx, sy, sz] = PROPORTIONS[feed?.shapes?.[code] ?? ''] ?? [1, 1, 1];
          c.obj.scale.set(grow * sx, grow * sy, grow * sz);
        }
        sc.scale.setScalar(grow);

        // shadows follow the view
        const half = THREE.MathUtils.clamp(dist * 0.75, 70, world.radius * 1.4);
        const sh = world.sun.shadow.camera;
        sh.left = -half;
        sh.right = half;
        sh.top = half;
        sh.bottom = -half;
        sh.near = 10;
        sh.far = half * 6 + 2000;
        sh.updateProjectionMatrix();
        world.sun.target.position.copy(focus);
        world.sun.position.copy(focus).addScaledVector(world.sunDir, half * 3 + 800);

        // draw
        gtao.enabled = isMain && quality.ao;
        if (isMain) composer.render();
        else renderer.render(scene, camera);

        // name tags (the two main cars' move apart when they're side by side)
        const place = (el2: HTMLDivElement | null, p: THREE.Vector3 | null, text: string) => {
          if (!el2) return null;
          if (!p || !isMain) {
            el2.hidden = true;
            return null;
          }
          const q = tmp
            .copy(p)
            .add(new THREE.Vector3(0, 1.6 * grow + 1.2, 0))
            .project(camera);
          const vis = q.z < 1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05;
          el2.hidden = !vis;
          if (!vis) return null;
          el2.textContent = text;
          return {
            el: el2,
            x: ((q.x + 1) / 2) * box.clientWidth,
            y: ((1 - q.y) / 2) * box.clientHeight,
          };
        };
        const show = (t: { el: HTMLDivElement; x: number; y: number } | null) => {
          if (t)
            t.el.style.transform = `translate(${t.x.toFixed(0)}px,${t.y.toFixed(0)}px) translate(-50%,-100%)`;
        };
        const youTag = place(
          tagYou.current,
          feed ? (cars.get(feed.userSide)?.obj.position ?? null) : null,
          feed?.userSide ?? '',
        );
        const rivalTag = place(
          tagRival.current,
          feed ? (cars.get(feed.rival)?.obj.position ?? null) : null,
          feed?.rival ?? '',
        );
        if (youTag && rivalTag && Math.hypot(youTag.x - rivalTag.x, youTag.y - rivalTag.y) < 56) {
          const d = rivalTag.x >= youTag.x ? 30 : -30;
          youTag.x -= d;
          rivalTag.x += d;
        }
        show(youTag);
        show(rivalTag);
        const sel =
          feed?.selected && feed.selected !== feed.userSide && feed.selected !== feed.rival
            ? feed.selected
            : null;
        show(place(tagSel.current, sel ? (cars.get(sel)?.obj.position ?? null) : null, sel ?? ''));

        // quality: drop the occlusion, then resolution, if frames run slow
        if (isMain) {
          frameTimes.push(dt);
          if (frameTimes.length > 120) frameTimes.shift();
          if (frameTimes.length === 120) {
            const avg = frameTimes.reduce((a, b) => a + b, 0) / 120;
            if (avg > 24 && quality.ao) {
              quality.ao = false;
              frameTimes.length = 0;
            } else if (avg > 24 && quality.ratio > 1) {
              quality.ratio = 1;
              frameTimes.length = 0;
              size();
            }
          }
        }
      };
      raf = requestAnimationFrame(loop);
      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointerup', onUp);
        controls.dispose();
        composer.dispose();
        env.dispose();
        pmrem.dispose();
        world.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [circuit, raceId, feedRef, onReady, onFail]);

  return (
    <div ref={host} className="absolute inset-0 overflow-hidden bg-[#0d1110]">
      <canvas
        ref={canvas}
        className="block h-full w-full"
        aria-label={`3D view of ${name || 'the circuit'}`}
      />
      <div
        ref={tagYou}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-10 rounded px-1.5 py-0.5 text-[12px] font-black text-[var(--you-ink)]"
        style={{ background: 'var(--you)' }}
      />
      <div
        ref={tagRival}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-10 rounded px-1.5 py-0.5 text-[12px] font-black text-[var(--rival-ink)]"
        style={{ background: 'var(--rival)' }}
      />
      <div
        ref={tagSel}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-10 rounded bg-[var(--ink)] px-1.5 py-0.5 text-[12px] font-black text-[var(--paper)]"
      />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-[13px] font-bold text-[var(--muted)]">
          Building the circuit in 3D…
        </div>
      )}
      {main && status === 'ready' && (
        <span className="pointer-events-none absolute bottom-1.5 right-2 z-10 text-[10px] font-semibold text-white/80 [text-shadow:0_1px_2px_#000]">
          © OpenStreetMap contributors · Elevation: Mapzen
        </span>
      )}
    </div>
  );
}

// The Gauntlet's set piece: a floodlit straight at night, seen from just behind your car. A
// gantry spans the track for every round, numbered, and the next one ahead carries the round's
// signal lamps. The lobby shows the car under round 1's amber lamps; after a win the car drives
// under the gantry it just won (its lamps go green) and the next one comes up and lights amber;
// when the run ends, that round's lamps go red and the floodlights go out one by one.
// Everything on the ground is drawn in the vanishing point's coordinates at its depth `s`
// (1 = the nearest gantry), so driving one round down the straight is one scale of the whole
// world about the vanishing point: by 1/STEP, which maps each gantry onto the one before and the
// kerb stripes onto themselves. The `fl-` classes in index.css animate it; anyone who asks for
// less motion gets the end of each move without it.

import type { CSSProperties } from 'react';
import { RearCar } from './RearCar.js';

export type StraightState = 'idle' | 'advance' | 'out';

const W = 1600;
const H = 900;
const VP = { x: 800, y: 380 };
/** One kerb stripe's depth ratio, and one round's: four stripes, so the colours line up. */
const STRIPE = 0.85;
const STEP = STRIPE ** 4;
const GANTRIES = 7;
const ROAD = 410;
const KERB = 450;
const WALL = 476;
const GROUND = 300;

const AMBER = '#FFB347';
const GREEN = '#3DDC84';
const RED = '#FF3B2F';
const FONT = '"Saira Extra Condensed", "Inter Tight", sans-serif';

/** A point on the ground at depth `s`, `x` out from the centre line. */
const at = (s: number, x: number, up = 0) =>
  `${(x * s).toFixed(1)},${((GROUND - up) * s).toFixed(1)}`;

const quad = (s0: number, s1: number, x0: number, x1: number, up0 = 0, up1 = 0) =>
  `M${at(s0, x0, up0)} L${at(s0, x1, up1)} L${at(s1, x1, up1)} L${at(s1, x0, up0)} Z`;

const NEAR = 2.1;
const FAR = 0.012;
const STRIPES: number[] = [];
for (let s = NEAR; s > FAR; s *= STRIPE) STRIPES.push(s);

/** Deterministic specks: the stars and the grandstand's lights. */
function specks(n: number, seed: number, x0: number, x1: number, y0: number, y1: number) {
  let v = seed;
  const next = () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
  return Array.from({ length: n }, () => ({
    x: x0 + next() * (x1 - x0),
    y: y0 + next() * (y1 - y0),
    r: 0.6 + next() * 1.2,
    o: 0.25 + next() * 0.6,
  }));
}
const STARS = specks(70, 7, 0, W, 0, 300);
const CROWD_L = specks(90, 11, 0, 640, 304, 352);
const CROWD_R = specks(90, 23, 960, W, 304, 352);

type Lamp = 'next' | 'dim' | 'won' | 'lost' | 'on';
const LAMP: Record<Lamp, string> = {
  next: AMBER,
  on: AMBER,
  dim: '#3A3222',
  won: GREEN,
  lost: RED,
};

const FLOODS = [-410, -300, -190, 190, 300, 410];

function Gantry({
  round,
  lamp,
  dark,
  darkDelay,
}: {
  round: number;
  lamp: Lamp;
  dark: boolean;
  darkDelay: number;
}) {
  const colour = LAMP[lamp];
  const lit = lamp !== 'dim';
  const fade = dark ? { className: 'fl-blackout', style: { animationDelay: `${darkDelay}s` } } : {};
  return (
    <g>
      {/* The floodlights' pools on the asphalt and their cones. */}
      <g {...fade}>
        <ellipse cx={0} cy={GROUND} rx={430} ry={58} fill="url(#fl-pool)" />
        {FLOODS.map((x) => (
          <path
            key={x}
            d={`M${x - 16},-186 L${x + 16},-186 L${x * 0.6 + 110},${GROUND} L${x * 0.6 - 110},${GROUND} Z`}
            fill="url(#fl-cone)"
          />
        ))}
      </g>
      {/* The posts, braced, standing behind the fence. */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <rect x={side * 500 - 12} y={-250} width={24} height={250 + GROUND} fill="#222842" />
          <rect x={side * 500 - 12} y={-250} width={5} height={250 + GROUND} fill="#39406A" />
          <path
            d={`M${side * 500 - 12},-180 L${side * 500 + 12},-110 M${side * 500 + 12},-110 L${side * 500 - 12},-40 M${side * 500 - 12},-40 L${side * 500 + 12},30`}
            stroke="#39406A"
            strokeWidth={3}
          />
        </g>
      ))}
      {/* The truss: two chords and their diagonals. */}
      <rect x={-524} y={-256} width={1048} height={9} fill="#2B3254" />
      <rect x={-524} y={-214} width={1048} height={9} fill="#222842" />
      <path
        d={Array.from({ length: 26 }, (_, i) => {
          const x = -520 + i * 40;
          return `M${x},-248 L${x + 20},-214 L${x + 40},-248`;
        }).join(' ')}
        stroke="#2B3254"
        strokeWidth={3}
        fill="none"
      />
      {/* Floodlight housings and their glow. */}
      {FLOODS.map((x) => (
        <g key={x}>
          <rect x={x - 26} y={-206} width={52} height={18} rx={3} fill="#151A2C" />
          <g {...fade}>
            <rect x={x - 22} y={-190} width={44} height={4} rx={2} fill="#FFF4DC" />
            <circle cx={x} cy={-186} r={96} fill="url(#fl-glow)" />
          </g>
        </g>
      ))}
      {/* The round board and its signal lamps. */}
      <rect x={-120} y={-300} width={240} height={74} rx={4} fill="#080B16" />
      <rect
        x={-120}
        y={-300}
        width={240}
        height={74}
        rx={4}
        fill="none"
        stroke={lit ? colour : '#39406A'}
        strokeWidth={3}
      />
      <text
        x={0}
        y={-283}
        textAnchor="middle"
        fontFamily={FONT}
        fontWeight={700}
        fontSize={15}
        letterSpacing={4}
        fill="#7F88A3"
      >
        ROUND
      </text>
      <text
        x={0}
        y={-235}
        textAnchor="middle"
        fontFamily={FONT}
        fontWeight={900}
        fontSize={50}
        fill={lit ? colour : '#C9CEDD'}
      >
        {round}
      </text>
      <g className={lamp === 'on' ? 'fl-lamp-on' : undefined}>
        {[-60, -20, 20, 60].map((x) => (
          <g key={x}>
            {lit && <circle cx={x} cy={-196} r={30} fill={colour} opacity={0.22} />}
            <circle cx={x} cy={-196} r={13} fill="#05070D" />
            <circle cx={x} cy={-196} r={10} fill={colour} />
          </g>
        ))}
      </g>
    </g>
  );
}

export function Straight({
  next,
  state,
  tyre = '#F4C430',
  label,
  className = '',
}: {
  /** The round of the nearest gantry ahead: the one to race for (or, when `out`, the one lost). */
  next: number;
  state: StraightState;
  tyre?: string;
  label: string;
  className?: string;
}) {
  // Advancing starts a round back, under the gantry just won, and drives one round on.
  const first = state === 'advance' ? next - 1 : next;
  const lampFor = (k: number): Lamp => {
    if (state === 'idle') return k === 0 ? 'next' : 'dim';
    if (state === 'out') return k === 0 ? 'lost' : 'dim';
    if (k === 0) return 'won';
    return k === 1 ? 'on' : 'dim';
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={label}
      className={className}
    >
      <defs>
        <linearGradient id="fl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040A" />
          <stop offset="0.3" stopColor="#081028" />
          <stop offset="0.42" stopColor="#18224A" />
          <stop offset="0.43" stopColor="#05070D" />
          <stop offset="1" stopColor="#05070D" />
        </linearGradient>
        <linearGradient id="fl-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151A2A" />
          <stop offset="1" stopColor="#0B0D14" />
        </linearGradient>
        <radialGradient id="fl-haze" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={AMBER} stopOpacity={0.35} />
          <stop offset="1" stopColor={AMBER} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="fl-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFC46B" stopOpacity={0.34} />
          <stop offset="1" stopColor="#FFC46B" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="fl-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE2B0" stopOpacity={0.16} />
          <stop offset="1" stopColor="#FFE2B0" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="fl-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF4DC" stopOpacity={0.95} />
          <stop offset="0.2" stopColor="#FFC46B" stopOpacity={0.5} />
          <stop offset="1" stopColor={AMBER} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="fl-rain" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={RED} stopOpacity={0.9} />
          <stop offset="1" stopColor={RED} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="fl-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5E0202" />
          <stop offset="0.45" stopColor="#C80B0B" />
          <stop offset="0.52" stopColor="#FF4A3D" />
          <stop offset="1" stopColor="#5E0202" />
        </linearGradient>
        <pattern id="fl-mesh" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0,0 L14,14 M14,0 L0,14" stroke="#7F88A3" strokeWidth={0.6} />
        </pattern>
      </defs>

      {/* The night sky, its stars, and the grandstands either side of the far end. */}
      <rect width={W} height={H} fill="url(#fl-sky)" />
      {STARS.map((p) => (
        <circle
          key={`${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r={p.r * 0.8}
          fill="#DDE3F5"
          opacity={p.o * 0.6}
        />
      ))}
      <path d="M0,382 L0,296 L240,286 L520,314 L700,352 L700,382 Z" fill="#070A15" />
      <path d="M1600,382 L1600,292 L1360,284 L1080,314 L900,352 L900,382 Z" fill="#070A15" />
      <path d="M0,296 L240,286 L520,314 L700,352" fill="none" stroke="#1E2647" strokeWidth={2} />
      <path
        d="M1600,292 L1360,284 L1080,314 L900,352"
        fill="none"
        stroke="#1E2647"
        strokeWidth={2}
      />
      {[...CROWD_L, ...CROWD_R].map((p) => (
        <circle
          key={`${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill="#FFD9A0"
          opacity={p.o * 0.5}
        />
      ))}
      <ellipse cx={VP.x} cy={VP.y} rx={520} ry={90} fill="url(#fl-haze)" />

      {/* The world, in the vanishing point's coordinates. */}
      <g transform={`translate(${VP.x} ${VP.y})`}>
        <g
          className={state === 'advance' ? 'fl-world fl-advance' : 'fl-world'}
          style={{ '--fl-step': `${1 / STEP}` } as CSSProperties}
        >
          {/* Run-off, the walls and the catch fence. */}
          <path d={quad(NEAR, FAR, -WALL, -KERB)} fill="#0C1019" />
          <path d={quad(NEAR, FAR, KERB, WALL)} fill="#0C1019" />
          <path d={quad(NEAR, FAR, -WALL, -WALL, 0, 46)} fill="#2A3048" />
          <path d={quad(NEAR, FAR, WALL, WALL, 0, 46)} fill="#2A3048" />
          <path
            d={`M${at(NEAR, -WALL, 46)} L${at(FAR, -WALL, 46)} L${at(FAR, -WALL, 190)} L${at(NEAR, -WALL, 190)} Z`}
            fill="url(#fl-mesh)"
            opacity={0.35}
          />
          <path
            d={`M${at(NEAR, WALL, 46)} L${at(FAR, WALL, 46)} L${at(FAR, WALL, 190)} L${at(NEAR, WALL, 190)} Z`}
            fill="url(#fl-mesh)"
            opacity={0.35}
          />
          {STRIPES.filter((_, i) => i % 2 === 0).map((s) => (
            <path
              key={s}
              d={`M${at(s, -WALL, 46)} L${at(s, -WALL, 196)} M${at(s, WALL, 46)} L${at(s, WALL, 196)}`}
              stroke="#4A5278"
              strokeWidth={Math.max(0.6, 5 * s)}
            />
          ))}
          {/* The asphalt, the rubbered-in racing line, the white edge lines and the kerbs. */}
          <path d={quad(NEAR, FAR, -ROAD, ROAD)} fill="url(#fl-road)" />
          <path d={quad(NEAR, FAR, -150, 70)} fill="#05060A" opacity={0.35} />
          <path d={quad(NEAR, FAR, -ROAD, -ROAD + 12)} fill="#E8E2D6" opacity={0.7} />
          <path d={quad(NEAR, FAR, ROAD - 12, ROAD)} fill="#E8E2D6" opacity={0.7} />
          {STRIPES.slice(0, -1).map((s, i) => (
            <g key={s} fill={i % 2 ? '#E8E2D6' : '#C81E1E'} opacity={0.75}>
              <path d={quad(s, s * STRIPE, -KERB, -ROAD)} />
              <path d={quad(s, s * STRIPE, ROAD, KERB)} />
            </g>
          ))}
          {/* The gantries, furthest first; gantry k stands at depth STEP^k. */}
          {Array.from({ length: GANTRIES }, (_, i) => GANTRIES - 1 - i).map((k) => (
            <g
              key={first + k}
              transform={`scale(${STEP ** k})`}
              className={state === 'advance' && k === 0 ? 'fl-passed' : undefined}
            >
              <Gantry
                round={first + k}
                lamp={lampFor(k)}
                dark={state === 'out'}
                darkDelay={0.6 + k * 0.35}
              />
            </g>
          ))}
        </g>
      </g>

      {/* Your car, heading in. */}
      <g transform={`translate(${VP.x} ${H - 22}) scale(1.08)`}>
        <g className={state === 'advance' ? 'fl-shake' : undefined}>
          <RearCar tyre={tyre} light={state === 'out' ? 'blink' : 'on'} />
        </g>
      </g>
    </svg>
  );
}

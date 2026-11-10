// The era map's backdrops (EraMap.tsx): one cartoon scene per era, flat shapes with bold
// outlines, drawn inline. Every car, helmet, trophy and board here is generic: no team, livery,
// sponsor, logo or driver. Each scene is a 1000 × 260 panorama cropped to the band
// (`xMidYMid slice`), so the middle (x 280–720) carries the theme on a phone and the sides fill
// in on a wide screen. Decorative only: hidden from screen readers.

import type { ReactNode } from 'react';

const OL = '#1c1b29';
const W = 4;

type CarStyle = 'modern' | 'noughties' | 'retro';

/** A generic single-seater, side on, facing right; (x, y) is where the wheels meet the ground. */
function Car({
  x,
  y,
  s = 1,
  color,
  helmet = '#ffffff',
  style = 'modern',
  flip = false,
  bigTyres = false,
}: {
  x: number;
  y: number;
  s?: number;
  color: string;
  helmet?: string;
  style?: CarStyle;
  flip?: boolean;
  bigTyres?: boolean;
}) {
  const body =
    style === 'retro'
      ? 'M6 -14 L6 -36 L70 -40 L98 -52 L118 -52 L126 -40 L228 -26 L228 -14 Z'
      : style === 'noughties'
        ? 'M8 -14 L8 -32 L62 -36 L96 -56 L112 -56 L122 -42 L152 -40 L226 -32 L230 -24 L150 -20 L150 -14 Z'
        : 'M8 -14 L8 -30 L60 -34 L95 -54 L112 -54 L122 -40 L150 -38 L230 -22 L230 -14 Z';
  const rear = style === 'retro' ? 24 : bigTyres ? 23 : 20;
  const front = style === 'retro' ? 19 : bigTyres ? 22 : 20;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    >
      {style === 'retro' ? (
        <>
          <path d="M18 -36 L18 -66" />
          <rect x={-6} y={-84} width={52} height={18} rx={3} fill={color} />
          <rect x={-10} y={-90} width={8} height={30} rx={2} fill={OL} />
        </>
      ) : (
        <>
          <path d="M16 -30 L16 -58" />
          <rect x={0} y={-70} width={36} height={13} rx={3} fill={color} />
          <rect x={-4} y={-74} width={7} height={24} rx={2} fill={OL} />
        </>
      )}
      <path d={body} fill={color} />
      <path d="M60 -26 L140 -26" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={5} />
      <circle cx={130} cy={-46} r={11} fill={helmet} />
      <path d="M128 -50 L142 -50" stroke={OL} strokeWidth={5} strokeLinecap="round" />
      {style === 'modern' && <path d="M112 -44 Q132 -66 152 -40" fill="none" strokeWidth={5} />}
      {style === 'noughties' ? (
        <>
          <path d="M206 -28 L206 -12" />
          <rect x={188} y={-14} width={50} height={8} rx={2} fill={color} />
        </>
      ) : (
        <rect
          x={style === 'retro' ? 194 : 200}
          y={-16}
          width={style === 'retro' ? 46 : 38}
          height={style === 'retro' ? 10 : 8}
          rx={2}
          fill={color}
        />
      )}
      <Wheel cx={46} r={rear} cover={style === 'modern'} />
      <Wheel cx={180} r={front} cover={style === 'modern'} />
    </g>
  );
}

function Wheel({ cx, r, cover }: { cx: number; r: number; cover: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={-r} r={r} fill="#2a2933" />
      <circle
        cx={cx}
        cy={-r}
        r={cover ? r * 0.72 : r * 0.42}
        fill={cover ? '#4b4a57' : '#c9c7d6'}
        strokeWidth={3}
      />
    </g>
  );
}

/** A tyre, face on, with its coloured sidewall band. */
function Tyre({
  x,
  y,
  r = 26,
  band,
  grooves = false,
  worn = false,
}: {
  x: number;
  y: number;
  r?: number;
  band: string;
  grooves?: boolean;
  worn?: boolean;
}) {
  return (
    <g stroke={OL} strokeWidth={W}>
      <circle cx={x} cy={y} r={r} fill="#2a2933" />
      <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke={band} strokeWidth={r * 0.14} />
      <circle cx={x} cy={y} r={r * 0.38} fill="#c9c7d6" strokeWidth={3} />
      {grooves && (
        <circle
          cx={x}
          cy={y}
          r={r * 0.88}
          fill="none"
          stroke="#55536a"
          strokeWidth={2}
          strokeDasharray="6 5"
        />
      )}
      {worn && (
        <path
          d={`M${x - r * 0.8} ${y - r * 0.55} l6 4 M${x + r * 0.7} ${y + r * 0.6} l-5 -5`}
          stroke="#8c8aa0"
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

/** A tyre seen from the side, stacked: `n` high. */
function TyreStack({ x, y, n, band }: { x: number; y: number; n: number; band: string }) {
  return (
    <g stroke={OL} strokeWidth={W}>
      {[0, 1, 2, 3, 4, 5].slice(0, n).map((i) => (
        <g key={i}>
          <rect x={x} y={y - (i + 1) * 20} width={64} height={20} rx={8} fill="#2a2933" />
          <path d={`M${x + 8} ${y - i * 20 - 10} L${x + 56} ${y - i * 20 - 10}`} stroke={band} />
        </g>
      ))}
    </g>
  );
}

function Flag({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const squares: ReactNode[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      if ((r + c) % 2 === 0)
        squares.push(
          <rect key={`${r}-${c}`} x={6 + c * 11} y={-70 + r * 10} width={11} height={10} />,
        );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={OL} strokeWidth={W}>
      <path d="M4 0 L4 -74" strokeLinecap="round" />
      <rect x={6} y={-70} width={44} height={30} fill="#ffffff" />
      <g fill={OL} stroke="none">
        {squares}
      </g>
      <rect x={6} y={-70} width={44} height={30} fill="none" />
    </g>
  );
}

function Grandstand({
  x,
  y,
  w,
  roof,
  seats,
}: { x: number; y: number; w: number; roof: string; seats: string[] }) {
  const dots: ReactNode[] = [];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i * 18 + 14 < w; i++)
      dots.push(
        <circle
          key={`${row}-${i}`}
          cx={x + 12 + i * 18 + (row % 2) * 9}
          cy={y - 16 - row * 16}
          r={5}
          fill={seats[(i + row) % seats.length]}
        />,
      );
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <path d={`M${x} ${y} L${x} ${y - 56} L${x + w} ${y - 56} L${x + w} ${y} Z`} fill="#e8e4f4" />
      <g strokeWidth={2}>{dots}</g>
      <path
        d={`M${x - 10} ${y - 62} L${x + w + 10} ${y - 72} L${x + w + 10} ${y - 84} L${x - 10} ${y - 74} Z`}
        fill={roof}
      />
      <path
        d={`M${x + 4} ${y - 62} L${x + 4} ${y - 74} M${x + w - 4} ${y - 64} L${x + w - 4} ${y - 80}`}
      />
    </g>
  );
}

/** The track: tarmac, a white edge and a kerb. */
function Track({ y = 196, kerb = ['#ff5a5f', '#ffffff'] }: { y?: number; kerb?: string[] }) {
  const stripes: ReactNode[] = [];
  for (let i = 0; i < 50; i++)
    stripes.push(
      <rect key={i} x={i * 20} y={y - 8} width={20} height={8} fill={kerb[i % kerb.length]} />,
    );
  return (
    <g>
      <rect x={0} y={y} width={1000} height={260 - y} fill="#4a4858" />
      <g stroke={OL} strokeWidth={2}>
        {stripes}
      </g>
      <path d={`M0 ${y} L1000 ${y}`} stroke={OL} strokeWidth={W} />
      <path
        d={`M0 ${y + 34} L1000 ${y + 34}`}
        stroke="#ffffff"
        strokeOpacity={0.5}
        strokeWidth={4}
        strokeDasharray="30 24"
      />
    </g>
  );
}

function Sky({ id, top, bottom }: { id: string; top: string; bottom: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1000} height={260} fill={`url(#${id})`} />
    </>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 0 a16 16 0 0 1 20 -18 a22 22 0 0 1 40 -4 a16 16 0 0 1 24 22 Z"
      fill="#ffffff"
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    />
  );
}

function Hills({ color, y = 196 }: { color: string; y?: number }) {
  return (
    <path
      d={`M0 ${y} L0 ${y - 40} Q120 ${y - 90} 240 ${y - 46} T480 ${y - 52} T720 ${y - 40} T1000 ${y - 56} L1000 ${y} Z`}
      fill={color}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    />
  );
}

function Trophy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    >
      <path d="M-16 -62 Q-30 -62 -28 -50 Q-26 -40 -12 -40" fill="none" />
      <path d="M16 -62 Q30 -62 28 -50 Q26 -40 12 -40" fill="none" />
      <path d="M-18 -66 L18 -66 Q18 -32 0 -28 Q-18 -32 -18 -66 Z" fill="#ffd23f" />
      <path d="M-4 -28 L4 -28 L6 -14 L-6 -14 Z" fill="#ffd23f" />
      <rect x={-16} y={-14} width={32} height={14} rx={2} fill="#7a5230" />
    </g>
  );
}

function Helmet({ x, y, color, s = 1 }: { x: number; y: number; color: string; s?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    >
      <path d="M-30 0 L-30 -26 Q-30 -56 0 -56 Q32 -56 32 -22 L32 0 Z" fill={color} />
      <path d="M-6 -36 L30 -36 L30 -20 L-2 -20 Q-8 -28 -6 -36 Z" fill="#3a3f6b" />
      <path d="M-24 -10 L24 -10" stroke="#ffffff" strokeOpacity={0.6} />
    </g>
  );
}

function Bolt({
  x,
  y,
  s = 1,
  color = '#ffe14d',
}: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M6 -40 L-12 -6 L0 -6 L-6 20 L14 -16 L2 -16 Z"
      fill={color}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    />
  );
}

function Battery({ x, y, level = 3 }: { x: number; y: number; level?: number }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <rect x={x} y={y - 40} width={70} height={40} rx={6} fill="#ffffff" />
      <rect x={x + 70} y={y - 28} width={8} height={16} rx={2} fill={OL} />
      {[0, 1, 2].slice(0, level).map((i) => (
        <rect
          key={i}
          x={x + 8 + i * 20}
          y={y - 32}
          width={14}
          height={24}
          rx={2}
          fill="#3ee08f"
          strokeWidth={2}
        />
      ))}
    </g>
  );
}

function FuelRig({
  x,
  y,
  color = '#ff8a3d',
  reach = 120,
}: { x: number; y: number; color?: string; reach?: number }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <rect x={x} y={y - 120} width={44} height={120} rx={6} fill={color} />
      <rect x={x + 8} y={y - 106} width={28} height={22} rx={3} fill="#fff6d6" />
      <path d={`M${x + 14} ${y - 96} L${x + 30} ${y - 96}`} strokeWidth={3} />
      <path
        d={`M${x + 44} ${y - 70} C${x + 44 + reach * 0.5} ${y - 130} ${x + reach} ${y - 90} ${x + reach} ${y - 50}`}
        fill="none"
        strokeWidth={9}
      />
      <path
        d={`M${x + 44} ${y - 70} C${x + 44 + reach * 0.5} ${y - 130} ${x + reach} ${y - 90} ${x + reach} ${y - 50}`}
        fill="none"
        stroke="#3a3a48"
        strokeWidth={4}
      />
      <rect x={x + reach - 10} y={y - 54} width={20} height={16} rx={3} fill="#c9c7d6" />
    </g>
  );
}

function PitBoard({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <path d={`M${x + 40} ${y} L${x + 40} ${y - 60}`} strokeLinecap="round" />
      <rect
        x={x}
        y={y - 60 - lines.length * 26}
        width={80}
        height={lines.length * 26 + 8}
        rx={4}
        fill="#151515"
      />
      {lines.map((l, i) => (
        <text
          key={l}
          x={x + 40}
          y={y - 60 - lines.length * 26 + 26 + i * 26}
          textAnchor="middle"
          fill="#ffe14d"
          stroke="none"
          style={{ font: '800 21px Archivo, Arial, sans-serif', letterSpacing: '0.04em' }}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

function Burst({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.62;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return (
    <polygon
      points={pts.join(' ')}
      fill={color}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
    />
  );
}

function Floodlight({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <path d={`M${x} ${y} L${x} ${y - 130}`} />
      <rect x={x - 22} y={y - 154} width={44} height={26} rx={3} fill="#fff6c2" />
      <path
        d={`M${x - 22} ${y - 141} L${x + 22} ${y - 141} M${x} ${y - 154} L${x} ${y - 128}`}
        strokeWidth={2}
      />
    </g>
  );
}

function SpeedLines({ x, y, color = '#ffffff' }: { x: number; y: number; color?: string }) {
  return (
    <g stroke={color} strokeWidth={5} strokeLinecap="round" strokeOpacity={0.8}>
      <path d={`M${x} ${y} l-70 0`} />
      <path d={`M${x - 10} ${y + 16} l-90 0`} />
      <path d={`M${x} ${y + 32} l-60 0`} />
    </g>
  );
}

function Turbo({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round">
      <circle cx={x} cy={y} r={30} fill="#c9c7d6" />
      <path
        d={`M${x} ${y} m-4 0 a4 4 0 1 1 8 0 a10 10 0 1 1 -18 -2 a16 16 0 1 1 30 6`}
        fill="none"
        strokeWidth={3}
      />
      <rect x={x + 24} y={y - 12} width={30} height={20} rx={3} fill="#c9c7d6" />
    </g>
  );
}

function Gauge({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round">
      <circle cx={x} cy={y} r={34} fill="#fff6d6" />
      <path
        d={`M${x - 24} ${y + 8} A26 26 0 0 1 ${x + 24} ${y + 8}`}
        fill="none"
        stroke="#ff5a5f"
        strokeWidth={6}
        strokeDasharray="6 4"
      />
      <path d={`M${x} ${y + 6} L${x + 20} ${y - 16}`} strokeWidth={5} />
      <circle cx={x} cy={y + 6} r={5} fill={OL} />
      <text
        x={x}
        y={y + 26}
        textAnchor="middle"
        fill={OL}
        stroke="none"
        style={{ font: '800 11px Archivo, Arial, sans-serif' }}
      >
        {label}
      </text>
    </g>
  );
}

function Stopwatch({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={OL} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round">
      <rect x={x - 8} y={y - 48} width={16} height={10} rx={2} fill="#c9c7d6" />
      <circle cx={x} cy={y} r={36} fill="#ffffff" />
      <path d={`M${x} ${y} L${x} ${y - 24} M${x} ${y} L${x + 16} ${y + 8}`} strokeWidth={5} />
      <circle cx={x} cy={y} r={4} fill={OL} />
    </g>
  );
}

function SafetyCar({ x, y, color = '#f5f2ff' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={OL} strokeWidth={W} strokeLinejoin="round">
      <path d="M0 -14 L0 -34 L36 -38 L64 -60 L124 -60 L150 -38 L180 -34 L180 -14 Z" fill={color} />
      <path d="M72 -54 L120 -54 L138 -38 L60 -38 Z" fill="#9fd6ff" strokeWidth={3} />
      <rect x={78} y={-72} width={40} height={12} rx={3} fill="#ffb627" />
      <path d="M98 -72 L98 -60" strokeWidth={3} />
      <Wheel cx={40} r={18} cover={false} />
      <Wheel cx={146} r={18} cover={false} />
    </g>
  );
}

function Crew({ x, y, suit }: { x: number; y: number; suit: string }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke={OL}
      strokeWidth={W}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M-10 0 L-8 -36 M10 0 L8 -36" strokeWidth={9} stroke={OL} />
      <path d="M-10 0 L-8 -36 M10 0 L8 -36" strokeWidth={5} stroke={suit} />
      <rect x={-16} y={-74} width={32} height={42} rx={10} fill={suit} />
      <path d="M14 -64 L40 -56" strokeWidth={9} stroke={OL} />
      <path d="M14 -64 L40 -56" strokeWidth={5} stroke={suit} />
      <circle cx={0} cy={-90} r={16} fill={suit} />
      <path d="M-2 -96 L14 -96 L14 -86 L0 -86 Z" fill="#3a3f6b" strokeWidth={3} />
    </g>
  );
}

function Confetti({ seed, colors }: { seed: number; colors: string[] }) {
  const bits: ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const x = (i * 389 + seed * 97) % 1000;
    const y = 18 + ((i * 53 + seed * 31) % 110);
    bits.push(
      <rect
        key={i}
        x={x}
        y={y}
        width={9}
        height={5}
        rx={1}
        transform={`rotate(${(i * 47) % 180} ${x} ${y})`}
        fill={colors[i % colors.length]}
      />,
    );
  }
  return <g>{bits}</g>;
}

function Stars({ seed }: { seed: number }) {
  const dots: ReactNode[] = [];
  for (let i = 0; i < 24; i++)
    dots.push(
      <circle
        key={i}
        cx={(i * 211 + seed * 53) % 1000}
        cy={12 + ((i * 37) % 90)}
        r={i % 3 === 0 ? 2.6 : 1.6}
        fill="#ffffff"
      />,
    );
  return <g opacity={0.8}>{dots}</g>;
}

/** The scene for each era, by era id (catalog.ts). */
const SCENES: Record<number, () => ReactNode> = {
  // Era 10, Ground-effect era: a floodlit modern circuit and a sleek car on wheel covers.
  10: () => (
    <>
      <Sky id="sky-10" top="#1b2a5e" bottom="#3f74c9" />
      <Stars seed={10} />
      <Floodlight x={110} y={196} />
      <Floodlight x={880} y={196} />
      <Grandstand
        x={300}
        y={196}
        w={200}
        roof="#19c7b4"
        seats={['#ffd23f', '#ff6fa8', '#7ee36b', '#ffffff']}
      />
      <Grandstand
        x={620}
        y={196}
        w={170}
        roof="#19c7b4"
        seats={['#ffffff', '#7ee36b', '#ff6fa8']}
      />
      <Track kerb={['#19c7b4', '#ffffff']} />
      <SpeedLines x={330} y={208} />
      <Car x={380} y={244} s={0.95} color="#19c7b4" helmet="#ffd23f" />
      <Flag x={730} y={192} />
    </>
  ),
  // Era 9, the 2021 title fight: two cars wheel to wheel at sunset, the trophy between them.
  9: () => (
    <>
      <Sky id="sky-9" top="#ff7a59" bottom="#ffd27a" />
      <circle cx={500} cy={150} r={70} fill="#fff1b8" stroke={OL} strokeWidth={W} />
      <Hills color="#e0604f" />
      <Burst x={500} y={70} r={46} color="#ffe14d" />
      <text
        x={500}
        y={80}
        textAnchor="middle"
        fill={OL}
        style={{ font: '900 28px Archivo, Arial, sans-serif', fontStretch: '125%' }}
      >
        VS
      </text>
      <Trophy x={500} y={190} s={0.9} />
      <Track kerb={['#7b5cff', '#ffffff']} />
      <Car x={250} y={248} s={0.85} color="#7b5cff" helmet="#ffffff" />
      <Car x={750} y={248} s={0.85} color="#7ee36b" helmet="#ffffff" flip />
      <Flag x={110} y={190} />
      <Flag x={880} y={190} />
    </>
  ),
  // Era 8, wider cars on wider tyres: a big-tyred car at speed, a tyre wall behind.
  8: () => (
    <>
      <Sky id="sky-8" top="#5fb8ff" bottom="#cdeeff" />
      <Cloud x={220} y={60} s={1.1} />
      <Cloud x={640} y={44} />
      <Cloud x={880} y={80} s={0.8} />
      <Hills color="#7fd17a" />
      <Grandstand
        x={560}
        y={196}
        w={180}
        roof="#3b82f6"
        seats={['#f5c518', '#ffffff', '#ff6fa8']}
      />
      <TyreStack x={190} y={196} n={3} band="#f5c518" />
      <TyreStack x={260} y={196} n={2} band="#ffffff" />
      <Track kerb={['#3b82f6', '#ffffff']} />
      <SpeedLines x={360} y={206} />
      <Car x={400} y={248} s={0.95} color="#3b82f6" helmet="#f5c518" bigTyres />
      <Flag x={820} y={192} />
    </>
  ),
  // Era 7, hybrid turbo: batteries, a turbo and a car leaving a trail of energy.
  7: () => (
    <>
      <Sky id="sky-7" top="#123a3a" bottom="#2f8f74" />
      <Stars seed={7} />
      <Bolt x={300} y={80} s={1.4} />
      <Battery x={620} y={120} />
      <Turbo x={180} y={130} />
      <Bolt x={860} y={90} s={1.1} color="#3ee08f" />
      <Track kerb={['#3ee08f', '#ffffff']} />
      <g stroke="#3ee08f" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 14">
        <path d="M120 212 L380 212" />
        <path d="M150 228 L380 228" />
      </g>
      <Car x={400} y={248} s={0.95} color="#2ec4a6" helmet="#ffe14d" />
      <Flag x={780} y={192} />
    </>
  ),
  // Era 6, fast-wearing tyres: stacks of tyres, a worn one and the marbles on track.
  6: () => (
    <>
      <Sky id="sky-6" top="#ffd166" bottom="#fff3c4" />
      <Cloud x={120} y={50} />
      <Cloud x={760} y={40} s={1.2} />
      <TyreStack x={300} y={196} n={4} band="#ff5a5f" />
      <TyreStack x={370} y={196} n={3} band="#ffe14d" />
      <TyreStack x={440} y={196} n={2} band="#ffffff" />
      <Tyre x={560} y={150} r={42} band="#ff5a5f" worn />
      <Stopwatch x={680} y={140} />
      <Track kerb={['#ff5a5f', '#ffffff']} />
      <g fill="#2a2933">
        {[150, 176, 210, 590, 640, 660, 700, 905].map((x, i) => (
          <circle key={x} cx={x} cy={222 + (i % 3) * 8} r={4 + (i % 2)} />
        ))}
      </g>
      <Car x={250} y={248} s={0.8} color="#ff8a3d" helmet="#ffffff" />
      <Flag x={860} y={192} />
    </>
  ),
  // Era 5: three plain helmets on a podium, a fuel rig standing by.
  5: () => (
    <>
      <Sky id="sky-5" top="#8e7cff" bottom="#e2dbff" />
      <Confetti seed={5} colors={['#ffe14d', '#ff6fa8', '#3ee08f', '#ffffff']} />
      <g stroke={OL} strokeWidth={W} strokeLinejoin="round">
        <rect x={360} y={150} width={90} height={46} fill="#c9c7d6" />
        <rect x={450} y={126} width={100} height={70} fill="#ffd23f" />
        <rect x={550} y={162} width={90} height={34} fill="#e6a46a" />
      </g>
      <Helmet x={405} y={150} color="#ff8a3d" s={0.9} />
      <Helmet x={500} y={126} color="#19c7b4" />
      <Helmet x={595} y={162} color="#ff6fa8" s={0.85} />
      <FuelRig x={170} y={196} color="#ffb627" reach={110} />
      <Track kerb={['#8e7cff', '#ffffff']} />
      <Flag x={790} y={192} />
    </>
  ),
  // Era 4, a dynasty: five trophies in a row, a fuel rig and grooved tyres.
  4: () => (
    <>
      <Sky id="sky-4" top="#ffb347" bottom="#ffe6b0" />
      <Burst x={500} y={84} r={70} color="#fff1b8" />
      <g stroke={OL} strokeWidth={W}>
        <rect x={330} y={152} width={340} height={20} rx={3} fill="#7a5230" />
      </g>
      {[365, 430, 500, 570, 635].map((x) => (
        <Trophy key={x} x={x} y={152} s={x === 500 ? 0.95 : 0.75} />
      ))}
      <FuelRig x={130} y={196} color="#ff8a3d" reach={100} />
      <Tyre x={790} y={150} r={34} band="#ffffff" grooves />
      <Tyre x={870} y={164} r={28} band="#ffffff" grooves />
      <Track kerb={['#ff8a3d', '#ffffff']} />
      <Car x={420} y={248} s={0.75} color="#ff5a5f" helmet="#ffe14d" style="noughties" />
    </>
  ),
  // Era 3, refuelling returns: a crew member at the rig, the safety car waiting.
  3: () => (
    <>
      <Sky id="sky-3" top="#58c4f2" bottom="#c9efff" />
      <Cloud x={160} y={56} />
      <Cloud x={720} y={46} s={1.1} />
      <Hills color="#86d47a" />
      <FuelRig x={300} y={196} color="#ff8a3d" reach={170} />
      <Crew x={430} y={196} suit="#ffffff" />
      <Track kerb={['#ff5a5f', '#ffffff']} />
      <Car x={410} y={248} s={0.8} color="#ffe14d" helmet="#3b82f6" style="noughties" />
      <SafetyCar x={720} y={248} />
      <Tyre x={160} y={162} r={30} band="#ffffff" grooves />
    </>
  ),
  // Era 2: two cars of the time side by side, and a pit board calling the gap.
  2: () => (
    <>
      <Sky id="sky-2" top="#5b3d8f" bottom="#f08ab8" />
      <Stars seed={2} />
      <Hills color="#3e2a6b" />
      <PitBoard x={470} y={196} lines={['P1', '+0.4', 'L12']} />
      <Helmet x={260} y={150} color="#3b82f6" s={0.8} />
      <Helmet x={760} y={150} color="#ff8a3d" s={0.8} />
      <Track kerb={['#ffffff', '#3e2a6b']} />
      <Car x={200} y={248} s={0.8} color="#3b82f6" helmet="#ffffff" style="noughties" />
      <Car x={800} y={248} s={0.8} color="#ff8a3d" helmet="#ffffff" style="noughties" flip />
    </>
  ),
  // Era 1, the turbo era: an 80s sunset, a chunky-winged car with a boost gauge and a pit board.
  1: () => (
    <>
      <Sky id="sky-1" top="#ff5fa2" bottom="#ffb86b" />
      <defs>
        <clipPath id="sun-1">
          <rect x={0} y={0} width={1000} height={196} />
        </clipPath>
      </defs>
      <g clipPath="url(#sun-1)">
        <circle cx={500} cy={170} r={96} fill="#ffe14d" stroke={OL} strokeWidth={W} />
        {[120, 140, 158, 174, 188].map((y) => (
          <rect key={y} x={390} y={y} width={220} height={y > 160 ? 8 : 5} fill="#ff8a6b" />
        ))}
      </g>
      <Gauge x={200} y={120} label="BOOST" />
      <PitBoard x={760} y={196} lines={['BOX', 'L30']} />
      <Track kerb={['#ffe14d', '#ff5fa2']} />
      <g stroke="#ff9cd0" strokeWidth={2} strokeOpacity={0.6}>
        {[100, 250, 400, 600, 750, 900].map((x) => (
          <path key={x} d={`M500 196 L${x * 2 - 500} 260`} />
        ))}
      </g>
      <Car x={380} y={250} s={0.9} color="#ffffff" helmet="#ff5fa2" style="retro" />
      <path
        d="M372 222 L340 214 L350 224 L330 230 L372 232"
        fill="#ffb627"
        stroke={OL}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </>
  ),
};

/** An era's backdrop, filling its band. */
export function EraScene({ eraId }: { eraId: number }) {
  const scene = SCENES[eraId];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 260"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      {scene ? scene() : <rect width={1000} height={260} fill="var(--card-2)" />}
    </svg>
  );
}

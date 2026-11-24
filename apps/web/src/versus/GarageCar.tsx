// The garage's car (versus/Lobby.tsx): a Versus car from above at hero size, pointing up the page,
// drawn to look real: glossy shaded bodywork, a carbon-fibre floor, a three-element front wing,
// wishbones, mirrors, the halo and the driver's helmet, tyres with the compound's stripe on the
// outer sidewall, and a soft shadow on the garage floor. Its proportions come from the car's
// shape (CarIcon.tsx CAR_SHAPES), so each of the four cars looks different. Livery colours are
// generic (no team's).

import type { Shape } from '../components/CarIcon.js';

const LIVERY = { base: '#C80B0B', light: '#FF4A3D', dark: '#5E0202' };
const CARBON = '#17181B';

/** One car on the page at a time, so fixed gradient ids are safe. */
const ID = 'gp-car';

export function GarageCar({
  shape: s,
  tyre,
  label,
  className = '',
}: {
  shape: Shape;
  tyre: string;
  label: string;
  className?: string;
}) {
  const N = s.nose;
  const P = s.pod;
  const B = s.body;
  const front = N - 13;
  // A tyre outboard of the floor; `side` -1 is the car's left, 1 its right.
  const tyreAt = (x: number, w: number, h: number, side: -1 | 1) => {
    const y = side < 0 ? -(P + 1.7) - h : P + 1.7;
    const stripe = side < 0 ? y + 0.55 : y + h - 0.95;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={1.5} fill={`url(#${ID}-tyre)`} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={x + w * f}
            y1={y + 0.4}
            x2={x + w * f}
            y2={y + h - 0.4}
            stroke="#000"
            strokeOpacity={0.35}
            strokeWidth={0.12}
          />
        ))}
        <rect x={x + 0.7} y={stripe} width={w - 1.4} height={0.4} rx={0.2} fill={tyre} />
      </g>
    );
  };
  const wishbone = (x1: number, y1: number, x2: number, y2: number, x3: number) => (
    <>
      <path
        d={`M${x1},${y1} L${x2},${y2} M${x1},${y1} L${x3},${y2} M${x1},${-y1} L${x2},${-y2} M${x1},${-y1} L${x3},${-y2}`}
        stroke="#2C2E33"
        strokeWidth={0.42}
        strokeLinecap="round"
      />
    </>
  );
  // The front wing: three swept elements, carbon under a livery top flap.
  const element = (i: number, fill: string) => {
    const a = N - 1.6 + i * 0.95;
    return (
      <path
        key={i}
        d={`M${a},${-s.fw} L${a + 0.9},${-s.fw} Q${N + 1.2 - i * 0.2},${-s.fw * 0.35} ${N + 2.9 - i * 0.35},${-1.1} L${N + 2.9 - i * 0.35},1.1 Q${N + 1.2 - i * 0.2},${s.fw * 0.35} ${a + 0.9},${s.fw} L${a},${s.fw} Q${N - 0.4 + i * 0.6},${s.fw * 0.3} ${N + 1.8 - i * 0.35},0 Q${N - 0.4 + i * 0.6},${-s.fw * 0.3} ${a},${-s.fw} Z`}
        fill={fill}
      />
    );
  };
  return (
    <svg
      viewBox={`${-(P + 9)} ${-(N + 6)} ${2 * (P + 9)} ${N + 33}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <defs>
        <linearGradient id={`${ID}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LIVERY.dark} />
          <stop offset="0.22" stopColor={LIVERY.base} />
          <stop offset="0.42" stopColor={LIVERY.light} />
          <stop offset="0.5" stopColor="#FF8A80" />
          <stop offset="0.58" stopColor={LIVERY.light} />
          <stop offset="0.78" stopColor={LIVERY.base} />
          <stop offset="1" stopColor={LIVERY.dark} />
        </linearGradient>
        <linearGradient id={`${ID}-tyre`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A0A0B" />
          <stop offset="0.5" stopColor="#2A2B2F" />
          <stop offset="1" stopColor="#0A0A0B" />
        </linearGradient>
        <linearGradient id={`${ID}-halo`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6B6F76" />
          <stop offset="0.5" stopColor="#D9DCE0" />
          <stop offset="1" stopColor="#6B6F76" />
        </linearGradient>
        <pattern id={`${ID}-carbon`} width="0.8" height="0.8" patternUnits="userSpaceOnUse">
          <rect width="0.8" height="0.8" fill={CARBON} />
          <rect width="0.4" height="0.4" fill="#202226" />
          <rect x="0.4" y="0.4" width="0.4" height="0.4" fill="#202226" />
        </pattern>
        <filter id={`${ID}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g transform="rotate(-90)">
        <rect
          x={-25}
          y={-(P + 6.5)}
          width={N + 30}
          height={2 * (P + 6.5)}
          rx={6}
          fill="#000"
          opacity={0.6}
          filter={`url(#${ID}-shadow)`}
        />
        {/* The floor (plank and edges), carbon. */}
        <path
          d={`M-18,${-(P + 1.4)} L5,${-(P + 1.4)} Q10,${-(P + 1.2)} 12,${-B} L12,${B} Q10,${P + 1.2} 5,${P + 1.4} L-18,${P + 1.4} Q-20,${P + 1.4} -20,${P} L-20,${-P} Q-20,${-(P + 1.4)} -18,${-(P + 1.4)} Z`}
          fill={`url(#${ID}-carbon)`}
        />
        {wishbone(-12, -(P + 4.5), -15, -(P - 1), -9)}
        {wishbone(front + 3.7, -(P + 4.1), front - 1.5, -(B - 0.6), front + 5)}
        {tyreAt(-17.5, 10.5, 6.2, -1)}
        {tyreAt(-17.5, 10.5, 6.2, 1)}
        {tyreAt(front, 7.6, 5, -1)}
        {tyreAt(front, 7.6, 5, 1)}
        {/* Rear wing: endplates, main plane in livery, the DRS flap in carbon. */}
        <rect x={-25.5} y={-s.rw - 0.5} width={6.5} height={1} rx={0.3} fill={CARBON} />
        <rect x={-25.5} y={s.rw - 0.5} width={6.5} height={1} rx={0.3} fill={CARBON} />
        <rect x={-25} y={-s.rw} width={2.8} height={2 * s.rw} rx={0.6} fill={`url(#${ID}-body)`} />
        <rect x={-22} y={-s.rw} width={2.1} height={2 * s.rw} rx={0.5} fill="#24262A" />
        <rect x={-20.4} y={-0.5} width={3} height={1} fill={CARBON} />
        {/* Sidepods, with their dark inlets. */}
        <path
          d={`M-16,${-P} Q-9,${-(P + 0.6)} 0,${-(P - 0.2)} Q4,${-(P - 1)} 6,${-B} L6,${B} Q4,${P - 1} 0,${P - 0.2} Q-9,${P + 0.6} -16,${P} Z`}
          fill={`url(#${ID}-body)`}
        />
        <rect x={3.2} y={-(P - 0.3)} width={1.5} height={P - B + 0.2} rx={0.4} fill="#0B0B0C" />
        <rect x={3.2} y={B + 0.1} width={1.5} height={P - B + 0.2} rx={0.4} fill="#0B0B0C" />
        {/* Engine cover and nose. */}
        <path
          d={`M-20.5,-1.6 Q-14,-2 -8,${-(B - 0.5)} L2,${-B} Q6,${-B} 8,${-(B - 1.4)} L${N - 2},-1.3 Q${N},-1.1 ${N},0 Q${N},1.1 ${N - 2},1.3 L8,${B - 1.4} Q6,${B} 2,${B} L-8,${B - 0.5} Q-14,2 -20.5,1.6 Z`}
          fill={`url(#${ID}-body)`}
        />
        <path
          d={`M-6,${-(B - 0.9)} L${N - 4},-0.95 M-6,${B - 0.9} L${N - 4},0.95`}
          stroke="#FFFFFF"
          strokeOpacity={0.55}
          strokeWidth={0.22}
        />
        <line x1={-20.5} y1={0} x2={-7.5} y2={0} stroke="#2C0101" strokeWidth={0.45} />
        <ellipse cx={-5.2} cy={0} rx={1.7} ry={1.25} fill="#0B0B0C" />
        <ellipse
          cx={-5.2}
          cy={0}
          rx={1.7}
          ry={1.25}
          fill="none"
          stroke={LIVERY.light}
          strokeWidth={0.25}
        />
        {/* Mirrors on their stalks. */}
        <path
          d={`M1.2,${-(B - 0.3)} L1.6,${-(B + 1.5)} M1.2,${B - 0.3} L1.6,${B + 1.5}`}
          stroke={CARBON}
          strokeWidth={0.35}
        />
        <ellipse cx={1.7} cy={-(B + 1.9)} rx={0.9} ry={0.55} fill={`url(#${ID}-body)`} />
        <ellipse cx={1.7} cy={B + 1.9} rx={0.9} ry={0.55} fill={`url(#${ID}-body)`} />
        {/* Cockpit, the driver's helmet, the halo. */}
        <ellipse cx={-0.4} cy={0} rx={3.7} ry={2.25} fill="#0B0B0C" />
        <circle cx={-1.3} cy={0} r={1.45} fill="#F2F2F2" />
        <path d="M-0.2,-0.95 Q0.35,0 -0.2,0.95" stroke="#1B1C1F" strokeWidth={0.55} fill="none" />
        <path
          d="M-3.7,-2.25 Q1.6,-2.7 2.9,-0.45 L4.8,0 L2.9,0.45 Q1.6,2.7 -3.7,2.25"
          fill="none"
          stroke={`url(#${ID}-halo)`}
          strokeWidth={0.75}
          strokeLinejoin="round"
        />
        {/* Front wing over the nose tip. */}
        {element(0, CARBON)}
        {element(1, '#24262A')}
        {element(2, LIVERY.base)}
        <rect x={N - 2.2} y={-s.fw - 0.35} width={5.4} height={0.7} rx={0.3} fill={LIVERY.dark} />
        <rect x={N - 2.2} y={s.fw - 0.35} width={5.4} height={0.7} rx={0.3} fill={LIVERY.dark} />
      </g>
    </svg>
  );
}

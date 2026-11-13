// A Versus car seen head-on, standing in the pit lane (versus/PitLane.tsx): front wing, nose,
// front tyres with the compound's colour on their sidewalls, suspension, sidepods, mirrors, the
// halo and the driver's helmet, the airbox, and the rear wing and tyres behind. Drawn in its own
// coordinates (x -200..200, the ground at y 0, up is negative) for the scene to place and scale.
// Its widths follow the car's shape (CarIcon.tsx CAR_SHAPES), so a Glider's wide front wing and
// an Endurance's wide sidepods show. Livery colours are generic (no team's).

import type { Shape } from '../components/CarIcon.js';

const CARBON = '#17181B';

export interface Livery {
  base: string;
  dark: string;
  light: string;
}

export const RED: Livery = { base: '#C80B0B', dark: '#6E0303', light: '#FF4A3D' };
export const GREY: Livery = { base: '#5A5E64', dark: '#2E3135', light: '#8E9196' };

export function FrontCar({
  shape: s,
  livery: l,
  tyre,
}: {
  shape: Shape;
  livery: Livery;
  tyre: string;
}) {
  const wing = 150 + (s.fw - 9.5) * 9;
  const pod = 72 + (s.pod - 6.5) * 9;
  const tyreBlock = (x: number, y: number, w: number, h: number, near: boolean) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={near ? '#151517' : '#0C0C0D'} />
      <rect
        x={x + w * 0.18}
        y={y}
        width={w * 0.64}
        height={h}
        fill="#fff"
        opacity={near ? 0.05 : 0.03}
      />
      {[0.3, 0.55, 0.8].map((f) => (
        <line
          key={f}
          x1={x + 4}
          y1={y + h * f}
          x2={x + w - 4}
          y2={y + h * f}
          stroke="#000"
          strokeOpacity={0.5}
          strokeWidth={1.5}
        />
      ))}
      <rect
        x={x + 3}
        y={y + 10}
        width={4}
        height={h - 20}
        rx={2}
        fill={tyre}
        opacity={near ? 1 : 0.6}
      />
      <rect
        x={x + w - 7}
        y={y + 10}
        width={4}
        height={h - 20}
        rx={2}
        fill={tyre}
        opacity={near ? 1 : 0.6}
      />
    </g>
  );
  return (
    <g>
      <ellipse cx={0} cy={-2} rx={wing + 40} ry={16} fill="#000" opacity={0.55} />
      {/* Behind: the rear wing and rear tyres. */}
      <rect x={-118} y={-160} width={10} height={78} rx={2} fill={CARBON} />
      <rect x={108} y={-160} width={10} height={78} rx={2} fill={CARBON} />
      <rect x={-118} y={-162} width={236} height={17} rx={4} fill={l.base} />
      <rect x={-118} y={-162} width={236} height={5} rx={2} fill={l.light} opacity={0.6} />
      <rect x={-112} y={-142} width={224} height={9} rx={3} fill={CARBON} />
      {tyreBlock(-158, -92, 48, 90, false)}
      {tyreBlock(110, -92, 48, 90, false)}
      <rect x={-135} y={-20} width={270} height={11} rx={3} fill={CARBON} />
      {/* Sidepods with their inlets, then the engine cover and airbox. */}
      <path
        d={`M${-pod - 22},-28 Q${-pod - 28},-78 ${-pod + 12},-86 L${pod - 12},-86 Q${pod + 28},-78 ${pod + 22},-28 Z`}
        fill={l.dark}
      />
      <path
        d={`M${-pod - 14},-60 Q${-pod - 10},-82 ${-pod + 16},-84 L${pod - 16},-84 Q${pod + 10},-82 ${pod + 14},-60 Z`}
        fill={l.base}
      />
      <ellipse cx={-pod + 4} cy={-70} rx={20} ry={9} fill="#0B0B0C" />
      <ellipse cx={pod - 4} cy={-70} rx={20} ry={9} fill="#0B0B0C" />
      <path d="M-30,-84 L-13,-134 L13,-134 L30,-84 Z" fill={l.base} />
      <path d="M-4,-134 L4,-134 L8,-84 L-8,-84 Z" fill={l.light} opacity={0.45} />
      <ellipse cx={0} cy={-122} rx={9} ry={7} fill="#0B0B0C" />
      {/* Suspension arms to the front wheels. */}
      <path
        d="M-30,-46 L-140,-60 M-30,-30 L-140,-38 M30,-46 L140,-60 M30,-30 L140,-38"
        stroke="#2C2E33"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Mirrors, the helmet, the halo. */}
      <path d="M-32,-92 L-62,-97 M32,-92 L62,-97" stroke={CARBON} strokeWidth={3} />
      <ellipse cx={-72} cy={-98} rx={13} ry={7} fill={l.base} />
      <ellipse cx={72} cy={-98} rx={13} ry={7} fill={l.base} />
      <circle cx={0} cy={-96} r={16} fill="#F2F2F2" />
      <rect x={-13} y={-101} width={26} height={9} rx={4.5} fill="#16171A" />
      <path
        d="M-36,-82 Q-36,-118 0,-120 Q36,-118 36,-82"
        fill="none"
        stroke="#C9CCD0"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path d="M0,-120 L0,-78" stroke="#A9ACB1" strokeWidth={6} strokeLinecap="round" />
      {/* The nose. */}
      <path d="M-24,-76 L24,-76 L13,-16 L-13,-16 Z" fill={l.base} />
      <path d="M-3,-76 L3,-76 L2,-16 L-2,-16 Z" fill={l.light} opacity={0.5} />
      {/* Front tyres, then the front wing across them. */}
      {tyreBlock(-wing - 36, -104, 56, 102, true)}
      {tyreBlock(wing - 20, -104, 56, 102, true)}
      <path d={`M${-wing},-30 Q0,-6 ${wing},-30 L${wing},-20 Q0,4 ${-wing},-20 Z`} fill={l.base} />
      <path d={`M${-wing},-16 L${wing},-16 L${wing},-4 L${-wing},-4 Z`} fill={CARBON} />
      <rect x={-wing - 6} y={-38} width={10} height={38} rx={2} fill={CARBON} />
      <rect x={wing - 4} y={-38} width={10} height={38} rx={2} fill={CARBON} />
    </g>
  );
}

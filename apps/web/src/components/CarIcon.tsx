// A top-down open-wheel car for the track map: the two main cars are drawn as one (the rest of
// the field stays as dots). It points along +x, about 44 units nose to rear wing, the body in the
// car's colour and the tyre's colour on the wheels. Versus cars each have their own shape.

/** Proportions of a car shape (versus cars: docs/versus-spec.md). */
export interface Shape {
  /** Nose tip. */
  nose: number;
  /** Sidepods' half-width. */
  pod: number;
  /** Front and rear wings' half-width. */
  fw: number;
  rw: number;
  /** Body half-width at the cockpit. */
  body: number;
}

export const CAR_SHAPES: Record<string, Shape> = {
  balanced: { nose: 20, pod: 6.5, fw: 9.5, rw: 8, body: 5 },
  bullet: { nose: 24, pod: 5, fw: 8.5, rw: 6.5, body: 4.4 },
  glider: { nose: 19, pod: 6, fw: 11.5, rw: 10, body: 4.8 },
  endurance: { nose: 18, pod: 8.5, fw: 9.5, rw: 8.5, body: 5.8 },
};

const DARK = '#0E1214';

export function CarIcon({
  color,
  tyre,
  shape = 'balanced',
}: {
  color: string;
  tyre: string;
  shape?: string;
}) {
  const s = CAR_SHAPES[shape] ?? (CAR_SHAPES.balanced as Shape);
  const wheel = (x: number, y: number, w: number, h: number, band: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={1.3} fill={DARK} />
      <rect x={x + 0.5} y={y + (h - band) / 2} width={w - 1} height={band} fill={tyre} />
    </>
  );
  return (
    <g>
      <ellipse cx={-1} cy={0} rx={s.nose + 4} ry={s.pod + 5} fill="#000" opacity={0.35} />
      {wheel(-15, -s.pod - 3.6, 9, 5, 1.6)}
      {wheel(-15, s.pod - 1.4, 9, 5, 1.6)}
      {wheel(s.nose - 12, -s.pod - 3.2, 7, 4.2, 1.4)}
      {wheel(s.nose - 12, s.pod - 1, 7, 4.2, 1.4)}
      <path
        d={`M-12,${-s.pod} Q-2,${-s.pod - 1} 4,${-s.body + 1} L4,${s.body - 1} Q-2,${s.pod + 1} -12,${s.pod} Z`}
        fill={color}
      />
      <path
        d={`M-16,${-s.body + 1} L6,${-s.body} L${s.nose},-1.6 L${s.nose},1.6 L6,${s.body} L-16,${s.body - 1} Z`}
        fill={color}
      />
      <path
        d={`M-16,${-s.body + 1} L6,${-s.body} L${s.nose},-1.6 L${s.nose},-0.4 L-16,-0.6 Z`}
        fill="#fff"
        opacity={0.18}
      />
      <ellipse cx={-2} cy={0} rx={4} ry={2.3} fill={DARK} />
      <rect x={s.nose - 1} y={-s.fw} width={4} height={s.fw * 2} rx={1} fill={color} />
      <rect
        x={s.nose - 1}
        y={-s.fw}
        width={4}
        height={s.fw * 2}
        rx={1}
        fill="#000"
        opacity={0.25}
      />
      <rect x={-21} y={-s.rw} width={4.5} height={s.rw * 2} rx={1} fill={DARK} />
      <rect x={-20.4} y={-s.rw + 0.8} width={3.3} height={s.rw * 2 - 1.6} rx={0.6} fill={color} />
    </g>
  );
}

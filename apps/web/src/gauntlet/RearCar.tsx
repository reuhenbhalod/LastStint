// The Gauntlet's car, seen from behind as the camera chases it down the straight
// (gauntlet/Straight.tsx): rear wing with its DRS flap and endplates, the beam wing, rear tyres
// with the compound's colour on their sidewalls, the diffuser and its strakes, the rain light,
// the engine cover and fin, the halo and the driver's helmet. Drawn in its own coordinates
// (x -215..215, the ground at y 0, up is negative) for the scene to place and scale. Livery
// colours are generic (no team's).

const CARBON = '#17181B';
const BODY = { base: '#C80B0B', dark: '#5E0202', light: '#FF4A3D' };

export function RearCar({ tyre, light }: { tyre: string; light: 'on' | 'blink' }) {
  const wheel = (x: number) => (
    <g>
      <rect x={x} y={-160} width={88} height={158} rx={17} fill="#101113" />
      <rect x={x + 14} y={-160} width={60} height={158} fill="#fff" opacity={0.045} />
      {[0.22, 0.44, 0.66, 0.88].map((f) => (
        <line
          key={f}
          x1={x + 6}
          y1={-160 + 158 * f}
          x2={x + 82}
          y2={-160 + 158 * f}
          stroke="#000"
          strokeOpacity={0.45}
          strokeWidth={2}
        />
      ))}
      <rect x={x + 3} y={-146} width={5} height={130} rx={2.5} fill={tyre} />
      <rect x={x + 80} y={-146} width={5} height={130} rx={2.5} fill={tyre} />
    </g>
  );
  return (
    <g>
      <ellipse cx={0} cy={-2} rx={262} ry={22} fill="#000" opacity={0.75} />
      {/* The rain light's glow on the asphalt. */}
      <ellipse cx={0} cy={8} rx={90} ry={10} fill="url(#fl-rain)" opacity={0.5} />
      {wheel(-214)}
      {wheel(126)}
      {/* Rear suspension and the brake ducts. */}
      <path
        d="M-126,-118 L-62,-96 M-126,-60 L-62,-74 M126,-118 L62,-96 M126,-60 L62,-74"
        stroke="#2C2E33"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Sidepods behind, then the gearbox and the engine cover rising to the airbox. */}
      <path
        d="M-122,-116 Q-108,-152 -66,-152 L66,-152 Q108,-152 122,-116 L118,-66 L-118,-66 Z"
        fill={BODY.dark}
      />
      <path d="M-76,-120 L-30,-242 L30,-242 L76,-120 Z" fill="url(#fl-body)" />
      <path d="M-30,-242 L-20,-120 M30,-242 L20,-120" stroke="#fff" strokeOpacity={0.25} />
      <rect x={-3} y={-292} width={6} height={64} fill={BODY.dark} />
      <rect x={-46} y={-128} width={92} height={14} rx={3} fill={CARBON} />
      {/* The diffuser and its strakes. */}
      <path d="M-122,-66 L122,-66 L106,-14 L-106,-14 Z" fill={CARBON} />
      <path
        d="M-86,-64 L-82,-16 M-50,-64 L-48,-16 M-17,-64 L-16,-16 M17,-64 L16,-16 M50,-64 L48,-16 M86,-64 L82,-16"
        stroke="#2C2E33"
        strokeWidth={4}
      />
      {/* The rain light. */}
      <g className={light === 'blink' ? 'fl-blink' : undefined}>
        <ellipse cx={0} cy={-84} rx={70} ry={26} fill="url(#fl-rain)" />
        <rect x={-19} y={-91} width={38} height={13} rx={2} fill="#FF3B2F" />
        <rect x={-15} y={-88} width={30} height={3} rx={1.5} fill="#FFD0C8" opacity={0.8} />
      </g>
      {/* The beam wing. */}
      <rect x={-92} y={-170} width={184} height={10} rx={3} fill={CARBON} />
      {/* The driver's helmet and the halo. */}
      <circle cx={0} cy={-256} r={20} fill="#F2F2F2" />
      <rect x={-20} y={-258} width={40} height={6} fill={BODY.base} />
      <path
        d="M-42,-234 Q-42,-274 0,-276 Q42,-274 42,-234"
        fill="none"
        stroke="#C9CCD0"
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* The rear wing: endplates, main plane in livery, the DRS flap in carbon. */}
      <rect x={-190} y={-306} width={15} height={142} rx={2} fill={CARBON} />
      <rect x={175} y={-306} width={15} height={142} rx={2} fill={CARBON} />
      <rect x={-190} y={-312} width={380} height={31} rx={4} fill="url(#fl-body)" />
      <rect x={-190} y={-312} width={380} height={5} rx={2} fill={BODY.light} opacity={0.6} />
      <rect x={-184} y={-279} width={368} height={15} rx={3} fill={CARBON} />
      <rect x={-10} y={-264} width={20} height={96} fill={CARBON} />
    </g>
  );
}

// The history book's doodles (HistoryBook.tsx): small flat drawings with the era map's bold
// outline (eraMapArt.tsx), for the cover, the collectible stickers and the empty pages. Every
// helmet, tyre and trophy is generic: no team, livery, sponsor, logo or driver. Decorative
// only: each is hidden from screen readers, the text beside it says what it stands for.

import type { ReactNode } from 'react';

/** The era map's outline colour and weight. */
export const OL = '#1c1b29';
const W = 3;

function Doodle({
  size,
  viewBox = '0 0 48 48',
  className = '',
  children,
}: {
  size: number;
  viewBox?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
    >
      <g stroke={OL} strokeWidth={W} strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

const STAR =
  'M24 5l5.6 11.6 12.7 1.6-9.3 8.8 2.4 12.6L24 33.5l-11.4 6.1 2.4-12.6-9.3-8.8 12.7-1.6z';

/** A plain helmet, side on, visor to the right. */
export function HelmetDoodle({ size = 44, color = '#ffe14d' }: { size?: number; color?: string }) {
  return (
    <Doodle size={size}>
      <path d="M6 38 L6 25 Q6 8 24 8 Q42 8 42 26 L42 38 Z" fill={color} />
      <path d="M22 18 L41 18 L41 28 L24 28 Q20 23 22 18 Z" fill="#3a3f6b" />
      <path d="M10 33 L38 33" stroke="#ffffff" strokeOpacity={0.7} />
    </Doodle>
  );
}

/** A tyre, face on, with its coloured sidewall band. */
export function TyreDoodle({ size = 40, band = '#e5483b' }: { size?: number; band?: string }) {
  return (
    <Doodle size={size}>
      <circle cx={24} cy={24} r={20} fill="#2a2933" />
      <circle cx={24} cy={24} r={13.5} fill="none" stroke={band} strokeWidth={4} />
      <circle cx={24} cy={24} r={7} fill="#c9c7d6" />
    </Doodle>
  );
}

/** A small chequered flag on a pole. */
export function FlagDoodle({ size = 40 }: { size?: number }) {
  const squares: ReactNode[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      if ((r + c) % 2 === 0)
        squares.push(<rect key={`${r}-${c}`} x={10 + c * 7} y={7 + r * 6} width={7} height={6} />);
  return (
    <Doodle size={size}>
      <path d="M8 44 L8 5" />
      <rect x={10} y={7} width={28} height={18} fill="#ffffff" />
      <g fill={OL} stroke="none">
        {squares}
      </g>
      <rect x={10} y={7} width={28} height={18} fill="none" />
    </Doodle>
  );
}

/** A trophy cup on a wooden base. */
export function TrophyDoodle({ size = 40 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d="M14 9 Q5 9 6 17 Q7 23 15 24" fill="none" />
      <path d="M34 9 Q43 9 42 17 Q41 23 33 24" fill="none" />
      <path d="M13 7 L35 7 Q35 27 24 29 Q13 27 13 7 Z" fill="#ffd23f" />
      <path d="M21 29 L27 29 L28 36 L20 36 Z" fill="#ffd23f" />
      <rect x={14} y={36} width={20} height={7} rx={1.5} fill="#7a5230" />
    </Doodle>
  );
}

/** A star sticker: the normal stars. */
export function StarDoodle({ size = 34 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d={STAR} fill="#ffd23f" />
    </Doodle>
  );
}

/** A star in a laurel: the Legend stars. */
export function LegendStarDoodle({ size = 34 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d="M10 40 Q2 28 8 14" fill="none" stroke="#3e9b57" strokeWidth={4} />
      <path d="M38 40 Q46 28 40 14" fill="none" stroke="#3e9b57" strokeWidth={4} />
      <path
        d="M24 10l4.1 8.4 9.2 1.2-6.7 6.4 1.7 9.1L24 30.7l-8.3 4.4 1.7-9.1-6.7-6.4 9.2-1.2z"
        fill="#ff8a3d"
      />
    </Doodle>
  );
}

/** A pen nib: the rewrites. */
export function PenDoodle({ size = 34 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d="M30 6 L42 18 L20 40 L8 42 L10 30 Z" fill="#3b82f6" />
      <path d="M10 30 L20 40" />
      <path d="M26 10 L38 22" />
      <circle cx={14} cy={36} r={1.5} fill={OL} />
    </Doodle>
  );
}

/** A magnifying glass: the hidden objectives. */
export function LensDoodle({ size = 34 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d="M29 29 L42 42" strokeWidth={6} />
      <circle cx={20} cy={20} r={13} fill="#c9efff" />
      <path d="M13 17 Q15 12 20 11" fill="none" stroke="#ffffff" strokeWidth={3} />
    </Doodle>
  );
}

/** A medal on a ribbon: the era badges. */
export function MedalDoodle({ size = 34 }: { size?: number }) {
  return (
    <Doodle size={size}>
      <path d="M14 4 L22 20 L28 18 L20 4 Z" fill="#e5483b" />
      <path d="M34 4 L26 20 L20 18 L28 4 Z" fill="#3b82f6" />
      <circle cx={24} cy={31} r={12} fill="#ffd23f" />
      <path d="M24 25 L24 37 M20 28 L24 25" strokeWidth={2.5} />
    </Doodle>
  );
}

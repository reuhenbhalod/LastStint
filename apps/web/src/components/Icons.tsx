// The game's icons: thin line drawings in the timing-screen style (no emoji). 24 x 24, drawn
// in the current text colour, sized by the `size` prop.

import type { ReactNode } from 'react';

function Icon({
  size = 18,
  children,
  className,
  fill = false,
}: {
  size?: number;
  children: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-0.15em] ${className ?? ''}`}
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

/** The engineer's headset (the radio). */
export const HeadsetIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="13" width="4" height="6" rx="1.5" />
    <rect x="17" y="13" width="4" height="6" rx="1.5" />
    <path d="M19 19c0 1.7-2 3-5 3h-1.5" />
  </Icon>
);

/** Two cars side by side, one going by: a battle. */
export const OvertakeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 6l5 6-5 6" />
    <path d="M12 6l5 6-5 6" />
    <path d="M20 5v14" />
  </Icon>
);

/** A tyre: tread and rim. */
export const TyreIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Icon>
);

/** A marshal's flag: trouble on track. */
export const FlagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4L17 12H5" />
  </Icon>
);

/** The chequered flag. */
export const ChequeredIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h14v9H5" />
    <path
      d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);

/** A run of days: a streak. */
export const StreakIcon = (p: P) => (
  <Icon {...p}>
    <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />
  </Icon>
);

export const SoundOnIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Icon>
);

export const SoundOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </Icon>
);

export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/** A steering wheel: the driver. */
export const WheelIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="13" r="2" />
    <path d="M3.5 10.5c3 .8 5.5 1.5 6.6 2.3M20.5 10.5c-3 .8-5.5 1.5-6.6 2.3M12 15v6" />
  </Icon>
);

/** A grade chip: the band's colour as a small square (on screen; the share text keeps emoji). */
export function BandChip({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] align-middle"
      style={{ background: color }}
    />
  );
}

/** An indicator light: the driver's mood. */
export function MoodLight({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

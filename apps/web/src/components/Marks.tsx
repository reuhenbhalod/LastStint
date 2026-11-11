// The LastStint marks, in their one-colour (monochrome) versions from docs/LastStint Logo.html.
// Each draws in `currentColor`, so it takes the colour of the text it sits in: the colour of
// the team you race for wherever the app puts one (`text-[var(--you)]`).
//   RingMark    concept A, last-lap ring: the logo, beside the wordmark (Brand.tsx)
//   RadioMark   concept B, radio call: the Team radio panel
//   TimingMark  concept C, timing tower: the timing towers' headers

interface MarkProps {
  /** Pixels, or any CSS length such as '1em'. */
  size?: number | string;
  className?: string;
}

export function RingMark({ size = 24, className = '' }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M47.61 17.95 A21 21 0 1 1 12.03 38.49"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
      />
      <path
        d="M11.12 34.2 A21 21 0 0 1 25.51 12.03"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
      />
      <path d="M25.51 12.03 L54.04 2.76" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

export function RadioMark({ size = 24, className = '' }: MarkProps) {
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M3.01 36.73 A21 21 0 0 1 31.87 16.53"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle cx="24" cy="36" r="12" fill="none" stroke="currentColor" strokeWidth="8" />
      <path
        d="M45.3 21.09 A26 26 0 0 1 45.3 50.91"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M51.85 16.5 A34 34 0 0 1 51.85 55.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M58.4 11.91 A42 42 0 0 1 65.97 37.47"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
    </svg>
  );
}

export function TimingMark({ size = 24, className = '' }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 9 H56 L52 21 H8 Z" fill="currentColor" />
      <path d="M12 27 H50 L46 39 H8 Z" fill="currentColor" />
      <path d="M12 45 H38 L46 51 L38 57 H8 Z" fill="currentColor" />
    </svg>
  );
}

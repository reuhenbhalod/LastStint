// The LastStint logo: concept A's last-lap ring beside the wordmark (docs/LastStint Logo.html),
// in its one-colour version, drawn in the colour of the team you race for (the default teal
// when no race is loaded).

import { RingMark } from './Marks.js';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <span
      className={`disp wide inline-flex items-center gap-[0.3em] leading-none text-[var(--you)] ${className}`}
    >
      <RingMark size="1.15em" className="shrink-0" />
      LastStint
    </span>
  );
}

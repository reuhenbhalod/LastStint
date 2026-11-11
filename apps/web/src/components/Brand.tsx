// The LastStint logo: concept A's last-lap ring beside the wordmark (docs/LastStint Logo.html),
// in its one-colour white version, the same as the favicon. Always white, whatever team you race
// for (owner, 2026-11-11).

import { RingMark } from './Marks.js';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <span
      className={`disp wide inline-flex items-center gap-[0.3em] leading-none text-white ${className}`}
    >
      <RingMark size="1.15em" className="shrink-0" />
      LastStint
    </span>
  );
}

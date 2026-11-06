// The race screen's panels, broadcast style (like the leaders tower and the call): a dark plate,
// a team-colour slash and the title, an optional reading on the right. Stat tiles and bars to
// go in them, so every panel reads the same way.

export function Panel({
  label,
  title,
  right,
  children,
  className = '',
}: {
  /** The accessible name (defaults to the title). */
  label?: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label ?? title}
      className={`flex shrink-0 flex-col gap-3 rounded-lg border border-[#1F2523] bg-[#0F1312] p-3.5 ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-[5px] shrink-0 -skew-x-12 bg-[var(--you)]" />
          <span className="disp truncate text-[12px] tracking-[0.08em]">{title}</span>
        </span>
        {right}
      </header>
      {children}
    </section>
  );
}

/** A reading: a small label over a big value. */
export function Stat({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#8D9692]">
        {label}
      </dt>
      <dd
        className="disp m-0 flex min-h-[20px] items-center text-[16px] leading-none [&_.mono]:normal-case"
        style={{ color: tone }}
      >
        {children}
      </dd>
    </div>
  );
}

/** A row of readings split by hairlines. */
export function Stats({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <dl
      className={`m-0 grid gap-x-3 gap-y-3 [&>div+div]:border-l [&>div+div]:border-[#232927] [&>div+div]:pl-3 ${
        cols === 3
          ? 'grid-cols-3 [&>div:nth-child(3n+1)]:border-l-0 [&>div:nth-child(3n+1)]:pl-0'
          : 'grid-cols-2 [&>div:nth-child(2n+1)]:border-l-0 [&>div:nth-child(2n+1)]:pl-0'
      }`}
    >
      {children}
    </dl>
  );
}

/** A square meter, filled to `value` (0-1) in `color`. */
export function Bar({ value, color, label }: { value: number; color: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="h-1.5 overflow-hidden bg-[#232927]"
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div
        className="h-full transition-[width] duration-700"
        style={{ width: `${v * 100}%`, background: color }}
      />
    </div>
  );
}

// The race screen's panels, in the realistic theme: a glass plate over the ground, a team-colour
// tick and the title, an optional reading on the right. Stat tiles and bars to
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
      className={`flex shrink-0 flex-col gap-3 rounded-xl border border-[var(--glass-edge)] bg-[var(--glass)] p-3.5 backdrop-blur-[14px] ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-3 w-[3px] shrink-0 rounded-full bg-[var(--you)]" />
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {title}
          </span>
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
      <dt className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA5A0]">
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
      className={`m-0 grid gap-x-3 gap-y-3 [&>div+div]:border-l [&>div+div]:border-[#252D31] [&>div+div]:pl-3 ${
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
      className="h-1.5 overflow-hidden bg-[#252D31]"
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

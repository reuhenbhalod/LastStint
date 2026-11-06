// The LastStint wordmark. The display face sets it in capitals, where "LASTSTINT" runs together,
// so the two words take two colours: LAST in ink, STINT in the team colour.

export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`disp wide leading-none ${className}`}>
      Last<span className="text-[var(--you)]">Stint</span>
    </span>
  );
}

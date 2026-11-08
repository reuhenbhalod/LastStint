// The era map's view (build-plan 8.2; spec §14): a timeline from 2025 back to 1983 in play
// order, one node per era with its stars and its lock. A single column on a phone (no sideways
// scroll at 390 px), left to right across the page from desktop width. Lock and star states are
// spelled out in text, not shown by colour alone; open eras are links, so they're tab stops.

import type { EraMapState, EraNode } from './eraMapState.js';

export function LockIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block shrink-0 align-[-0.15em]"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  );
}

/** A star: filled, or an outline (`hollow`) for one not earned. */
export function StarIcon({ hollow = false }: { hollow?: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill={hollow ? 'none' : 'currentColor'}
      stroke="currentColor"
      strokeWidth={hollow ? 2 : 0}
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block shrink-0 align-[-0.15em]"
    >
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

/** The lock line: Unlocked, Locked (with what unlocks it) or Coming soon. */
export function LockLine({ node, testMode }: { node: EraNode; testMode: boolean }) {
  if (node.comingSoon) {
    return (
      <p className="m-0 text-[13px] font-semibold text-[var(--muted)]">
        <LockIcon open={false} /> Coming soon
      </p>
    );
  }
  if (!node.locked || !node.unlock) {
    return (
      <p className="m-0 text-[13px] font-semibold text-[var(--good)]">
        <LockIcon open /> Unlocked
      </p>
    );
  }
  const { from, threshold, remaining } = node.unlock;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="m-0 text-[13px] font-semibold text-[var(--rival)]">
        <LockIcon open={false} /> Locked{testMode ? ' · open on test' : ''}
      </p>
      <p className="m-0 text-[12px] text-[var(--muted)]">
        {threshold} stars in Era {from.eraId} to unlock ({remaining} to go)
      </p>
    </div>
  );
}

function NodeBody({ node, testMode }: { node: EraNode; testMode: boolean }) {
  const { era } = node;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">Era {era.eraId}</span>
        <span className="font-mono text-[13px] font-semibold">
          <StarIcon /> {era.stars}/{era.maxStars}
          <span className="sr-only"> stars</span>
        </span>
      </div>
      <span className="disp text-[22px] leading-none">{era.years}</span>
      <span className="text-[14px] font-semibold leading-snug">{era.name}</span>
      <span className="mt-auto pt-1">
        <LockLine node={node} testMode={testMode} />
      </span>
    </>
  );
}

const NODE = 'card flex h-full flex-col gap-1.5 !p-3 sm:!p-4';

function EraNodeCard({ node, testMode }: { node: EraNode; testMode: boolean }) {
  if (node.open) {
    return (
      <a
        href={`/eras/${node.era.eraId}`}
        className={`${NODE} hover:bg-[var(--card-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--you)] ${node.locked ? 'border-dashed' : ''}`}
      >
        <NodeBody node={node} testMode={testMode} />
      </a>
    );
  }
  return (
    <div
      aria-disabled="true"
      className={`${NODE} border-dashed opacity-70 ${node.comingSoon ? 'bg-transparent' : ''}`}
    >
      <NodeBody node={node} testMode={testMode} />
    </div>
  );
}

/** The step number above each node, joined to the next by a line: the timeline's rail. */
function Rail({ order, last }: { order: number; last: boolean }) {
  return (
    <div aria-hidden="true" className="mb-1.5 flex items-center gap-2">
      <span className="font-mono text-[11px] font-semibold text-[var(--muted)]">
        {String(order).padStart(2, '0')}
      </span>
      <span className={`h-px flex-1 ${last ? 'bg-transparent' : 'bg-[var(--rule)]'}`} />
    </div>
  );
}

/** The timeline of era nodes, newest first. */
export function EraTimeline({ nodes, testMode }: { nodes: EraNode[]; testMode: boolean }) {
  return (
    <ol
      aria-label="Eras, in play order from 2025 back to 1983"
      className="m-0 grid list-none grid-cols-1 gap-x-3 gap-y-5 p-0 sm:grid-cols-2 lg:grid-cols-5"
    >
      {nodes.map((node) => (
        <li key={node.era.eraId} className="relative min-w-0">
          <Rail order={node.era.playOrder} last={node.era.playOrder === nodes.length} />
          <EraNodeCard node={node} testMode={testMode} />
        </li>
      ))}
    </ol>
  );
}

/** The map's body for a load state: loading, the error with a retry, or the timeline. */
export function EraMapBody({ state, onRetry }: { state: EraMapState; onRetry?: () => void }) {
  switch (state.kind) {
    case 'loading':
      return <output className="block text-[var(--muted)]">Loading the eras…</output>;
    case 'error':
      return (
        <div role="alert" className="card flex flex-col items-start gap-3">
          <p className="m-0">{state.message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[var(--rule)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--card-2)]"
            >
              Try again
            </button>
          )}
        </div>
      );
    case 'ready':
      return (
        <>
          {state.testMode && (
            <p className="card m-0 text-[13px] text-[var(--muted)]">
              <span className="eyebrow !text-[var(--flag)]">Test mode</span> Every era is open.
              Locks show as they would in production.
            </p>
          )}
          <EraTimeline nodes={state.nodes} testMode={state.testMode} />
        </>
      );
  }
}

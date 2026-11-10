// The era map's view (build-plan 8.2; spec §14): a level-select path from 2025 back to 1983 in
// play order. Each era is a band with its own cartoon scene (eraMapArt.tsx) and a round node on
// a dotted trail that winds down the page, so it fits a 390 px phone without sideways scroll.
// Lock and star states are spelled out in text, not shown by colour alone; every node is a tab
// stop named by `nodeLabel` (eraMapState.ts), a link when the era is open.

import { EraScene } from './eraMapArt.js';
import {
  type EraMapState,
  type EraNode,
  currentEraId,
  isMastered,
  nodeLabel,
  nodeX,
  trailLegs,
} from './eraMapState.js';

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

/** The round node on the path: the era's number, its lock, and a chequered flag once Mastered. */
function NodeBadge({ node, current }: { node: EraNode; current: boolean }) {
  const { era } = node;
  const mastered = isMastered(node);
  const tone = node.comingSoon
    ? 'border-dashed border-[var(--muted)] bg-[var(--card)] text-[var(--muted)]'
    : node.locked
      ? 'border-[var(--rule)] bg-[var(--card-2)] text-[var(--muted)]'
      : mastered
        ? 'border-[#1c1b29] bg-[var(--flag)] text-[#1c1b29]'
        : 'border-[#1c1b29] bg-[var(--you)] text-[var(--you-ink)]';
  return (
    <span aria-hidden="true" className="relative block shrink-0">
      {current && <span className="era-node-pulse absolute inset-[-7px] rounded-full" />}
      <span
        className={`era-node relative grid h-[72px] w-[72px] place-items-center rounded-full border-4 shadow-[0_5px_0_#1c1b29] ${tone}`}
      >
        <span className="disp wide text-[28px] leading-none">{era.eraId}</span>
        {(node.locked || node.comingSoon) && (
          <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)]">
            <LockIcon open={false} />
          </span>
        )}
        {mastered && (
          <span className="checker absolute -right-1 -top-1 h-7 w-7 rounded-full border-2 border-[#1c1b29] bg-[var(--paper)]" />
        )}
      </span>
      <span className="absolute left-1/2 top-[78px] -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-[#1c1b29] bg-[var(--paper)] px-2 py-0.5 font-mono text-[12px] font-bold text-[var(--flag)]">
        <StarIcon /> {era.stars}/{era.maxStars}
      </span>
    </span>
  );
}

/** The label beside a node: era, years, name, stars and lock. */
function NodeCard({ node, testMode }: { node: EraNode; testMode: boolean }) {
  const { era } = node;
  return (
    <span className="flex min-w-0 max-w-[260px] flex-1 flex-col gap-1 rounded-xl border-2 border-[var(--rule)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-3 py-2 shadow-[0_4px_0_rgba(0,0,0,0.35)]">
      <span className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">Era {era.eraId}</span>
        <span className="font-mono text-[12px] font-semibold">
          {era.stars}/{era.maxStars}
          <span className="sr-only"> stars</span>
        </span>
      </span>
      <span className="disp text-[19px] leading-none">{era.years}</span>
      <span className="text-[13.5px] font-semibold leading-snug">{era.name}</span>
      {isMastered(node) && (
        <span className="text-[12px] font-semibold text-[var(--flag)]">Mastered</span>
      )}
      <span className="pt-0.5">
        <LockLine node={node} testMode={testMode} />
      </span>
    </span>
  );
}

const STOP =
  'era-stop absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5 rounded-2xl text-left text-[var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--flag)]';

/**
 * One era on the path. Its node and label are one tab stop, named by `nodeLabel`: a link into
 * the era when it's open, otherwise a disabled link (still focusable, so the lock is read out).
 */
function EraStop({
  node,
  index,
  testMode,
  current,
}: {
  node: EraNode;
  index: number;
  testMode: boolean;
  current: boolean;
}) {
  const x = nodeX(index);
  const left = x < 50;
  // The node's centre sits on the trail at x%; the label takes the wider side.
  const style = left
    ? { left: `calc(${x}% - 36px)`, maxWidth: `calc(${100 - x}% + 28px)` }
    : { right: `calc(${100 - x}% - 36px)`, maxWidth: `calc(${x}% + 28px)` };
  const cls = `${STOP} ${left ? '' : 'flex-row-reverse'}`;
  const label = nodeLabel(node, testMode);
  const body = (
    <>
      <NodeBadge node={node} current={current} />
      <NodeCard node={node} testMode={testMode} />
    </>
  );
  if (node.open)
    return (
      <a
        href={`/eras/${node.era.eraId}`}
        aria-label={label}
        aria-current={current ? 'step' : undefined}
        className={`${cls} hover:brightness-110`}
        style={style}
      >
        {body}
      </a>
    );
  return (
    // A locked era is a disabled link: no href, but focusable so its lock is read out.
    // biome-ignore lint/a11y/useSemanticElements: an <a> needs an href, and a locked era has none
    <span
      role="link"
      tabIndex={0}
      aria-disabled="true"
      aria-label={label}
      className={`${cls} cursor-not-allowed`}
      style={style}
    >
      {body}
    </span>
  );
}

/** The dotted trail joining the nodes, under them: bright where it leads to an open era. */
function Trail({ nodes }: { nodes: EraNode[] }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 100 ${nodes.length * 100}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    >
      {trailLegs(nodes).map((leg) => (
        <g key={leg.d} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <path
            d={leg.d}
            stroke="#1c1b29"
            strokeOpacity={0.55}
            strokeWidth={16}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={leg.d}
            stroke={leg.open ? '#ffffff' : '#8b9692'}
            strokeWidth={7}
            strokeDasharray="0.1 16"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

/** The map of era nodes, newest first, down a winding path through each era's scene. */
export function EraTimeline({ nodes, testMode }: { nodes: EraNode[]; testMode: boolean }) {
  const current = currentEraId(nodes);
  return (
    <div className="relative overflow-hidden rounded-2xl border-4 border-[#1c1b29] shadow-[0_6px_0_rgba(0,0,0,0.4)]">
      <ol aria-label="Eras, in play order from 2025 back to 1983" className="m-0 list-none p-0">
        {nodes.map((node, i) => (
          <li key={node.era.eraId} className="relative h-[230px] sm:h-[250px]">
            <EraScene eraId={node.era.eraId} />
            {(node.locked || node.comingSoon) && (
              <span aria-hidden="true" className="absolute inset-0 bg-[rgba(18,21,20,0.45)]" />
            )}
            <span className="relative z-[2] block h-full">
              <EraStop
                node={node}
                index={i}
                testMode={testMode}
                current={node.era.eraId === current}
              />
            </span>
          </li>
        ))}
      </ol>
      <Trail nodes={nodes} />
    </div>
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

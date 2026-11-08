// The credits page (/credits): every data source the races are built from, with its licence
// and a link to both (the TUM, Jolpica and F1DB licences require the credit; data/credits.ts
// has the wording). Linked from the footer, next to Privacy and Terms, and from the Eras
// screens. One column, long links wrap, so there's no sideways scroll on a phone.

import { SOURCES, type Source } from '../data/credits.js';
import { H, Page } from './Legal.js';

const UPDATED = '8 November 2026';

/** A link, underlined so it doesn't rely on colour. */
function A({ href, license, children }: { href: string; license?: boolean; children: string }) {
  return (
    <a
      href={href}
      rel={license ? 'license' : undefined}
      className="text-white underline underline-offset-2 hover:text-[var(--you)]"
    >
      {children}
    </a>
  );
}

function SourceEntry({ source }: { source: Source }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-[#1F2523] px-4 py-3">
      <h3 className="m-0 text-[15px] font-semibold text-white">
        <A href={source.url}>{source.name}</A>
      </h3>
      {source.by && <p className="m-0 text-[13px] text-[#8D9692]">{source.by}</p>}
      <p className="m-0">{source.gives}</p>
      {source.version && (
        <p className="m-0 text-[13px] text-[#8D9692]">Version used: {source.version}</p>
      )}
      {source.licence && (
        <p className="m-0 text-[14px]">
          Licence:{' '}
          <A href={source.licence.url} license>
            {source.licence.name}
          </A>
          {source.shareAlike && ' (non-commercial, share alike)'}
        </p>
      )}
      {source.note && <p className="m-0 text-[13px] text-[#8D9692]">{source.note}</p>}
    </li>
  );
}

export function Credits() {
  const licensed = SOURCES.filter((s) => s.licence);
  const courtesy = SOURCES.filter((s) => !s.licence);
  return (
    <Page title="Credits" updated={UPDATED}>
      <div className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]">
        <p className="m-0">
          LastStint’s races are rebuilt from real race data, shared by the people below. Thank you
          to all of them.
        </p>
        <H>Licensed data</H>
        <p className="m-0">
          These sources’ licences ask to be credited. Each race’s intro in Eras names the ones it
          was built from.
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {licensed.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </ul>
        <H>Also with thanks</H>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {courtesy.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </ul>
        <H>Non-commercial, share alike</H>
        <p className="m-0">
          LastStint is non-commercial: no ads, payments or sponsorship. The TUM f1-timing-database
          and Jolpica-F1 data are licensed for non-commercial use only, under{' '}
          <A href="https://creativecommons.org/licenses/by-nc-sa/3.0/" license>
            CC BY-NC-SA 3.0
          </A>{' '}
          and{' '}
          <A href="https://creativecommons.org/licenses/by-nc-sa/4.0/" license>
            CC BY-NC-SA 4.0
          </A>
          . The race files the game builds from them are adapted from that data and are shared under
          the same licence. F1DB’s data and circuit layouts are used, and adapted, under{' '}
          <A href="https://creativecommons.org/licenses/by/4.0/" license>
            CC BY 4.0
          </A>
          .
        </p>
        <p className="m-0">
          The sources above aren’t connected with LastStint and don’t endorse it. See also the{' '}
          <A href="/terms">terms</A> and the <A href="/privacy">privacy policy</A>.
        </p>
      </div>
    </Page>
  );
}

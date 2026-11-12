// The top bar on the home page, the Gauntlet, Eras and Versus: the brand, the four ways to play as
// tabs (today's daily, the Gauntlet, Eras, Versus), and on the right the streak and the account
// menu: the page's own account when it passes `right`, else the bar loads it (SiteAccount). On a
// phone the tabs take a row of their own under the brand.
// The announcement banner (AnnouncementBanner.tsx) sits directly under it.

import type { ReactNode } from 'react';
import { AnnouncementBanner } from './AnnouncementBanner.js';
import { Brand } from './Brand.js';
import { SiteAccount } from './SiteAccount.js';

export type Mode = 'daily' | 'gauntlet' | 'eras' | 'versus';

const TABS: Array<{ id: Mode; label: string; href: string }> = [
  { id: 'daily', label: 'Daily', href: '/' },
  { id: 'gauntlet', label: 'Gauntlet', href: '/gauntlet' },
  { id: 'eras', label: 'Eras', href: '/eras' },
  { id: 'versus', label: 'Versus', href: '/versus' },
];

export function TopBar({ active, right }: { active: Mode; right?: ReactNode }) {
  return (
    <>
      <header className="relative z-20 border-b border-[var(--glass-edge)] bg-[var(--paper)]/80 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-6 px-4 sm:px-6 md:grid-cols-[auto_auto_1fr]">
          <a
            href="/"
            aria-label="LastStint home"
            className="col-start-1 row-start-1 flex h-14 items-center"
          >
            <Brand className="text-[20px]" />
          </a>
          <nav
            aria-label="Ways to play"
            className="col-span-2 col-start-1 row-start-2 -mx-1 flex md:col-span-1 md:col-start-2 md:row-start-1"
          >
            {TABS.map((t) => {
              const on = t.id === active;
              return (
                <a
                  key={t.id}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`relative flex h-11 items-center px-3 text-[14px] font-semibold md:h-14 ${
                    on ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t.label}
                  {on && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[var(--ink)]" />
                  )}
                </a>
              );
            })}
          </nav>
          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end md:col-start-3">
            {right ?? <SiteAccount />}
          </div>
        </div>
      </header>
      <AnnouncementBanner />
    </>
  );
}

// The privacy policy (/privacy) and terms (/terms): what the game keeps and why, in plain
// words, and the rules for a free fan game. Linked from the footer and Google's consent screen.

import { Brand } from '../components/Brand.js';
import { Disclaimer } from '../components/Disclaimer.js';

const CONTACT = 'purohit.abhiram@gmail.com';
const UPDATED = '6 November 2026';

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-[#1F2523] px-4 md:h-16 md:px-6">
        <a href="/" className="disp wide text-[18px] leading-none hover:text-[var(--you)]">
          <Brand />
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 py-8 text-[15px] leading-relaxed text-[#D5DAD7] md:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="disp m-0 text-[28px] leading-none text-white">{title}</h1>
          <span className="text-[13px] text-[#8D9692]">Last updated {UPDATED}</span>
        </div>
        {children}
      </main>
      <div className="mx-auto w-full max-w-[680px] px-4 md:px-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="disp m-0 mt-2 text-[16px] text-white">{children}</h2>;
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <p className="m-0">
        LastStint is a free, fan-made race-strategy game. This page says what it keeps about you,
        why, and how to have it removed. There are no ads, no tracking scripts and no selling of
        data.
      </p>
      <H>What we keep</H>
      <ul className="m-0 flex flex-col gap-2 pl-5">
        <li>
          <b>A random player ID</b>, made in your browser and kept in its storage, so the game knows
          your runs. It isn’t linked to who you are unless you sign in.
        </li>
        <li>
          <b>Your runs:</b> the date, the race, the calls you made, your score and finishing place.
          These make the daily results, the leaderboard and your streak.
        </li>
        <li>
          <b>If you sign in</b> (with Google, or with an email and password): your name and email
          address from that account, the account’s ID, and the display name and favourite team you
          choose. The display name shows on the leaderboards; your email never does.
        </li>
        <li>
          <b>Your IP address</b> is used for a moment to limit how often runs can be sent, and isn’t
          stored by the game.
        </li>
      </ul>
      <H>Who handles it</H>
      <p className="m-0">
        The game runs on Cloudflare, which stores the runs and accounts. Signing in is handled by
        Auth0 (Okta) and, if you choose Google, by Google. They act for us and follow their own
        privacy policies. Nothing is shared with anyone else.
      </p>
      <H>In your browser</H>
      <p className="m-0">
        The game keeps your player ID, a race in progress, and settings such as sound in your
        browser’s storage. Signing in keeps a sign-in session there too. Clearing the site’s data
        removes them.
      </p>
      <H>Removing your data</H>
      <p className="m-0">
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your account and we’ll
        delete your account and runs within 30 days. Signed-out runs are tied only to a random ID;
        tell us the date and we’ll remove them too.
      </p>
      <H>Children</H>
      <p className="m-0">
        LastStint isn’t meant for children under 13, and we don’t knowingly keep their data.
      </p>
      <H>Changes and contact</H>
      <p className="m-0">
        If this policy changes, the date above changes with it. Questions:{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <p className="m-0">
        LastStint is a free, fan-made game. By playing it you agree to these terms.
      </p>
      <H>The game</H>
      <p className="m-0">
        The races are simulated from real race data for fun. Results, odds and grades are the
        game’s, not facts about real races, teams or drivers. LastStint is unofficial and isn’t
        endorsed by or associated with Formula 1, the FIA, any team or any driver.
      </p>
      <H>Your account</H>
      <p className="m-0">
        Keep your sign-in to yourself, and choose a display name that isn’t offensive or someone
        else’s. We may change or remove a display name, or close an account, that breaks these terms
        or tries to cheat the leaderboards.
      </p>
      <H>Fair play</H>
      <p className="m-0">
        Don’t tamper with the game or the server, send fake runs, or overload the site. The server
        checks every run and may refuse or remove ones that don’t add up.
      </p>
      <H>No warranty</H>
      <p className="m-0">
        The game is provided as it is, free of charge, and may change, pause or stop at any time. To
        the extent the law allows, we aren’t liable for any loss from using it.
      </p>
      <H>Privacy and contact</H>
      <p className="m-0">
        What we keep is in the <a href="/privacy">privacy policy</a>. Questions:{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </Page>
  );
}

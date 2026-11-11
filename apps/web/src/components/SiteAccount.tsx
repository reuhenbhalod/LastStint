// The top bar's right side on the pages that don't bring their own account (the Gauntlet, Eras,
// Versus): the streak and the account menu, the profile sheet when it's open, and the favourite
// team's colour on the bar (`--fav`). The daily brings its own (App.tsx), which also reloads
// the race when the player signs in or out.

import { createPortal } from 'react-dom';
import { useAccount } from '../account/useAccount.js';
import { useFavouriteColour } from '../game/teamTheme.js';
import { AccountBar } from './AccountBar.js';
import { ProfileSheet } from './ProfileSheet.js';

const noop = () => {};

export function SiteAccount() {
  const account = useAccount(noop);
  useFavouriteColour(account.player?.account?.favouriteTeam);
  return (
    <>
      <AccountBar account={account} compact />
      {/* On the page, not in the bar: the bar's blur would pin the sheet to the bar. */}
      {account.profileOpen && createPortal(<ProfileSheet account={account} />, document.body)}
    </>
  );
}

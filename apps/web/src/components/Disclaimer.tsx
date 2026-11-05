// The legal notice (F1's fan guidelines, formula1.com/en/information/guidelines): an unofficial
// site about F1 carries this wording in the footer of its pages, word for word, plus that the
// teams and drivers named aren't associated with it either.

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <footer
      className={`mx-auto max-w-3xl px-6 pb-6 text-center text-[11px] leading-relaxed text-[var(--muted)] ${className}`}
    >
      <p className="m-0">
        This website is unofficial and is not associated in any way with the Formula 1 companies.
        F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks
        are trade marks of Formula One Licensing B.V.
      </p>
      <p className="m-0 mt-1">
        Pit Wall is a fan-made strategy game. It isn’t endorsed by or associated with the FIA, any
        team or any driver; team and driver names are used only to describe the real races, and team
        names and colours belong to their owners.
      </p>
    </footer>
  );
}

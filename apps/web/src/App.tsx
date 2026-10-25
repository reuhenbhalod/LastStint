// Phase 0 placeholder shell. The real game screens (daily card, race, decision, results)
// arrive in Phase 3. Mobile-first: designed for a 390px screen.

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Pit Wall</p>
      <h1 className="text-3xl font-bold">BoxThisLap</h1>
      <p className="text-neutral-400">
        A daily F1 strategy game. Phase 0 scaffold — the daily race arrives in Phase 3.
      </p>
      <footer className="mt-8 text-[10px] text-neutral-600">Not affiliated with Formula 1.</footer>
    </main>
  );
}

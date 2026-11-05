// The race in your team's colours: your car, your accents and buttons take the team's livery
// colour (Ferrari red, McLaren papaya...), the rival takes theirs. Where the two would look
// alike (team-mates, or two reds), the rival falls back to a colour that stands apart. Good
// news keeps its own colour (--good), so a red team never reads as bad news.

import type { RaceModel } from '@boxthislap/sim';
import { useEffect } from 'react';

/** Each team's colour, picked to read on the dark pit-wall cards. */
export const TEAM_COLOR: Record<string, string> = {
  Mercedes: '#00d2be',
  Ferrari: '#e8002d',
  'Red Bull Racing': '#3671c6',
  McLaren: '#ff8000',
  Alpine: '#2293d1',
  'Aston Martin': '#229971',
  Williams: '#64c4ff',
  AlphaTauri: '#5e8faa',
  RB: '#6692ff',
  'Racing Bulls': '#6692ff',
  'Toro Rosso': '#469bff',
  'Alfa Romeo': '#c92d4b',
  'Alfa Romeo Racing': '#c92d4b',
  Sauber: '#c92d4b',
  'Kick Sauber': '#52e252',
  'Haas F1 Team': '#b6babd',
  'Racing Point': '#f596c8',
  'Force India': '#ff80c7',
  Renault: '#fff500',
};

/** The colours used when a team has none, or the rival's would clash with yours. */
const DEFAULT_YOU = '#19c7b4';
const FALLBACKS = ['#f2a13a', '#b48cff', '#e9ece9'];

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Text that reads on a background of `hex`: near-black on light colours, white on dark. */
export function inkOn(hex: string): string {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? '#0b0f0e' : '#ffffff';
}

/** How far apart two colours look (0-~440, a rough redmean distance). */
export function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2,
  );
}

/** Close enough to be mistaken for each other on the map. */
const CLASH = 150;

export interface TeamTheme {
  you: string;
  youInk: string;
  rival: string;
  rivalInk: string;
}

export function teamTheme(model: RaceModel): TeamTheme {
  const team = (code: string) => model.drivers.find((d) => d.code === code)?.team ?? '';
  const you = TEAM_COLOR[team(model.userSide)] ?? DEFAULT_YOU;
  const theirs = TEAM_COLOR[team(model.rival)];
  const rival =
    theirs && colourDistance(theirs, you) >= CLASH
      ? theirs
      : (FALLBACKS.find((c) => colourDistance(c, you) >= CLASH) as string);
  return { you, youInk: inkOn(you), rival, rivalInk: inkOn(rival) };
}

/** Put the race's team colours on the page while `model` is shown (the defaults after). */
export function useTeamTheme(model: RaceModel | null | undefined): void {
  useEffect(() => {
    if (!model) return;
    const t = teamTheme(model);
    const root = document.documentElement.style;
    root.setProperty('--you', t.you);
    root.setProperty('--you-ink', t.youInk);
    root.setProperty('--rival', t.rival);
    root.setProperty('--rival-ink', t.rivalInk);
    return () => {
      for (const v of ['--you', '--you-ink', '--rival', '--rival-ink']) root.removeProperty(v);
    };
  }, [model]);
}

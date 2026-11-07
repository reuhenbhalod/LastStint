// The race in your team's colours: your car, your accents, buttons and good news (trust, tyre
// life, battery, a pass) take the team's livery colour (Ferrari red, McLaren papaya...); the
// rival takes their own real car's colour. Where the two would look alike (team-mates, or two
// reds), the rival falls back to a colour that stands apart. With a red team, warnings and BOX
// turn amber, so good news and bad never look the same.

import type { RaceModel } from '@laststint/sim';
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
  /** Warnings and BOX: red, or amber when your team is red. */
  box: string;
  boxInk: string;
}

/** Warnings and BOX: the pit-wall red, or amber beside a red team. */
const BOX_RED = { box: '#d4432f', boxInk: '#f07462' };
const BOX_AMBER = { box: '#d9731a', boxInk: '#f2a65a' };

export function teamTheme(model: RaceModel): TeamTheme {
  const team = (code: string) => model.drivers.find((d) => d.code === code)?.team ?? '';
  const you = TEAM_COLOR[team(model.userSide)] ?? DEFAULT_YOU;
  const theirs = TEAM_COLOR[team(model.rival)];
  const rival =
    theirs && colourDistance(theirs, you) >= CLASH
      ? theirs
      : (FALLBACKS.find((c) => colourDistance(c, you) >= CLASH) as string);
  const box = colourDistance(you, BOX_RED.box) < CLASH ? BOX_AMBER : BOX_RED;
  return { you, youInk: inkOn(you), rival, rivalInk: inkOn(rival), ...box };
}

const THEMED = [
  '--you',
  '--you-ink',
  '--rival',
  '--rival-ink',
  '--good',
  '--good-ink',
  '--box',
  '--box-ink',
];

/**
 * Put the race's team colours on the page while `model` is shown (the defaults after).
 * `favourite`: the player's favourite team (docs/auth0-spec.md A4), whose colour takes the
 * accent instead (the home page).
 */
export function useTeamTheme(model: RaceModel | null | undefined, favourite?: string | null): void {
  useEffect(() => {
    if (!model) return;
    const race = teamTheme(model);
    const fav = favourite ? TEAM_COLOR[favourite] : undefined;
    const t = fav ? { ...race, you: fav, youInk: inkOn(fav) } : race;
    const root = document.documentElement.style;
    root.setProperty('--you', t.you);
    root.setProperty('--you-ink', t.youInk);
    root.setProperty('--rival', t.rival);
    root.setProperty('--rival-ink', t.rivalInk);
    // Good news in the team's colour too.
    root.setProperty('--good', t.you);
    root.setProperty('--good-ink', t.youInk);
    root.setProperty('--box', t.box);
    root.setProperty('--box-ink', t.boxInk);
    return () => {
      for (const v of THEMED) root.removeProperty(v);
    };
  }, [model, favourite]);
}

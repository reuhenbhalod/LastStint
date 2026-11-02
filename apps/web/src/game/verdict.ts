// The result as the team manager sees it (feedback spec S3): you're running the real team's
// pit wall, so the bar is what that pit wall really achieved. Finish ahead of the real result
// and you beat them; level, you matched them; behind, the real team did better.

export interface Verdict {
  outcome: 'beat' | 'matched' | 'worse';
  headline: string;
  detail: string;
}

export function verdict(
  pos: number,
  realPos: number,
  team: string,
  driver: string,
  rival: string,
  beatRival: boolean,
): Verdict {
  const you = `${driver} P${pos}${beatRival ? `, ahead of ${rival}` : `, behind ${rival}`}.`;
  const real = realPos > 0 ? `The real ${team} pit wall finished P${realPos}.` : '';
  if (realPos <= 0 || pos === realPos) {
    return {
      outcome: 'matched',
      headline: pos === 1 ? `You matched ${team}: a win` : `You matched ${team}`,
      detail: `${you} ${real}`.trim(),
    };
  }
  if (pos < realPos) {
    return { outcome: 'beat', headline: `You beat ${team}!`, detail: `${you} ${real}` };
  }
  return { outcome: 'worse', headline: `${team} did better`, detail: `${you} ${real}` };
}

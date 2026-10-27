// Queue check (Implementation Plan 4.6, Phase 4 spec C3): how many days are scheduled ahead,
// and an alert when the queue runs low. Runs from the daily cron; /api/health reports it.

import { addDays, todayUtc } from './dates.js';
import { scheduledFrom } from './db.js';

/** Warn when fewer than this many days (from today, UTC) are scheduled. */
export const LOW_QUEUE_DAYS = 7;

/** Consecutive scheduled days starting today (UTC). 0 means today itself is missing. */
export async function queueDays(db: D1Database, now: number): Promise<number> {
  const today = todayUtc(now);
  const dates = await scheduledFrom(db, today);
  let days = 0;
  for (const d of dates) {
    if (d !== addDays(today, days)) break;
    days++;
  }
  return days;
}

export interface QueueAlert {
  level: 'error' | 'warn';
  message: string;
}

/** The alert for a queue length, or null when the queue is healthy. */
export function queueAlert(days: number): QueueAlert | null {
  if (days < 2) {
    return {
      level: 'error',
      message: `Daily queue: ${days === 0 ? "today's" : "tomorrow's"} race is not scheduled.`,
    };
  }
  if (days < LOW_QUEUE_DAYS) {
    return { level: 'warn', message: `Daily queue is low: ${days} days scheduled.` };
  }
  return null;
}

/** The cron job: log the queue state and post an alert to ALERT_WEBHOOK if one is set. */
export async function checkQueue(
  db: D1Database,
  now: number,
  webhook: string | undefined,
  send: typeof fetch = fetch,
): Promise<QueueAlert | null> {
  const days = await queueDays(db, now);
  const alert = queueAlert(days);
  if (!alert) {
    console.log(`Daily queue: ${days} days scheduled.`);
    return null;
  }
  if (alert.level === 'error') console.error(alert.message);
  else console.warn(alert.message);
  if (webhook) {
    // `content` is Discord's field, `text` is Slack's.
    const res = await send(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: alert.message, text: alert.message }),
    });
    if (!res.ok) console.error(`Alert webhook returned ${res.status}`);
  }
  return alert;
}

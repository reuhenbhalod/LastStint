// Submitting a finished Eras attempt (eras spec §6, §9, §13; build plan 8.7): the call log, the
// game's claimed grades, the untimed mark and (Expert) the rival's recorded choices go to
// POST /api/eras/attempts/:id, which replays and evaluates the attempt. Every answer becomes the
// run's Submission (state/machine.ts): the stars, the calls held for later, or an error that
// says what happened and whether a retry can help.

import type { RivalChoice } from '@laststint/sim';
import { ApiError } from '../api.js';
import type { RunSubmission } from '../data/api.js';
import type { Submission } from '../state/machine.js';
import type { EraDaily } from './EraProvider.js';
import type { AttemptSubmission, ErasApi } from './api.js';
import { attemptUntimed, clearUntimed } from './difficulty/untimed.js';

/** What the submit needs from the game: its calls and claims, and the rival's choices. */
export interface FinishedAttempt {
  submission(anonId: string): Promise<RunSubmission>;
  rivalChoices(): RivalChoice[];
}

/** The submit body for an attempt (exported for tests). */
export async function attemptBody(
  game: FinishedAttempt,
  attempt: EraDaily,
  untimed: boolean,
): Promise<AttemptSubmission> {
  // The player is named by the API client; the run body's anonId isn't sent.
  const { decisions, grades } = await game.submission('');
  return {
    decisions,
    grades,
    untimed,
    ...(attempt.difficulty.rivalPolicy === 'expert' ? { rivalClaims: game.rivalChoices() } : {}),
    ...(attempt.modelHash ? { modelHash: attempt.modelHash } : {}),
  };
}

/** A failure the server answered on purpose (not worth sending again at once). */
function deliberate(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  return e.status < 500 || e.status === 501 || e.code === 'race-not-ready';
}

const NEW_ATTEMPT = 'Start a new attempt to play it again.';

/** What a failed submit means for the player (exported for tests). */
export function submitFailure(e: unknown): Submission {
  if (!(e instanceof ApiError)) {
    return { status: 'error', error: 'Can’t reach the server. Check your connection and retry.' };
  }
  switch (e.code) {
    case 'rival-unavailable':
      return {
        status: 'eras-held',
        message:
          'Your calls are saved, but the server can’t check this rival yet. Your stars are awarded once it can.',
      };
    case 'race-not-ready':
      return {
        status: 'error',
        retry: false,
        error:
          'This race can’t award stars yet: its Eras objectives aren’t finished. Your calls are graded below.',
      };
    case 'model-changed':
      return {
        status: 'error',
        retry: false,
        error: `This race was updated after your attempt started, so it can’t be scored. ${NEW_ATTEMPT}`,
      };
    case 'attempt-expired':
      return {
        status: 'error',
        retry: false,
        error: `Attempts expire 24 hours after they start, and this one has. ${NEW_ATTEMPT}`,
      };
    case 'already-submitted':
      return {
        status: 'eras-held',
        message: 'This attempt was already submitted. Its stars are on the era page.',
      };
    case 'no-attempt':
      return {
        status: 'error',
        retry: false,
        error: `The server has no record of this attempt. ${NEW_ATTEMPT}`,
      };
    case 'rate-limited':
      return { status: 'error', error: 'Too many submissions at once. Wait a moment, then retry.' };
  }
  if (e.status === 400) {
    return {
      status: 'error',
      retry: false,
      error: `The server couldn’t verify this attempt (${e.code}). ${NEW_ATTEMPT}`,
    };
  }
  if (e.status >= 500) {
    return { status: 'error', error: `The server had a problem (${e.code}). Retry in a moment.` };
  }
  return { status: 'error', retry: false, error: `The server refused this attempt (${e.code}).` };
}

/**
 * Submit the attempt and say how it went. A request that failed in transit (network, a server
 * error) is sent once more before giving up, as a Daily run is. The untimed mark is forgotten
 * once the server has the attempt (or never can), and kept while a retry can still send it.
 */
export async function submitAttempt(
  game: FinishedAttempt,
  attempt: EraDaily,
  api: ErasApi,
): Promise<Submission> {
  const id = attempt.attemptId;
  const body = await attemptBody(game, attempt, attemptUntimed(id));
  let outcome: Submission;
  try {
    let result: Awaited<ReturnType<ErasApi['submitAttempt']>>;
    try {
      result = await api.submitAttempt(id, body);
    } catch (e) {
      if (deliberate(e)) throw e;
      result = await api.submitAttempt(id, body);
    }
    outcome = { status: 'eras-done', result };
  } catch (e) {
    outcome = submitFailure(e);
  }
  if (outcome.status !== 'error' || outcome.retry === false) clearUntimed(id);
  return outcome;
}

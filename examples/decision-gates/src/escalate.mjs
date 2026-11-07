// The escalation path: decide first, then diagnose.
//
// Run the gate. If it does not pass, hand the ticket to the diagnoser, which
// explains why and proposes specific improvements. The gate's route is
// preserved: the worker explains, it never re-decides.
//
// The default diagnose set is the routes where feedback helps: `revise` and
// `escalate`. So a `revise` verdict comes back with the specific phrase to fix,
// and an `escalate` verdict with the material that is missing. `stop` is
// terminal — there is no work to improve — and is not diagnosed.
//
// The result carries a `comment`: the diagnosis rendered as Markdown, ready to
// post back to the ticket (a tracker comment or a review note). The kit does
// not post it; the surrounding agent or workflow does.

import { runGate } from './gate.mjs';
import { formatDiagnosis } from './worker.mjs';

export const DIAGNOSE_ROUTES = ['revise', 'escalate'];

export async function runEscalation({ gate, provider, worker, state, routes = DIAGNOSE_ROUTES }) {
  const result = await runGate(gate, provider, state);
  if (!routes.includes(result.route)) {
    return { ...result, escalated: false, diagnosis: null, comment: null };
  }
  const diagnosis = await worker.diagnose({ gate, result, state });
  return {
    ...result,
    escalated: true,
    diagnosis,
    comment: formatDiagnosis(diagnosis, { gate: gate.id, route: result.route }),
  };
}

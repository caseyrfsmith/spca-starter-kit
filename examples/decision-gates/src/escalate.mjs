// The escalation path: decide first, then diagnose.
//
// Run the gate. If it does not pass, hand the ticket to the diagnoser, which
// explains why and proposes specific improvements. The gate's route is
// preserved: the worker explains, it never re-decides.
//
// The default diagnose set is every non-pass route, so a `revise` verdict comes
// back with the specific phrase to fix, and an `escalate` verdict comes back
// with the material that is missing.
//
// The result carries a `comment`: the diagnosis rendered as Markdown, ready to
// post back to the ticket (a tracker comment or a review note). The kit does
// not post it; the surrounding agent or workflow does.

import { runGate } from './gate.mjs';
import { formatDiagnosis } from './worker.mjs';

export const DIAGNOSE_ROUTES = ['revise', 'escalate', 'review'];

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

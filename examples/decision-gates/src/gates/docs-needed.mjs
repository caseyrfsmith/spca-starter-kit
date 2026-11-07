import { routeChoice } from '../routing.mjs';

// Does a change require a documentation change? Run this at ingestion, on each
// merged change or ticket, so the queue is populated and pre-ranked before a
// person looks. `stop` means "no documentation work"; `escalate` means the
// change could not be judged from what was supplied.

const REASONS = {
  required: 'readers are affected and the docs do not yet cover it',
  not_required: 'internal-only, or already covered by an existing page',
  unclear: 'cannot tell from the supplied change whether readers are affected',
};

export const docsNeeded = {
  id: 'docs-needed',
  version: '0.1',
  summary: 'Decide whether a change requires a documentation change.',
  questions: {
    impact: {
      type: 'choice',
      instructions: 'Does the change described in `change` require a documentation change?',
      criteria: {
        required: 'User-visible behavior, interfaces, or steps changed and the docs do not yet cover it.',
        not_required: 'Internal-only, or already covered by an existing page.',
        unclear: 'Cannot tell from the supplied change whether readers are affected.',
      },
    },
  },
  policy: {
    routes: { required: 'pass', not_required: 'stop', unclear: 'escalate' },
    reviewBelow: 0.6,
  },
  demo: { impact: { choice: 'required', confidence: 0.9 } },
  escalation: {
    decision: { impact: { choice: 'unclear', confidence: 0.9 } },
    diagnosis: {
      summary: 'The change is described too vaguely to judge whether readers are affected.',
      vague: ['The change description does not name the affected interface'],
      missing: ['Which public interface, step, or setting changed'],
      suggested: ['Name the changed interface and say whether the docs already cover it'],
    },
  },
  decide(answers) {
    const answer = answers.impact;
    return {
      route: routeChoice(answer, this.policy.routes, this.policy.reviewBelow),
      choice: answer.choice,
      confidence: answer.confidence ?? null,
      reason: REASONS[answer.choice],
    };
  },
};

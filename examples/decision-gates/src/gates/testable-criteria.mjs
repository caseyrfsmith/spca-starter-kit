import { routeChoice } from '../routing.mjs';

// Are a ticket's acceptance criteria testable? The reason they are not testable
// selects the route: vague criteria go back to the author, criteria that defer
// to material not included need a person, and observable criteria proceed.
//
// An earlier version asked "are they testable?" and "is the context missing?"
// as two separate probabilities; the model entangled them, so the reason-based
// Choice replaced them.

const REASONS = {
  observable: 'criteria describe observable outcomes',
  vague: 'criteria are too vague or subjective to check',
  deferred: 'criteria defer to material that is not included',
  absent: 'the ticket has no real acceptance criteria',
};

export const testableCriteria = {
  id: 'testable-criteria',
  version: '0.3',
  summary: "Classify why a ticket's acceptance criteria are not testable, and route accordingly.",
  questions: {
    failureMode: {
      type: 'choice',
      instructions: 'What best describes the acceptance criteria in `ticket`?',
      criteria: {
        observable: 'They describe observable outcomes that could be checked.',
        vague: 'They are too vague or subjective to check (for example, "feels faster").',
        deferred: 'They defer to material not included in the ticket (a spec, design doc, or screenshot).',
        absent: 'The ticket has no real acceptance criteria.',
      },
    },
  },
  policy: {
    routes: { observable: 'pass', vague: 'revise', deferred: 'escalate', absent: 'revise' },
    reviewBelow: 0.6,
  },
  demo: { failureMode: { choice: 'observable', confidence: 0.95 } },
  escalation: {
    decision: { failureMode: { choice: 'vague', confidence: 0.9 } },
    diagnosis: {
      summary: 'The acceptance criteria are subjective and cannot be verified as written.',
      vague: ['The dashboard should feel faster', 'look better'],
      missing: ['A target for load time, or a definition of "faster"'],
      suggested: ['The dashboard loads in under 2 seconds on a cold start'],
    },
  },
  decide(answers) {
    const answer = answers.failureMode;
    return {
      route: routeChoice(answer, this.policy.routes, this.policy.reviewBelow),
      choice: answer.choice,
      confidence: answer.confidence ?? null,
      reason: REASONS[answer.choice],
    };
  },
};

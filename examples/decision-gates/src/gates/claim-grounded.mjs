import { routeChoice } from '../routing.mjs';

// How does a draft relate to its source? This is the verified cascade: a
// working model drafts, then a gate checks the draft against the material it
// was supposed to be grounded in. The relationship selects the route — a draft
// the source contradicts goes back to the author; a draft that cannot be judged
// because the material was not supplied needs a person.
//
// An earlier version asked this as a single probability. The model folded "no
// source was supplied" into "the claim is unsupported", so a missing source
// came back as revise instead of escalate. Naming the reason separates them.

const REASONS = {
  supported: "the source supports the draft's claims",
  unsupported: 'the source does not support the claims',
  missing: 'the material needed to judge was not supplied',
};

export const claimGrounded = {
  id: 'claim-grounded',
  version: '0.2',
  summary: 'Classify how a draft relates to its source, and route accordingly.',
  questions: {
    evidence: {
      type: 'choice',
      instructions: 'How does `draft` relate to `source`?',
      criteria: {
        supported: "The source supports the draft's factual claims.",
        unsupported: 'The source does not support the claims: it contradicts them or is silent on them.',
        missing: 'The material needed to judge the claims is not provided.',
      },
    },
  },
  policy: {
    routes: { supported: 'pass', unsupported: 'revise', missing: 'escalate' },
    reviewBelow: 0.6,
  },
  demo: { evidence: { choice: 'supported', confidence: 0.95 } },
  escalation: {
    decision: { evidence: { choice: 'missing', confidence: 0.9 } },
    diagnosis: {
      summary: 'The source needed to check the draft was not supplied.',
      vague: ['The draft makes a claim the supplied source does not mention'],
      missing: ['The source passage that supports the claim'],
      suggested: ['Attach the source paragraph, or remove the unsupported claim'],
    },
  },
  decide(answers) {
    const answer = answers.evidence;
    return {
      route: routeChoice(answer, this.policy.routes, this.policy.reviewBelow),
      choice: answer.choice,
      confidence: answer.confidence ?? null,
      reason: REASONS[answer.choice],
    };
  },
};

// Can a reader's question be answered from the material you supplied?
//
// A single clear proposition is a good Noul: there is one yes/no fact, and the
// probability itself carries the uncertainty. High confidence answers; anything
// else is handed to a person or a search rather than guessed. Run it before a
// model is allowed to answer, so an unanswerable question becomes a handoff, not
// a hallucination.

export const answerable = {
  id: 'answerable',
  version: '0.1',
  summary: 'Decide whether a reader question can be answered from the supplied context.',
  questions: {
    answerable: {
      type: 'noul',
      instructions: 'The question in `question` can be answered from the context in `context`.',
    },
  },
  policy: { passAt: 0.8 },
  demo: { answerable: { probability: 0.95 } },
  escalation: {
    decision: { answerable: { probability: 0.2 } },
    diagnosis: {
      summary: 'The supplied context does not contain the answer to the question.',
      vague: ['The question is broader than the context provided'],
      missing: ['The page or section that answers the question'],
      suggested: ['Retrieve the page that covers the question, or hand it to a person'],
    },
  },
  decide(answers) {
    const probability = answers.answerable.probability;
    if (probability >= this.policy.passAt) {
      return { route: 'pass', probability, reason: 'the question is answerable from the context' };
    }
    return { route: 'escalate', probability, reason: 'not answerable from the context; hand it to a person or a search' };
  },
};

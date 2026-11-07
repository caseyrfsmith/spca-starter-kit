# Tuning a gate

A gate has two parts you can change: **the question** and **the policy**. Change
the question first — a good policy on a bad question still routes badly.

The kit ships placeholder policies and small example datasets. They demonstrate
the mechanism; they are not calibrated for your workflow.

## 1. Fix the question before the bands

The failure to watch for is **entanglement**: two judgments that always move
together, so no threshold can separate them. The symptom is a gate that sends
everything to one route, or that routes two obviously different cases the same
way.

The cause is usually a single question doing two jobs. The fix is a
**reason-based Choice**: ask *why*, and let the reason select the route.

Two gates in this kit were reshaped this way:

| Gate | First version | Reshaped version |
| --- | --- | --- |
| `testable-criteria` | Two Nouls: "are they testable?" + "is context missing?" — the model folded missing context into the testability score | One Choice: observable / vague / deferred / absent |
| `claim-grounded` | One Noul: "is the draft supported?" — a missing source read as "unsupported" | One Choice: supported / unsupported / missing |

Rules of thumb:

- One interpretation, one known answer space. Avoid "is this good?".
- If the reasons for *not* passing lead to *different actions*, they are
  different criteria.
- Use a Noul only for a single clear proposition (see `answerable`).
- **Do not gate what a linter or a template check can decide.** Spelling, prose
  style (Vale), required headings and links are deterministic: keep them in
  ordinary code and run them first. A gate is only for the semantic criteria
  they cannot settle.

## 2. Build a labeled dataset

Label the gate's own decision, not the artifact's worth. One row is
`{ id, expected, state }`, where `expected` is the route you believe is correct.

- **Start small.** Around fifty real cases beats ten invented ones.
- **Include the hard cases:** the clear pass, the clear fail, the ambiguous
  middle, the missing-material case, and the borderline one.
- **Label independently.** The person labeling should not see the model's
  answer first.
- **Record the policy version.** If your routes change, the labels may need to.

Keep each dataset at `data/<gate id>.jsonl`. The kit's tests check that every
row is well formed and that the gate can actually produce its expected route.

## 3. Choose routes and bands from the numbers

```sh
OPENROUTER_API_KEY=... node bin/calibrate.mjs --gate <id> --provider decisions --model typesafe/jev-1.14
```

Read the two error types **separately**:

- `falseApprovals` — bad artifacts allowed through. Usually the expensive one.
- `falseRejections` — good artifacts blocked. Usually the cheap one to fix.

Set the policy so the error you can least afford stays near zero, even at the
cost of more of the other. Do not chase accuracy alone: a high score on a tiny,
unrepresentative sample is not calibration.

- **Choice gates:** the `routes` map is the policy; `reviewBelow` controls what
  is auto-actioned.
- **Noul gates:** `passAt` and `reviseAt` set the bands. Widening the middle
  sends more cases to a person.

## 4. Tune the confidence band

`reviewBelow` decides how unsure a classification may be before it is
auto-actioned. Confidence is a measure of how concentrated the model's answer is,
**not** how likely it is to be right.

- Lower it to auto-action more; raise it to escalate more.
- Set it so the auto-act band's error rate is one you can live with.

## 5. Re-tune when the world changes

Re-run the dataset, and keep the old version, whenever:

- the model or its version changes,
- the question wording changes,
- the input distribution changes (a new team, a new content type), or
- you change a route or a threshold.

## 6. Keep a record

Log, per evaluation: the gate id and version, the question text, the model and
version, the raw answers (probabilities), the threshold applied, the route, and —
when you learn it — the outcome. The outcome is what lets you relabel and
improve. Where a gate acts automatically, keep its decisions visible where the
work lives (a label or a comment), not only in a log.

## 7. Diagnose, do not re-decide

When a gate flags an item, an LLM worker can explain why and propose specific
improvements (the README's escalation path). Keep the two roles separate: the
gate decides the route, and the worker writes the feedback. Do not let the
worker override the route, or the calibrated decision stops being the decision.
Treat the worker's output as a suggestion to a human, not as a new verdict — and
remember it can be wrong about *why* something is vague.

## 8. Checklist

- [ ] The question has one interpretation and a known answer space.
- [ ] The dataset includes clear passes, clear failures and ambiguous cases.
- [ ] At least ~50 labeled cases; more for consequential gates.
- [ ] `bin/calibrate.mjs` run; false approvals and rejections read separately.
- [ ] Routes and bands chosen from the cost of each error.
- [ ] `reviewBelow` set for the risk you accept.
- [ ] `node --test` passes (dataset and policy are coherent).
- [ ] The decision, dataset version and model version are recorded.

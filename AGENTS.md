# Use the SPCA Starter Kit

Read README.md and examples/README.md, then apply the example that matches the user's task. Inspect the target project's existing instructions, templates, configuration and checks first. Do not assume every included example belongs in that project.

## Choose an example

| User's task | Start here | Check it with |
|---|---|---|
| Draft an incident report | templates/incident-report.md and docs/INCIDENT-REPORTS.md | Human review of evidence, inferences and unknowns; no dedicated automatic validator |
| Validate structured tickets with Python | templates/linear-ticket.md, tools/validate.py | python3 -m unittest discover -s tests -v; then validate passing/failing files |
| Use the JavaScript Markdown parser or mock read-back | examples/tactical/README.md | npm ci, npm test and npm run check inside examples/tactical; requires Node.js and Vale |
| Add TG-002 prose rules | examples/tactical/.vale.ini and its styles/SPCA rules | Explicitly pass that config to Vale; use fixtures/todo.md, stock.md and plain.md |
| Check page shapes against templates | vale/docshape.ini, vale/styles/DocShape and vale/styles/config/scripts | Lint examples/page-shapes/recipe-pass.md and recipe-missing-check.md with that config |
| Try edit-time agent feedback | README.md agent sections and example hook settings | First test the underlying validator; then verify dispatch in the actual agent runtime |
| Adapt other guide patterns | examples/snippets/ and snippets.json | Read the source/context and implement the product-specific pieces before executing them |
| Run the decision gates on tickets and drafts | examples/decision-gates/README.md and TUNING.md | npm test and the CLIs inside examples/decision-gates; a live run needs a provider key |
| Drive the gate loop on a ticket: write back to a tracker and open a PR | examples/decision-gates/OPERATOR.md and bin/operator.mjs | npm test, then operator plan and run --dry-run inside examples/decision-gates; a live write-back needs LINEAR_API_KEY |

## Apply and verify

- Adapt or merge the selected files into the target project; preserve its existing configuration. Do not overwrite agent settings or enable hooks merely because the archive contains examples.
- Keep each ticket template with its matching validator: the Python and JavaScript examples use different section names. Do not run a ticket validator against arbitrary documentation pages.
- Vale does not load custom rules by default. Select the matching configuration explicitly. The original kit rules, TG-002 rules and DocShape rules are three separate configurations. Run python3 tools/check_vale.py from this kit root to test all three.
- Demonstrate both a passing case and a deliberately failing case, then run the target project's relevant checks. Report commands, versions, observed results and limitations. A unit-test pass does not prove live hook dispatch, branch protection or remote submission.
- Treat snippets as illustrative unless the examples index names a runnable implementation. Do not invent fixture commands, provider APIs, requirements or test outcomes. Keep unresolved information visible.
- A lint/structure pass does not establish usefulness, factual accuracy, meaningful acceptance criteria or successful product behavior. Retain substantive human review.

## Mock submission and agent boundaries

The Python submission CLI creates local mock receipts only; the JavaScript read-back tests use in-memory mocks. Never represent either as a real Linear ticket. Do not add live submission, change remote resources, handle credentials or install project hooks without the user's authorization for that action.

The supplied settings are examples, not activated hooks. Review event payloads and paths for the installed agent; test actual dispatch separately from direct handler tests. Keep independent checks on the real artifact corpus because post-edit feedback cannot undo an edit or enforce merge protection.

## Maintain this repository

This toolkit is independent of the SPCA website. Keep its source, tests, license and packaging here. Run the Python suite, actual Vale checks and optional JavaScript tests for relevant changes; package with python3 scripts/package.py. Preserve the draft status, mock-only adapter and third-party notices. A passing handler test does not establish live agent dispatch. Do not deploy or enable user hooks without the user's instruction.

# Examples index

Run these examples from the extracted Starter Kit, without the SPCA site repository or Shoalrun. Choose the example that matches the guide you are reading.

| Example | Files | What runs |
|---|---|---|
| Incident report template | ../templates/incident-report.md and ../docs/INCIDENT-REPORTS.md | A blank Markdown working aid; copy and adapt it, with no runtime or automatic validator. |
| Structured ticket and mock submission | ../templates/linear-ticket.md, ../tools/validate.py, ../docs/PRE-SUBMISSION-WORKFLOW.md | Python standard-library checks and a mock-only local submission receipt. |
| TG-001 parser and mock read-back | tactical/README.md, tactical/ticket.mjs | An optional Node.js example with pinned Markdown-parser dependencies and in-memory adapter tests. |
| TG-002 prose rules | tactical/.vale.ini, tactical/styles/SPCA/, tactical/fixtures/ | The exact UnresolvedTODO and EmptyPhrases rules shown in the guide. Requires Vale. |
| TG-003 edit feedback | tactical/vale-hook.mjs, tactical/.claude/settings.example.json | A directly testable Vale hook handler; live agent activation is a separate setup step. |
| Page-shape rules | ../vale/docshape.ini, ../vale/styles/DocShape/, page-shapes/ | Shoalrun's project-owned structural rules and complete/incomplete recipe fixtures. Requires Vale. |
| Other guide and reference snippets | snippets/ and snippets.json | Copyable examples: ticket templates, decision/evidence records, sandbox patterns, evaluation sketches. These snippets are not standalone implementations. |

## Try the TG-002 rules

These commands select the bundled rules explicitly. Running Vale with a different configuration will not necessarily produce the same alerts.

```sh
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/todo.md
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/stock.md
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/plain.md
```

Expect a TODO error, a stock-phrase warning, and no alerts, respectively. The TODO failure is intentional.

## Try page-shape checks

```sh
vale --config=vale/docshape.ini examples/page-shapes/recipe-pass.md
vale --config=vale/docshape.ini examples/page-shapes/recipe-missing-check.md
```

The second fixture intentionally lacks a success-check section and should fail DocShape.RecipeShape. These conventions belong to Shoalrun; adapt the rules to your own templates. Attribution and license are in ../vale/DocShape-NOTICE.md and ../vale/DocShape-LICENSE.txt.

## Check every bundled Vale example

```sh
python3 tools/check_vale.py
```

The script verifies the kit's original prose rules, TG-002 rules, severity behavior and page-shape fixtures. It requires Vale on PATH. For the optional parser/hook test suite, follow tactical/README.md; it requires Node.js, its npm dependencies, and Vale. Installing dependencies may require network access. Hooks are not enabled by extraction, and mock receipts are never real tickets.

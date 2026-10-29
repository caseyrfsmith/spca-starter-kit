# Runnable tactical examples

These files accompany TG-001 through TG-003. They run independently of the SPCA site and Shoalrun. All adapter submissions are in-memory mocks; no Linear issue is created.

## Vale rules (TG-002)

Install Vale, then run from the extracted Starter Kit root:

```sh
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/todo.md
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/stock.md
vale --config=examples/tactical/.vale.ini examples/tactical/fixtures/plain.md
python3 tools/check_vale.py
```

The first file intentionally reports an SPCA.UnresolvedTODO error, the second an SPCA.EmptyPhrases warning, and the third neither alert. The exact example configuration enables these two rules. The kit's separate vale/.vale.ini uses its original SPCA.TODO and SPCA.Filler rules for the Python ticket example; do not confuse the configurations.

## Markdown parser and mock read-back (TG-001)

Requires Node.js 22.12+ and npm. From this directory:

```sh
npm ci
npm test
npm run check
```

The parser uses unified and remark-parse, pinned in package-lock.json. Dependency installation requires registry access or a populated npm cache; it does not install Shoalrun. This ticket contract uses Expected outcome and Context and references; the kit's Python ticket contract uses Expected behavior and References. Each example ships its matching fixture and tests. Do not mix those templates without changing the validator.

The sample adapter is not a Linear MCP tool signature. Tests cover missing, empty and duplicate headings, placeholders, absent approval, failed creation and persisted-content mismatch. Structural validity does not establish useful acceptance criteria.

## Vale edit feedback (TG-003)

vale-hook.mjs accepts Claude PostToolUse Edit/Write events for Markdown inside this example's tickets/ directory. An error is feedback after an edit; it does not roll the edit back or enforce merge policy. The settings under .claude/ are an unactivated example for a project rooted at the extracted kit. Review paths and merge with your own settings before trying them. No hook is installed by extraction.

Tests invoke the handler directly, including malformed events, missing files and unavailable Vale. They do not establish live Claude dispatch. Bash/external writes and disabled hooks can bypass this feedback; retain independent checks on your real artifacts.

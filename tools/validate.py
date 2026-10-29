#!/usr/bin/env python3
"""SPCA starter ticket contract validator. Standard library only."""
import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED = ['Problem', 'Expected behavior', 'Acceptance criteria', 'References']
OPTIONAL = ['Implementation notes']
HEAD = re.compile(r'^## (.+?)\s*$', re.M)
TODO = re.compile(r'\bTODO\b|\[\[\s*TODO\s*:', re.I)
SLOP = re.compile(r'\b(?:delve into|in today.s fast.paced world|unlock the power of|seamlessly leverage)\b', re.I)

def structural_text(text):
    # Ignore fenced examples and comments when looking for real contract sections.
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        match = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence):
                fence = None
            lines.append('\n')
        elif match:
            fence = match[1]
            lines.append('\n')
        else:
            lines.append(line)
    return ''.join(lines)

def validate(text):
    issues = []
    structure = structural_text(text)
    headings = [(m.group(1).strip(), m.start(), m.end()) for m in HEAD.finditer(structure)]
    names = [h[0] for h in headings]
    for name in REQUIRED:
        if names.count(name) != 1:
            issues.append(f'Expected exactly one required section: {name}')
    for name in names:
        if name not in REQUIRED + OPTIONAL:
            issues.append(f'Unknown section: {name}')
        if names.count(name) > 1 and name in OPTIONAL:
            issues.append(f'Duplicate optional section: {name}')
    # Order is defined independently from the optional placement.
    contract_order = ['Problem', 'Expected behavior', 'Acceptance criteria', 'Implementation notes', 'References']
    if names != [n for n in contract_order if n in names]:
        issues.append('Sections must follow contract order')
    for i, (name, _, end) in enumerate(headings):
        section = structure[end:headings[i+1][1] if i+1 < len(headings) else len(structure)].strip()
        if name in REQUIRED and not section:
            issues.append(f'Required section is empty: {name}')
        if name == 'Acceptance criteria' and not re.search(r'^\s*- \[[ xX]\] .+', section, re.M):
            issues.append('Acceptance criteria must contain at least one checklist item')
    if TODO.search(text): issues.append('Unresolved TODO marker')
    for m in SLOP.finditer(text): issues.append(f'Banned filler phrase: {m.group(0)}')
    if not structure.lstrip().startswith('# '): issues.append('Missing H1 ticket title')
    return issues

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    findings = {}
    for path in args.files:
        try: findings[str(path)] = validate(path.read_text(encoding='utf-8'))
        except (OSError, UnicodeError) as exc: findings[str(path)] = [str(exc)]
    if args.json: print(json.dumps(findings, indent=2))
    else:
        for file, issues in findings.items():
            print(f'{file}: {"PASS" if not issues else "FAIL"}')
            for issue in issues: print(f'  - {issue}')
    return int(any(findings.values()))
if __name__ == '__main__': sys.exit(main())

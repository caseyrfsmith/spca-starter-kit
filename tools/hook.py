"""Agent adapters: bounded post-edit feedback, never a merge gate."""
import json
import sys
from pathlib import Path
from validate import validate

ROOT = Path(__file__).resolve().parents[1]

def inspect(event, mode):
    if not isinstance(event, dict):
        raise ValueError('Hook event must be an object')
    if mode == 'codex':
        drafts = ROOT / 'work'
        paths = list(drafts.rglob('*.md')) if drafts.is_dir() else []
        allowed = [drafts.resolve()]
    else:
        inputs = event.get('tool_input', {})
        if not isinstance(inputs, dict):
            raise ValueError('tool_input must be an object')
        name = inputs.get('file_path')
        if not name:
            return []
        if not isinstance(name, str):
            raise ValueError('file_path must be a string')
        path = Path(name)
        if not path.is_absolute():
            cwd = event.get('cwd') or str(ROOT)
            if not isinstance(cwd, str):
                raise ValueError('cwd must be a string')
            path = Path(cwd) / path
        paths = [path]
        allowed = [(ROOT / name).resolve() for name in ('examples', 'work')]
    findings = []
    for path in paths:
        path = path.resolve()
        if path.suffix != '.md' or not any(path.is_relative_to(d) for d in allowed):
            continue
        if not path.is_file():
            raise ValueError('Target Markdown file is missing')
        issues = validate(path.read_text(encoding='utf-8'))
        if issues:
            findings.append(path.name + ': ' + '; '.join(issues))
    return findings

def main(mode):
    try:
        findings = inspect(json.load(sys.stdin), mode)
        if findings:
            print('SPCA ticket contract violations: ' + ' | '.join(findings), file=sys.stderr)
            return 2
        return 0
    except (ValueError, TypeError, OSError, UnicodeError) as exc:
        print('SPCA hook could not inspect edit: ' + str(exc), file=sys.stderr)
        return 2

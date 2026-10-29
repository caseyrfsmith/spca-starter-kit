#!/usr/bin/env python3
"""Exercise the actual optional Vale binary; no third-party Python packages."""
import json
import subprocess
import tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def run(path, level='warning', config='vale/.vale.ini'):
    return subprocess.run(['vale', '--config', str(ROOT/config), '--minAlertLevel='+level, '--output=JSON', str(path)], capture_output=True, text=True, timeout=15)

def main():
    good = run(ROOT/'examples/pass.md')
    assert good.returncode == 0 and json.loads(good.stdout) == {}, good.stderr
    bad = run(ROOT/'examples/fail.md')
    alerts = [a for rows in json.loads(bad.stdout).values() for a in rows]
    assert bad.returncode != 0
    assert any(a['Check'] == 'SPCA.TODO' and a['Severity'] == 'error' for a in alerts)
    assert any(a['Check'] == 'SPCA.Filler' and a['Severity'] == 'warning' for a in alerts)
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp)/'warning.md'
        path.write_text('We should seamlessly leverage the system.\n')
        warning = run(path)
        assert any(a['Check'] == 'SPCA.Filler' for rows in json.loads(warning.stdout).values() for a in rows)
        assert run(path, 'error').returncode == 0
    tactical = 'examples/tactical/.vale.ini'
    for file, expected, severity in [('todo.md', 'SPCA.UnresolvedTODO', 'error'), ('stock.md', 'SPCA.EmptyPhrases', 'warning'), ('code-example.md', 'SPCA.UnresolvedTODO', 'error')]:
        result = run(ROOT/'examples/tactical/fixtures'/file, config=tactical)
        rows = [a for alerts in json.loads(result.stdout).values() for a in alerts]
        assert any(a['Check'] == expected and a['Severity'] == severity for a in rows), (file, result.stdout, result.stderr)
    clean = run(ROOT/'examples/tactical/fixtures/plain.md', config=tactical)
    assert clean.returncode == 0 and json.loads(clean.stdout) == {}, (clean.stdout, clean.stderr)
    shapes = 'vale/docshape.ini'
    good_shape = run(ROOT/'examples/page-shapes/recipe-pass.md', config=shapes)
    assert good_shape.returncode == 0 and json.loads(good_shape.stdout) == {}, (good_shape.stdout, good_shape.stderr)
    bad_shape = run(ROOT/'examples/page-shapes/recipe-missing-check.md', config=shapes)
    rows = [a for alerts in json.loads(bad_shape.stdout).values() for a in alerts]
    assert bad_shape.returncode != 0 and any(a['Check'] == 'DocShape.RecipeShape' for a in rows), (bad_shape.stdout, bad_shape.stderr)
    version = subprocess.run(['vale','--version'], capture_output=True, text=True, check=True).stdout.strip()
    print(version + ': starter rules, exact TG-002 rules/fixtures, severity behavior and DocShape pass/fail fixtures verified.')
if __name__ == '__main__': main()

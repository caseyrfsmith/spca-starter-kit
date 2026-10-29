import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from validate import validate
ROOT = Path(__file__).resolve().parents[1]
class ContractTests(unittest.TestCase):
    def test_good(self): self.assertEqual(validate((ROOT/'examples/pass.md').read_text()), [])
    def test_bad(self):
        issues = validate((ROOT/'examples/fail.md').read_text())
        self.assertTrue(any('Expected behavior' in x for x in issues))
        self.assertTrue(any('TODO' in x for x in issues))
        self.assertTrue(any('filler' in x for x in issues))
    def test_optional_section(self):
        text = (ROOT/'examples/pass.md').read_text().replace('## References', '## Implementation notes\n\nUse sandbox only.\n\n## References')
        self.assertEqual(validate(text), [])
    def test_duplicate_required(self):
        text = (ROOT/'examples/pass.md').read_text() + '\n## Problem\n\nAgain.\n'
        self.assertTrue(any('exactly one' in x for x in validate(text)))
    def test_empty_required(self):
        text = (ROOT/'examples/pass.md').read_text().replace('## References\n\nNo external references available; validate against the sandbox API contract before implementation.', '## References')
        self.assertTrue(any('empty' in x for x in validate(text)))
if __name__ == '__main__': unittest.main()

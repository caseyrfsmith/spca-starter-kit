import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
import hook
from validate import validate

class HookTests(unittest.TestCase):
    def run_hook(self, mode, event):
        return subprocess.run([sys.executable, str(ROOT/('.'+mode)/'check-ticket-hook.py')], input=json.dumps(event), text=True, capture_output=True)

    def test_claude_good_bad_and_relative_path(self):
        for name, code in [('pass.md',0),('fail.md',2)]:
            result=self.run_hook('claude',{'cwd':str(ROOT),'tool_input':{'file_path':'examples/'+name}})
            self.assertEqual(result.returncode,code,result.stderr)
        self.assertIn('Expected behavior',self.run_hook('claude',{'tool_input':{'file_path':str(ROOT/'examples/fail.md')}}).stderr)

    def test_scope_and_symlink_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            outside=Path(temp)/'outside.md';outside.write_text('bad')
            self.assertEqual(self.run_hook('claude',{'tool_input':{'file_path':str(outside)}}).returncode,0)
            link=ROOT/'examples/escape-test.md';link.symlink_to(outside)
            try:self.assertEqual(self.run_hook('claude',{'tool_input':{'file_path':str(link)}}).returncode,0)
            finally:link.unlink()

    def test_malformed_and_missing_target(self):
        self.assertEqual(self.run_hook('claude',[]).returncode,2)
        self.assertEqual(self.run_hook('claude',{'tool_input':[]}).returncode,2)
        self.assertEqual(self.run_hook('claude',{'tool_input':{'file_path':str(ROOT/'work/missing.md')}}).returncode,2)
        result=subprocess.run([sys.executable,str(ROOT/'.claude/check-ticket-hook.py')],input='{',text=True,capture_output=True)
        self.assertEqual(result.returncode,2)

    def test_codex_scans_work_without_assuming_file_path_shape(self):
        with tempfile.TemporaryDirectory() as temp:
            original=hook.ROOT;hook.ROOT=Path(temp)
            try:
                work=hook.ROOT/'work';work.mkdir();ticket=work/'draft.md'
                ticket.write_text((ROOT/'examples/pass.md').read_text())
                self.assertEqual(hook.inspect({'tool_name':'apply_patch','tool_input':{'command':'patch payload'}},'codex'),[])
                ticket.write_text((ROOT/'examples/fail.md').read_text())
                self.assertTrue(hook.inspect({'tool_name':'Bash','tool_input':{'command':'edit draft'}},'codex'))
            finally:hook.ROOT=original

    def test_comments_and_fenced_headings_do_not_satisfy_contract(self):
        good=(ROOT/'examples/pass.md').read_text()
        self.assertTrue(any('empty' in x for x in validate(good.replace('No external references available; validate against the sandbox API contract before implementation.','<!-- evidence missing -->'))))
        self.assertTrue(any('Expected behavior' in x for x in validate(good.replace('## Expected behavior','```md\n## Expected behavior\n```'))))
        self.assertEqual(validate(good+'\n```md\n## Invented example heading\n```\n'),[])

    def test_validator_cli_missing_file(self):
        result=subprocess.run([sys.executable,str(ROOT/'tools/validate.py'),str(ROOT/'missing.md')],capture_output=True,text=True)
        self.assertEqual(result.returncode,1)
        self.assertIn('FAIL',result.stdout)

if __name__=='__main__':unittest.main()

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from submit_ticket import prepare,submit

class SubmissionBoundaryTests(unittest.TestCase):
    def test_unknown_adapter_blocked_before_preview_or_side_effect(self):
        with tempfile.TemporaryDirectory() as temp:
            for approve in [False,True]:
                result=submit(ROOT/'examples/pass.md',Path(temp)/'receipts',approve=approve,adapter='linear')
                self.assertEqual(result['reason'],'unsupported_adapter')
                self.assertFalse((Path(temp)/'receipts').exists())

    def test_digest_covers_exact_bytes_and_new_valid_version(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'ticket.md'
            raw=(ROOT/'examples/pass.md').read_bytes().replace(b'\n',b'\r\n')
            path.write_bytes(raw);before=prepare(path)
            self.assertTrue(before['valid'])
            self.assertEqual(before['sha256'],hashlib.sha256(raw).hexdigest())
            path.write_bytes(raw+b'\r\nAdditional reviewed context.\r\n')
            result=submit(path,Path(temp)/'receipts',approve=True)
            self.assertEqual(result['status'],'submitted_to_mock')
            self.assertNotEqual(result['sha256'],before['sha256'])
            self.assertEqual(result['sha256'],hashlib.sha256(path.read_bytes()).hexdigest())
            receipt=json.loads(Path(result['receipt_file']).read_text())
            self.assertEqual(receipt['adapter'],'mock')
            self.assertEqual(receipt['verification'],'local_mock_receipt_only')
            self.assertTrue(receipt['ticket_id'].startswith('MOCK-'))
            self.assertNotIn('ticket',receipt)

    def test_cli_expected_statuses_and_receipt_scope(self):
        with tempfile.TemporaryDirectory() as temp:
            receipts=Path(temp)/'receipts'
            cases=[('pass.md',[],0,'ready_for_approval'),('fail.md',['--approve'],1,'blocked'),('pass.md',['--adapter','linear'],1,'blocked'),('pass.md',['--approve','--adapter','linear'],1,'blocked'),('pass.md',['--approve'],0,'submitted_to_mock')]
            for name,flags,code,status in cases:
                result=subprocess.run([sys.executable,str(ROOT/'tools/submit_ticket.py'),str(ROOT/'examples'/name),'--receipt-dir',str(receipts),*flags],capture_output=True,text=True)
                self.assertEqual(result.returncode,code,result.stderr)
                self.assertEqual(json.loads(result.stdout)['status'],status)
                self.assertEqual(len(list(receipts.glob('*.json'))),1 if status=='submitted_to_mock' else 0)

    def test_cli_missing_input_and_receipt_write_error_block(self):
        with tempfile.TemporaryDirectory() as temp:
            occupied=Path(temp)/'not-a-directory';occupied.write_text('preserve me')
            for ticket,receipts in [(Path(temp)/'missing.md',Path(temp)/'receipts'),(ROOT/'examples/pass.md',occupied)]:
                result=subprocess.run([sys.executable,str(ROOT/'tools/submit_ticket.py'),str(ticket),'--approve','--receipt-dir',str(receipts)],capture_output=True,text=True)
                self.assertEqual(result.returncode,1)
                self.assertEqual(json.loads(result.stdout)['reason'],'input_error')
            self.assertEqual(occupied.read_text(),'preserve me')
if __name__=='__main__':unittest.main()

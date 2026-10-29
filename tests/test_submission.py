import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from submit_ticket import submit, prepare
ROOT=Path(__file__).resolve().parents[1]
class SubmissionTests(unittest.TestCase):
    def test_valid_preview_does_not_submit(self):
        with tempfile.TemporaryDirectory() as d:
            result=submit(ROOT/"examples/pass.md",Path(d))
            self.assertEqual(result["status"],"ready_for_approval")
            self.assertFalse(list(Path(d).glob("*.json")))
    def test_invalid_blocked_even_if_approved(self):
        with tempfile.TemporaryDirectory() as d:
            result=submit(ROOT/"examples/fail.md",Path(d),approve=True)
            self.assertEqual(result["status"],"blocked")
            self.assertFalse(list(Path(d).glob("*.json")))
    def test_mock_submission_and_receipt(self):
        with tempfile.TemporaryDirectory() as d:
            result=submit(ROOT/"examples/pass.md",Path(d),approve=True)
            self.assertEqual(result["status"],"submitted_to_mock")
            self.assertTrue(Path(result["receipt_file"]).exists())
            self.assertEqual(result["sha256"],prepare(ROOT/"examples/pass.md")["sha256"])
    def test_external_adapter_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            result=submit(ROOT/"examples/pass.md",Path(d),approve=True,adapter="linear")
            self.assertEqual(result["status"],"blocked")
            self.assertFalse(list(Path(d).glob("*.json")))
    def test_mutation_revalidates(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"ticket.md"
            p.write_text((ROOT/"examples/pass.md").read_text()+"\nTODO: unresolved\n")
            self.assertEqual(submit(p,Path(d)/"receipts",approve=True)["status"],"blocked")
if __name__=="__main__":unittest.main()

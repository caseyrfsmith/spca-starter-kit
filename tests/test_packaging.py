import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('kit_package', Path(__file__).resolve().parents[1]/'scripts/package.py')
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)


class Packaging(unittest.TestCase):
    def test_archive_keeps_examples_and_license_but_not_local_state(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            included = ['README.md', 'LICENSE', 'NOTICE', '.env.example', '.claude/settings.example.json']
            excluded = ['.env', '.env.local', '.claude/settings.json', '.codex/hooks.json',
                        'work/private.md', '.spca-receipts/receipt.json', 'node_modules/package/index.js', '.git/config']
            for name in included+excluded:
                file = root/name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(name)
            previous = PACKAGER.ROOT
            PACKAGER.ROOT = root
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    output = PACKAGER.package()
                    first = output.read_bytes()
                    PACKAGER.package()
                self.assertEqual(first, output.read_bytes(), 'Packaging remains deterministic after dist exists')
                with zipfile.ZipFile(output) as archive:
                    self.assertEqual(set(archive.namelist()), {'spca-starter-kit/'+name for name in included})
            finally:
                PACKAGER.ROOT = previous

    def test_file_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/'kit'
            root.mkdir()
            external = Path(temp)/'external.txt'
            external.write_text('outside the kit')
            (root/'linked.txt').symlink_to(external)
            previous = PACKAGER.ROOT
            PACKAGER.ROOT = root
            try:
                with self.assertRaisesRegex(ValueError, 'symlinks'):
                    PACKAGER.package()
            finally:
                PACKAGER.ROOT = previous

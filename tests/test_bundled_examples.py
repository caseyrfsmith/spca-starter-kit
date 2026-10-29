import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class BundledExamples(unittest.TestCase):
    def test_catalog_is_complete_inside_the_archive(self):
        records = json.loads((ROOT/'examples/snippets.json').read_text())
        self.assertTrue(records)
        for item in records:
            file = ROOT/'examples'/item['file']
            self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(), item['sha256'])
            self.assertGreater(item['blocks'], 0)
            self.assertEqual(item['kind'], 'illustrative-snippets')
        self.assertIn('TG-004', {item['id'] for item in records})
        self.assertIn('TG-005', {item['id'] for item in records})
        self.assertIn('TG-006', {item['id'] for item in records})

    def test_runnable_examples_do_not_depend_on_the_site(self):
        package = json.loads((ROOT/'examples/tactical/package.json').read_text())
        self.assertEqual(set(package['dependencies']), {'unified', 'remark-parse'})
        self.assertTrue((ROOT/'examples/tactical/package-lock.json').exists())
        for file in ['examples/tactical/.vale.ini', 'examples/tactical/styles/SPCA/UnresolvedTODO.yml',
                     'examples/tactical/styles/SPCA/EmptyPhrases.yml', 'examples/tactical/test/tactical.test.mjs',
                     'vale/docshape.ini', 'vale/DocShape-LICENSE.txt', 'vale/styles/config/scripts/ShoalrunRecipeShape.tengo']:
            self.assertTrue((ROOT/file).is_file(), file)

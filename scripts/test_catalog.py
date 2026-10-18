"""Regression checks for stale or incomplete quality reviews, using isolated files."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class CatalogReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        (self.root / 'animations').mkdir()
        (self.root / 'data').mkdir()
        shutil.copy(Path(__file__).with_name('update-catalog.py'), self.root / 'scripts')
        self.ranking = {'reviewedAt': '2026-10-18', 'method': 'visual review', 'scope': 'artifacts only', 'entries': []}
        for rank, name in enumerate(('Z-first', 'A-second'), 1):
            path = self.root / 'animations' / (name + '.html')
            path.write_text('<svg></svg>')
            self.ranking['entries'].append({'rank': rank, 'file': path.relative_to(self.root).as_posix(),
                'reason': 'Reviewed in browser', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        self.save()
        self.run_catalog()

    def save(self):
        (self.root / 'data/quality-ranking.json').write_text(json.dumps(self.ranking))

    def run_catalog(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(self.root / 'scripts/update-catalog.py'), *args], capture_output=True, text=True)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def test_quality_order_and_check_is_read_only(self):
        path = self.root / 'data/generated/models.js'
        before = path.read_bytes()
        self.assertLess(before.index(b'Z-first'), before.index(b'A-second'))
        self.run_catalog('--check')
        self.assertEqual(path.read_bytes(), before)

    def test_new_animation_requires_review(self):
        (self.root / 'animations/New.html').write_text('<svg></svg>')
        self.assertIn('exactly once', self.run_catalog('--check', ok=False).stderr)

    def test_modified_animation_requires_review(self):
        (self.root / 'animations/Z-first.html').write_text('<svg>changed</svg>')
        self.assertIn('changed since review', self.run_catalog('--check', ok=False).stderr)

    def test_removed_animation_requires_reranking(self):
        (self.root / 'animations/A-second.html').unlink()
        self.assertIn('exactly once', self.run_catalog('--check', ok=False).stderr)

    def test_duplicate_rank_rejected(self):
        self.ranking['entries'][1]['rank'] = 1
        self.save()
        self.assertIn('unique and consecutive', self.run_catalog('--check', ok=False).stderr)

    def test_changed_rank_requires_regeneration(self):
        self.ranking['entries'][0]['rank'] = 2
        self.ranking['entries'][1]['rank'] = 1
        self.save()
        self.assertIn('stale', self.run_catalog('--check', ok=False).stderr)
        self.run_catalog()
        self.run_catalog('--check')


if __name__ == '__main__':
    unittest.main()

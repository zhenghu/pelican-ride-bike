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

    def set_scores(self, first, second):
        for entry, values in zip(self.ranking['entries'], (first, second)):
            entry['scores'] = dict(zip(('motion', 'visual', 'detail'), values))
        self.save()

    def generated_models(self):
        source = (self.root / 'data/generated/models.js').read_text()
        return json.loads(source.split('window.PELICAN_MODELS = ', 1)[1].split(';\nwindow.PELICAN_RANKING', 1)[0])

    def test_quality_order_and_check_is_read_only(self):
        path = self.root / 'data/generated/models.js'
        before = path.read_bytes()
        self.assertLess(before.index(b'Z-first'), before.index(b'A-second'))
        self.run_catalog('--check')
        self.assertEqual(path.read_bytes(), before)
        for model in self.generated_models():
            self.assertNotIn('scores', model)
            self.assertNotIn('score', model)

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

    def test_score_generation_uses_40_40_20_weights(self):
        self.set_scores((7, 9, 8.5), (8, 7, 8))
        self.assertIn('stale', self.run_catalog('--check', ok=False).stderr)
        self.run_catalog()
        self.run_catalog('--check')
        models = self.generated_models()
        self.assertEqual([model['score'] for model in models], [81, 76])
        self.assertEqual(models[0]['scores'], {'motion': 7, 'visual': 9, 'detail': 8.5})

    def test_scores_require_full_coverage(self):
        self.ranking['entries'][0]['scores'] = {'motion': 8, 'visual': 8, 'detail': 8}
        self.save()
        self.assertIn('every animation', self.run_catalog('--check', ok=False).stderr)

    def test_invalid_scores_rejected(self):
        for value in (-0.5, 10.5, 8.25, True, '8', None, float('nan'), float('inf')):
            with self.subTest(value=value):
                self.set_scores((value, 8, 8), (6, 6, 6))
                self.assertIn('Invalid motion score', self.run_catalog('--check', ok=False).stderr)

    def test_scores_require_exact_dimensions(self):
        for scores in (None, [], {'motion': 8, 'visual': 8},
                       {'motion': 8, 'visual': 8, 'detail': 8, 'cost': 0}):
            with self.subTest(scores=scores):
                self.set_scores((8, 8, 8), (6, 6, 6))
                self.ranking['entries'][0]['scores'] = scores
                self.save()
                self.assertIn('exactly motion, visual and detail', self.run_catalog('--check', ok=False).stderr)

    def test_score_order_and_tie_breaks_enforced(self):
        cases = (
            ((7, 7, 7), (8, 8, 8)),  # Lower total cannot rank first.
            ((7, 8, 8), (8, 7, 8)),  # Equal total: higher motion ranks first.
            ((8, 7, 8), (8, 8, 6)),  # Equal total and motion: higher visual ranks first.
        )
        for first, second in cases:
            with self.subTest(first=first, second=second):
                self.set_scores(first, second)
                self.assertIn('descending weighted score', self.run_catalog('--check', ok=False).stderr)
                self.set_scores(second, first)
                self.run_catalog()
                self.run_catalog('--check')

    def test_identical_scores_preserve_review_order(self):
        self.set_scores((0, 10, 0), (0, 10, 0))
        self.run_catalog()
        self.run_catalog('--check')
        self.assertEqual([model['name'] for model in self.generated_models()], ['Z-first', 'A-second'])


if __name__ == '__main__':
    unittest.main()

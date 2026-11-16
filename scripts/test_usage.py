"""Usage overrides preserve approximate quantities without inventing exact counts."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name('update-usage.py')
spec = importlib.util.spec_from_file_location('update_usage', SCRIPT)
usage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usage)


class UsageApproximationTests(unittest.TestCase):
    def override(self, **changes):
        return {'createdDate': '2026-11-16', 'tokensTotal': None,
                'tokensApproximation': 'million-scale', 'totalUsage': '10.00',
                'estimated': True, 'note': '用户只提供数量级和概数。', **changes}

    def test_approximation_replaces_existing_exact_count(self):
        entry = {'tokensTotal': 1234, 'sourceModel': 'Some model'}
        usage.apply_override(entry, self.override(), 'work.html', '2026-11-16')
        self.assertIsNone(entry['tokensTotal'])
        self.assertEqual(entry['tokensApproximation'], 'million-scale')
        self.assertEqual(entry['totalUsage'], '10.00')
        self.assertEqual(entry['mappingStatus'], 'user-provided')
        self.assertTrue(entry['estimated'])

    def test_approximation_cannot_be_combined_with_exact_count_or_unknown_scale(self):
        for changes in ({'tokensTotal': 1000000}, {'tokensApproximation': '1M-10M'},
                        {'tokensApproximation': None}):
            with self.subTest(changes=changes):
                with self.assertRaisesRegex(ValueError, 'Invalid token approximation'):
                    usage.apply_override({}, self.override(**changes), 'work.html', '2026-11-16')

    def test_exact_and_missing_counts_remain_distinct(self):
        for count in (0, 13700000, None):
            with self.subTest(count=count):
                entry = {}
                override = {'createdDate': '2026-11-16', 'tokensTotal': count, 'totalUsage': '0.00'}
                usage.apply_override(entry, override, 'work.html', '2026-11-16')
                self.assertEqual(entry['tokensTotal'], count)
                self.assertEqual(entry['totalUsage'], '0.00')
                self.assertNotIn('tokensApproximation', entry)

    def test_invalid_manual_counts_still_rejected(self):
        for count in (-1, 1.5, True, '1000'):
            with self.subTest(count=count):
                with self.assertRaisesRegex(ValueError, 'Invalid manual usage'):
                    usage.apply_override({}, self.override(tokensTotal=count), 'work.html', '2026-11-16')

    def test_generation_preserves_null_count_and_converts_approximate_cost(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for folder in ('scripts', 'animations', 'data/raw'):
                (root / folder).mkdir(parents=True)
            shutil.copy(SCRIPT, root / 'scripts/update-usage.py')
            file = 'animations/Anthropic-ClaudeFable-5.2.html'
            (root / file).write_text('<svg></svg>')
            fixtures = {
                'usage-sources.json': {'tokens': 'tokens.csv', 'usage': 'usage.csv'},
                'animation-dates.json': {'timezone': 'Europe/Berlin', 'createdDates': {file: '2026-11-16'}},
                'fx-rates.json': {'rates': {'2026-11-16': {'usdPerEur': '1.1014', 'cnyPerEur': '7.3425'}}},
                'usage-overrides.json': {file: self.override()},
            }
            for name, data in fixtures.items():
                (root / 'data' / name).write_text(json.dumps(data))
            (root / 'data/raw/tokens.csv').write_text('date__day,model,tokens_total\n2026-11-16,Unrelated,1\n')
            (root / 'data/raw/usage.csv').write_text('date__day,model,total_usage\n2026-11-16,Unrelated,0.1\n')
            result = subprocess.run([sys.executable, str(root / 'scripts/update-usage.py')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            source = (root / 'data/generated/usage-data.js').read_text()
            data = json.loads(source.split('window.PELICAN_USAGE = ', 1)[1].removesuffix(';\n'))
            entry = data['works'][file]
            self.assertIsNone(entry['tokensTotal'])
            self.assertEqual(entry['tokensApproximation'], 'million-scale')
            self.assertEqual(entry['totalUsage'], '10.00')
            self.assertEqual(entry['totalUsageRmb'], '66.66515344107499546032322499')
            self.assertEqual(entry['fxDate'], '2026-11-16')
            self.assertFalse(entry['fxFallback'])


if __name__ == '__main__':
    unittest.main()

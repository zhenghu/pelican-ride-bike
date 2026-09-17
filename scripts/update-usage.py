#!/usr/bin/env python3
"""Extract each model's usage on the animation's original creation date."""
import argparse
import csv
import json
from datetime import date
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PERIOD = '2026-08-18_2026-09-17'
# Explicit aliases only: similarly named model variants must not be merged.
MODEL_MAP = {
    'fable5': ('Claude Fable 5', 'matched'),
    'fable5.1': ('Claude Fable 5.1', 'matched'),
    'opus4.8': ('Claude Opus 4.8', 'matched'),
    'opus5': ('Claude Opus 5', 'matched'),
    'GLM5.3': ('GLM 5.3', 'matched'),
    'k3': ('Kimi K3', 'matched'),
    'DeepSeek4.1': ('DeepSeek V4.1 Flash', 'confirmed-alias'),
    'bytedance-seed': ('Seed 2.1 Turbo', 'confirmed-alias'),
    'Tencent-hy4': ('Hy4 preview', 'confirmed-alias'),
}


def read_metric(path, field):
    result = {}
    with path.open(encoding='utf-8-sig', newline='') as source:
        reader = csv.DictReader(source)
        if not {'date__day', 'model', field}.issubset(reader.fieldnames or []):
            raise ValueError(f'{path.name}: missing required columns')
        for row in reader:
            day = date.fromisoformat(row['date__day']).isoformat()
            key = (day, row['model'])
            if key in result:
                raise ValueError(f'{path.name}: duplicate date/model key {key}')
            value = Decimal(row[field])
            if not value.is_finite() or value < 0:
                raise ValueError(f'{path.name}: invalid {field} for {key}')
            if field == 'tokens_total' and value != value.to_integral_value():
                raise ValueError(f'{path.name}: noninteger token count for {key}')
            result[key] = value
    if not result:
        raise ValueError(f'{path.name}: empty export')
    return result


def daily_value(rows, model, day, integer=False):
    value = rows.get((day, model))
    if value is None:
        return None
    return int(value) if integer else format(value, 'f')


def exchange_for_date(rates, day):
    available = [rate_date for rate_date in rates if rate_date <= day]
    if not available:
        raise ValueError(f'No exchange rate on or before {day}; update data/fx-rates.json')
    rate_date = max(available)
    if (date.fromisoformat(day) - date.fromisoformat(rate_date)).days > 7:
        raise ValueError(f'Exchange rate too old for {day}; update data/fx-rates.json')
    rate = rates[rate_date]
    usd = Decimal(rate['usdPerEur'])
    cny = Decimal(rate['cnyPerEur'])
    if not usd.is_finite() or not cny.is_finite() or usd <= 0 or cny <= 0:
        raise ValueError(f'Invalid exchange rate for {rate_date}')
    return rate_date, cny / usd


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tokens', type=Path, default=ROOT / 'data' / 'raw' / f'explorer_tokens_total_{DEFAULT_PERIOD}.csv')
    parser.add_argument('--usage', type=Path, default=ROOT / 'data' / 'raw' / f'explorer_total_usage_{DEFAULT_PERIOD}.csv')
    args = parser.parse_args()
    tokens = read_metric(args.tokens, 'tokens_total')
    usage = read_metric(args.usage, 'total_usage')
    dates = json.loads((ROOT / 'data' / 'animation-dates.json').read_text(encoding='utf-8'))
    fx = json.loads((ROOT / 'data' / 'fx-rates.json').read_text(encoding='utf-8'))
    works = {}
    for path in sorted((ROOT / 'animations').glob('*.html')):
        file = path.relative_to(ROOT).as_posix()
        if file not in dates['createdDates']:
            raise ValueError(f'Missing original creation date in data/animation-dates.json: {file}')
        created_date = date.fromisoformat(dates['createdDates'][file]).isoformat()
        source_model, status = MODEL_MAP.get(path.stem, (None, 'unmatched'))
        entry = {'sourceModel': source_model, 'mappingStatus': status,
                 'createdDate': created_date, 'tokensTotal': None, 'totalUsage': None,
                 'totalUsageRmb': None, 'fxDate': None, 'usdToCny': None, 'fxFallback': False}
        if status in ('matched', 'confirmed-alias'):
            entry['tokensTotal'] = daily_value(tokens, source_model, created_date, True)
            entry['totalUsage'] = daily_value(usage, source_model, created_date)
            if entry['totalUsage'] is not None:
                rate_date, rate = exchange_for_date(fx['rates'], created_date)
                entry['totalUsageRmb'] = format(Decimal(entry['totalUsage']) * rate, 'f')
                entry['fxDate'] = rate_date
                entry['usdToCny'] = format(rate, 'f')
                entry['fxFallback'] = rate_date != created_date
        works[file] = entry
    data = {'dateBasis': 'animation-creation-date', 'timezone': dates['timezone'],
            'currency': 'CNY', 'sourceCurrency': 'USD', 'exchangeRateSource': fx,
            'sources': {'tokens': args.tokens.name, 'usage': args.usage.name}, 'works': works}
    output = ROOT / 'data' / 'generated' / 'usage-data.js'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        '// Generated by scripts/update-usage.py; source CSVs remain local.\n'
        + 'window.PELICAN_USAGE = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n',
        encoding='utf-8')
    available = sum(item['tokensTotal'] is not None or item['totalUsage'] is not None for item in works.values())
    print(f'By animation creation date: {available}/{len(works)} works have usage data')


if __name__ == '__main__':
    main()

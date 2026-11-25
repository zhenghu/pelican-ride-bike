import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.value = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children.flatMap(child => child.tag === 'fragment' ? child.children : [child]); }
  setAttribute() {}
  addEventListener() {}
}

function load(entry) {
  const nodes = new Map();
  const document = {
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    querySelectorAll: () => [],
    getElementById: id => {
      if (!nodes.has(id)) nodes.set(id, new Element('div'));
      return nodes.get(id);
    }
  };
  const window = {
    PELICAN_USAGE: { works: { 'work.html': entry }, sources: {}, exchangeRateSource: { sourceUrl: 'https://example.com/rates' } },
    PELICAN_MODELS: [{ file: 'work.html', name: 'Work', rank: 1, review: 'Review', tech: ['SVG'] }],
    PELICAN_RANKING: { reviewedAt: '2026-11-16', method: 'Visual', scope: 'Works' }
  };
  const context = vm.createContext({ window, document, URLSearchParams });
  for (const file of ['../assets/js/usage.js', '../assets/js/ranking.js']) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
  }
  return { usage: window.PelicanUsage, nodes };
}

test('quantity-only tokens display without a fabricated count on summaries and ranking rows', () => {
  const { usage, nodes } = load({ tokensTotal: null, tokensApproximation: 'million-scale', estimated: true,
    totalUsage: '10.00', totalUsageRmb: '66.66515344107499546032322499', usdToCny: '6.666515344107499546032322499',
    fxDate: '2026-11-16', createdDate: '2026-11-16', mappingStatus: 'user-provided' });
  const summary = usage.createSummary('work.html');
  const tokenAmount = summary.children[0].children[0].children[1];
  assert.equal(tokenAmount.textContent, '千 K 级');
  assert.match(tokenAmount.title, /确切数量及上下限均未提供/);
  assert.notEqual(tokenAmount.className, 'usage-missing');
  const rankAmount = nodes.get('ranking-list').children[0].children[2].children[0].children[0].children[1];
  assert.equal(rankAmount.textContent, '千 K 级');
  assert.equal(rankAmount.title, tokenAmount.title);
  assert.match(summary.children[0].children[1].children[1].textContent, /66\.6652/);
});

test('unknown, exact and zero token quantities retain their existing meanings', () => {
  const { usage } = load({});
  assert.equal(usage.tokenDisplay({ tokensTotal: null }).text, '暂无数据');
  assert.equal(usage.tokenDisplay({ tokensTotal: null }).missing, true);
  assert.equal(usage.tokenDisplay({ tokensTotal: 0 }).text, '0 K');
  assert.equal(usage.tokenDisplay({ tokensTotal: 13700000 }).text, '13,700 K');
  assert.equal(usage.tokenDisplay({ tokensTotal: null, tokensApproximation: 'unknown' }).text, '暂无数据');
  assert.match(usage.formatCost('0'), /^免费/);
});

test('native RMB costs are exact on both the summary and ranking row', () => {
  const { usage, nodes } = load({ tokensTotal: 43000, totalUsageRmb: '0.20',
    sourceCurrency: 'CNY', mappingStatus: 'user-provided', totalUsage: null, fxDate: null });
  const summary = usage.createSummary('work.html');
  assert.equal(summary.children.length, 3);
  const amount = summary.children[0].children[1].children[1];
  assert.equal(amount.textContent, '¥0.20');
  assert.doesNotMatch(amount.title, /USD|ECB|null/);
  const ranking = nodes.get('ranking-list').children[0].children[2].children[0];
  assert.equal(ranking.children[1].children[1].textContent, amount.textContent);
});

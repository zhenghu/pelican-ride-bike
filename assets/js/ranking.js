(() => {
  'use strict';
  const models = window.PELICAN_MODELS;
  const ranking = window.PELICAN_RANKING;
  const usage = window.PelicanUsage;
  const $ = id => document.getElementById(id);
  $('review-date').textContent = `评审日期 ${ranking.reviewedAt}`;
  $('ranking-method').textContent = `${ranking.method} ${ranking.scope}`;

  function render() {
    const query = $('ranking-search').value.trim().toLowerCase();
    const filtered = models.filter(model => [model.name, ...(model.aliases || [])].some(name => name.toLowerCase().includes(query)));
    const fragment = document.createDocumentFragment();
    filtered.forEach(model => {
      const entry = window.PELICAN_USAGE.works[model.file];
      const row = document.createElement('li');
      row.className = 'ranking-row' + (model.rank <= 3 ? ' ranking-top' : '');
      row.value = model.rank;
      const number = document.createElement('span');
      number.className = 'rank-number';
      number.textContent = '#' + String(model.rank).padStart(2, '0');
      number.setAttribute('aria-label', `第 ${model.rank} 名`);
      const work = document.createElement('div');
      work.className = 'rank-work';
      const heading = document.createElement('h2');
      const preview = document.createElement('a');
      preview.textContent = model.name;
      preview.href = '../index.html#' + new URLSearchParams({ a: model.file, mode: 'single', v: '2' }).toString();
      heading.append(preview);
      const reason = document.createElement('p');
      reason.className = 'rank-reason';
      reason.textContent = model.review;
      const created = document.createElement('p');
      created.className = 'rank-created';
      created.textContent = `创建于 ${entry?.createdDate || '未记录'} · ${model.tech.join(' / ')}`;
      work.append(heading, reason);
      if (model.scores && [model.score, model.scores.motion, model.scores.visual, model.scores.detail].every(Number.isFinite)) {
        const scores = document.createElement('p');
        scores.className = 'rank-scores';
        scores.title = '分项满分 10 分；动作占 40%，画面占 40%，细节占 20%。';
        for (const [label, value, suffix] of [
          ['综合', model.score, ' / 100'],
          ['动作', model.scores.motion, ''],
          ['画面', model.scores.visual, ''],
          ['细节', model.scores.detail, '']
        ]) {
          const item = document.createElement('span');
          item.textContent = `${label} ${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${suffix}`;
          scores.append(item);
        }
        work.append(scores);
      }
      work.append(created);

      const metrics = document.createElement('div');
      metrics.className = 'rank-usage';
      const list = document.createElement('dl');
      list.className = 'rank-metrics';
      for (const [label, display] of [
        ['Token（K）', usage.tokenDisplay(entry)],
        ['费用（RMB）', usage.costDisplay(entry)]
      ]) {
        const group = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label + (entry?.estimated ? ' · 估算' : '');
        const amount = document.createElement('dd');
        amount.textContent = display.text;
        if (display.missing) amount.className = 'usage-missing';
        if (display.title) amount.title = display.title;
        group.append(term, amount);
        list.append(group);
      }
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '用量依据';
      details.append(summary, usage.createSummary(model.file));
      metrics.append(list, details);

      const actions = document.createElement('div');
      actions.className = 'rank-actions';
      const view = document.createElement('a');
      view.href = preview.href;
      view.textContent = '查看动画 →';
      view.setAttribute('aria-label', `查看动画 ${model.name}`);
      const original = document.createElement('a');
      original.href = '../' + model.file;
      original.textContent = '原页 ↗';
      original.target = '_blank';
      original.rel = 'noopener';
      original.setAttribute('aria-label', `打开原页 ${model.name}`);
      actions.append(view, original);
      row.append(number, work, metrics, actions);
      fragment.append(row);
    });
    $('ranking-list').replaceChildren(fragment);
    $('ranking-count').textContent = `${filtered.length} / ${models.length} 个作品 · 按质量排名`;
    $('ranking-empty').hidden = filtered.length !== 0;
  }
  $('ranking-search').addEventListener('input', render);
  $('ranking-clear').addEventListener('click', () => {
    $('ranking-search').value = '';
    render();
    $('ranking-search').focus();
  });
  render();
})();

(() => {
  'use strict';
  const data = window.PELICAN_USAGE;
  const countFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const usageFormat = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 4 });

  function createSummary(file) {
    const entry = data.works[file];
    const section = document.createElement('div');
    section.className = 'usage-summary';
    const metrics = document.createElement('dl');
    metrics.className = 'usage-metrics';
    for (const [label, value, format, title] of [
      ['Token（K）', entry?.tokensTotal, value => `${countFormat.format(Number(value) / 1000)} K`, `${entry?.tokensTotal} tokens`],
      ['费用（RMB）', entry?.totalUsageRmb, value => `≈ ${usageFormat.format(Number(value))}`, `${entry?.totalUsage} USD × ${entry?.usdToCny} = ${entry?.totalUsageRmb} RMB；汇率日期 ${entry?.fxDate}`]
    ]) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const amount = document.createElement('dd');
      const missing = value === null || value === undefined;
      amount.textContent = missing ? '暂无数据' : format(value);
      if (missing) amount.className = 'usage-missing';
      else amount.title = title;
      group.append(term, amount);
      metrics.append(group);
    }
    const day = document.createElement('p');
    day.className = 'usage-date';
    day.textContent = `创建日期：${entry?.createdDate || '未记录'}`;
    const source = document.createElement('p');
    source.className = 'usage-source';
    if (!entry?.sourceModel) {
      source.textContent = 'CSV 中没有对应模型记录';
    } else {
      source.textContent = `CSV 模型：${entry.sourceModel}`;
      if (entry.tokensTotal === null) source.textContent += '；缺少当天 Token 记录';
      if (entry.totalUsage === null) source.textContent += '；缺少当天 Usage 记录';
    }
    section.append(metrics, day, source);
    if (entry?.totalUsageRmb !== null && entry?.totalUsageRmb !== undefined) {
      const conversion = document.createElement('p');
      conversion.className = 'usage-source';
      conversion.textContent = `${entry.totalUsage} USD · 1 USD = ${Number(entry.usdToCny).toFixed(6)} RMB`;
      const rateDate = document.createElement('a');
      rateDate.href = data.exchangeRateSource.sourceUrl;
      rateDate.target = '_blank';
      rateDate.rel = 'noopener';
      rateDate.textContent = `ECB ${entry.fxDate}${entry.fxFallback ? '（最近已公布）' : ''}`;
      conversion.append(document.createElement('br'), rateDate);
      section.append(conversion);
    }
    return section;
  }

  document.querySelectorAll('[data-usage-period]').forEach(element => {
    element.textContent = '按各动画创建日期匹配模型当天的 CSV 用量；1 K = 1,000 tokens。美元费用按 ECB 参考汇率折算人民币，当日汇率未公布时采用此前最近汇率。当天用量可能包含其他请求；缺失记录显示“暂无数据”。';
    element.title = `来源：${data.sources.tokens}\n${data.sources.usage}`;
  });
  window.PelicanUsage = { createSummary };
})();

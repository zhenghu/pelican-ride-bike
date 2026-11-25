(() => {
  'use strict';
  const data = window.PELICAN_USAGE;
  const countFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const usageFormat = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const formatTokens = value => value == null ? '暂无数据' : `${countFormat.format(Number(value) / 1000)} K`;
  const formatCost = value => value == null ? '暂无数据' : Number(value) === 0 ? `免费（${usageFormat.format(0)}）` : `≈ ${usageFormat.format(Number(value))}`;

  function costDisplay(entry) {
    const value = entry?.totalUsageRmb;
    if (value == null) return { text: '暂无数据', missing: true };
    if (entry.sourceCurrency === 'CNY') {
      const amount = usageFormat.format(Number(value));
      const text = entry.estimated || Number(value) === 0 ? formatCost(value) : amount;
      return { text, title: `原币金额 ${value} RMB`, missing: false };
    }
    return {
      text: formatCost(value),
      title: `${entry.estimated ? '估算：约 ' : ''}${entry.totalUsage} USD × ${entry.usdToCny} = ${value} RMB；汇率日期 ${entry.fxDate}`,
      missing: false
    };
  }

  function tokenDisplay(entry) {
    if (entry?.tokensTotal == null && entry?.tokensApproximation === 'million-scale') {
      return {
        text: '千 K 级',
        title: '用户仅提供“百万级” Token；“千 K 级”为数量级描述，确切数量及上下限均未提供。',
        missing: false
      };
    }
    return {
      text: formatTokens(entry?.tokensTotal),
      title: entry?.tokensTotal == null ? '' : `${entry.tokensTotal} tokens`,
      missing: entry?.tokensTotal == null
    };
  }

  function createSummary(file) {
    const entry = data.works[file];
    const section = document.createElement('div');
    section.className = 'usage-summary';
    const metrics = document.createElement('dl');
    metrics.className = 'usage-metrics';
    for (const [label, display] of [
      ['Token（K）', tokenDisplay(entry)],
      ['费用（RMB）', costDisplay(entry)]
    ]) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = entry?.estimated ? `${label} · 估算` : label;
      const amount = document.createElement('dd');
      amount.textContent = display.text;
      if (display.missing) amount.className = 'usage-missing';
      else amount.title = display.title;
      group.append(term, amount);
      metrics.append(group);
    }
    const day = document.createElement('p');
    day.className = 'usage-date';
    day.textContent = `创建日期：${entry?.createdDate || '未记录'}`;
    const source = document.createElement('p');
    source.className = 'usage-source';
    if (entry?.mappingStatus === 'user-provided') {
      source.textContent = entry.estimated ? '来源：本动画用量估算，非实际账单' : '来源：用户提供的本动画用量';
      if (entry.note) source.textContent += `；${entry.note}`;
    } else if (!entry?.sourceModel) {
      source.textContent = 'CSV 中没有对应模型记录';
    } else {
      source.textContent = `CSV 模型：${entry.sourceModel}`;
      if (entry.tokensTotal === null) source.textContent += '；缺少当天 Token 记录';
      if (entry.totalUsage === null) source.textContent += '；缺少当天 Usage 记录';
    }
    section.append(metrics, day, source);
    if (entry?.fxDate) {
      const conversion = document.createElement('p');
      conversion.className = 'usage-source';
      conversion.textContent = `${entry.estimated ? '约 ' : ''}${entry.totalUsage} USD · 1 USD = ${Number(entry.usdToCny).toFixed(6)} RMB`;
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
    element.textContent = '用量优先采用用户提供的本动画数据，否则按创建日期匹配模型当天的 CSV 用量；1 K = 1,000 tokens。“千 K 级”仅表示用户提供的百万级数量级，未提供确切数量或范围。美元费用按 ECB 参考汇率折算人民币，当日汇率未公布时采用此前最近汇率。CSV 当天用量可能包含其他请求；缺失记录显示“暂无数据”。';
    element.title = `来源：${data.sources.tokens}\n${data.sources.usage}`;
  });
  window.PelicanUsage = { createSummary, formatTokens, formatCost, costDisplay, tokenDisplay };
})();

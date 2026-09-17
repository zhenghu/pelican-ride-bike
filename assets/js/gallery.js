(() => {
  'use strict';
  const models = window.PELICAN_MODELS;
  const gallery = document.getElementById('gallery');
  document.getElementById('gallery-count').textContent = `${models.length} 个版本`;

  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
      const frame = entry.target.querySelector('iframe');
      frame.style.transform = `scale(${entry.contentRect.width / 1000})`;
    });
  });

  const cards = document.createDocumentFragment();
  models.forEach((model, index) => {
    const card = document.createElement('article');
    card.className = 'preview-panel gallery-card';
    card.setAttribute('aria-labelledby', `work-${index}`);
    const header = document.createElement('header');
    header.className = 'panel-header';
    const number = document.createElement('span');
    number.className = 'gallery-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const heading = document.createElement('div');
    heading.className = 'panel-heading';
    const title = document.createElement('h2');
    title.id = `work-${index}`;
    title.textContent = model.name;
    const tech = document.createElement('p');
    tech.textContent = model.tech.join(' · ');
    heading.append(title, tech);
    const original = document.createElement('a');
    original.className = 'original-link';
    original.href = '../' + model.file;
    original.target = '_blank';
    original.rel = 'noopener';
    original.textContent = '原页 ↗';
    original.setAttribute('aria-label', `${model.name}：在新标签打开原页`);
    header.append(number, heading, original);

    const stage = document.createElement('div');
    stage.className = 'stage';
    const loading = document.createElement('div');
    loading.className = 'loading-note';
    loading.textContent = '正在载入画面…';
    const frame = document.createElement('iframe');
    frame.title = `${model.name} 动画`;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.loading = 'eager';
    frame.src = '../' + model.file;
    frame.addEventListener('load', () => { loading.hidden = true; });
    stage.append(loading, frame);

    const footer = document.createElement('footer');
    footer.className = 'panel-footer';
    const size = document.createElement('span');
    size.textContent = '1000 × 650 · 等比缩放';
    const preview = document.createElement('a');
    preview.href = '../index.html#' + new URLSearchParams({ a: model.file, mode: 'single' }).toString();
    preview.textContent = '放大查看 ↗';
    preview.setAttribute('aria-label', `放大查看 ${model.name}`);
    footer.append(size, preview);
    card.append(header, stage, window.PelicanUsage.createSummary(model.file), footer);
    cards.append(card);
    resizeObserver.observe(stage);
  });
  gallery.append(cards);
})();

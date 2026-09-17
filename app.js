(() => {
  'use strict';
  const models = window.PELICAN_MODELS;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const valid = file => models.some(model => model.file === file);
  const resolveFile = (file, fallback) => {
    if (valid(file)) return file;
    // Keep previously copied preview URLs working after moving the artworks.
    const relocated = 'animations/' + file;
    return valid(relocated) ? relocated : fallback;
  };
  const state = {
    a: resolveFile(params.get('a'), 'animations/fable5.1.html'),
    b: resolveFile(params.get('b'), 'animations/opus5.html'),
    mode: params.get('mode') === 'single' ? 'single' : 'compare',
    target: 'a', query: ''
  };
  const modelFor = slot => models.find(model => model.file === state[slot]);
  const announce = message => { $('announcement').textContent = message; };

  function saveView() {
    const hash = new URLSearchParams({ a: state.a, b: state.b, mode: state.mode });
    try { history.replaceState(null, '', '#' + hash.toString()); } catch { /* File previews may restrict history. */ }
  }

  function renderList() {
    const filtered = models.filter(model => model.name.toLowerCase().includes(state.query.toLowerCase().trim()));
    const list = document.createDocumentFragment();
    filtered.forEach(model => {
      const slots = ['a', 'b'].filter(slot => state[slot] === model.file && (slot === 'a' || state.mode === 'compare'));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'model-item' + (slots.length ? ' selected' : '');
      button.setAttribute('aria-label', `${model.name}，放入画面 ${state.target.toUpperCase()}`);
      button.setAttribute('aria-pressed', String(state[state.target] === model.file));
      const number = document.createElement('span');
      number.className = 'model-index';
      number.textContent = String(models.indexOf(model) + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'model-name';
      name.textContent = model.name;
      const badges = document.createElement('span');
      badges.className = 'model-badges';
      badges.setAttribute('aria-hidden', 'true');
      slots.forEach(slot => { const badge = document.createElement('span'); badge.textContent = slot.toUpperCase(); badges.append(badge); });
      button.append(number, name, badges);
      button.addEventListener('click', () => {
        state[state.target] = model.file;
        renderPanel(state.target);
        renderList();
        saveView();
        announce(`画面 ${state.target.toUpperCase()} 已切换为 ${model.name}`);
        // Preserve keyboard focus when replacing the list.
        const replacement = Array.from($('model-list').children).find(item => item.dataset.file === model.file);
        replacement?.focus({ preventScroll: true });
      });
      button.dataset.file = model.file;
      list.append(button);
    });
    $('model-list').replaceChildren(list);
    $('empty-search').hidden = filtered.length !== 0;
    $('result-count').textContent = `${filtered.length} / ${models.length} 个版本`;
  }

  function scaleFrame(slot) {
    const stage = $('stage-' + slot);
    const frame = stage.querySelector('iframe');
    if (frame) frame.style.transform = `scale(${stage.clientWidth / 1000})`;
  }

  function renderPanel(slot) {
    const model = modelFor(slot);
    $('name-' + slot).textContent = model.name;
    $('tech-' + slot).textContent = model.tech.join(' · ');
    $('original-' + slot).href = model.file;
    $('position-' + slot).textContent = `${models.indexOf(model) + 1} / ${models.length}`;
    const stage = $('stage-' + slot);
    stage.querySelector('iframe')?.remove();
    if (slot === 'b' && state.mode === 'single') return;
    const frame = document.createElement('iframe');
    frame.title = `画面 ${slot.toUpperCase()}：${model.name} 动画`;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.src = model.file;
    frame.addEventListener('load', () => { stage.querySelector('.loading-note').hidden = true; });
    stage.querySelector('.loading-note').hidden = false;
    stage.append(frame);
    scaleFrame(slot);
  }

  function setTarget(slot) {
    state.target = state.mode === 'single' ? 'a' : slot;
    for (const key of ['a', 'b']) {
      const active = key === state.target;
      $('target-' + key).setAttribute('aria-pressed', String(active));
      $('panel-' + key).classList.toggle('active-slot', active);
      document.querySelector(`.slot-badge[data-slot="${key}"]`).setAttribute('aria-pressed', String(active));
    }
    renderList();
  }

  function setMode(mode) {
    state.mode = mode;
    const single = mode === 'single';
    $('previews').classList.toggle('single', single);
    $('panel-b').hidden = single;
    $('target-b').disabled = single;
    $('swap').hidden = single;
    $('single-mode').setAttribute('aria-pressed', String(single));
    $('compare-mode').setAttribute('aria-pressed', String(!single));
    $('restart').textContent = single ? '↻ 重新播放' : '↻ 同时重播';
    $('mode-hint').textContent = single ? '从版本库选择作品，查看完整画面。' : '选择 A 或 B，再从版本库挑选版本。';
    setTarget(state.target);
    renderPanel('b');
    scaleFrame('a');
    saveView();
  }

  $('search').addEventListener('input', event => { state.query = event.target.value; renderList(); });
  $('clear-search').addEventListener('click', () => { state.query = ''; $('search').value = ''; renderList(); $('search').focus(); });
  for (const slot of ['a', 'b']) {
    $('target-' + slot).addEventListener('click', () => setTarget(slot));
    document.querySelector(`.slot-badge[data-slot="${slot}"]`).addEventListener('click', () => setTarget(slot));
  }
  $('single-mode').addEventListener('click', () => setMode('single'));
  $('compare-mode').addEventListener('click', () => setMode('compare'));
  $('restart').addEventListener('click', () => { renderPanel('a'); renderPanel('b'); announce('已重新载入预览'); });
  $('swap').addEventListener('click', () => {
    [state.a, state.b] = [state.b, state.a];
    renderPanel('a'); renderPanel('b'); renderList(); saveView(); announce('已交换画面 A 和 B');
  });
  document.querySelectorAll('.step-button').forEach(button => button.addEventListener('click', () => {
    const slot = button.dataset.slot;
    const index = models.indexOf(modelFor(slot));
    state[slot] = models[(index + Number(button.dataset.step) + models.length) % models.length].file;
    renderPanel(slot); renderList(); saveView(); announce(`画面 ${slot.toUpperCase()} 已切换为 ${modelFor(slot).name}`);
  }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      event.preventDefault(); $('search').focus();
    }
    if (event.key === 'Escape' && document.activeElement === $('search')) {
      state.query = ''; $('search').value = ''; renderList();
    }
  });
  const observer = new ResizeObserver(() => { scaleFrame('a'); scaleFrame('b'); });
  observer.observe($('stage-a')); observer.observe($('stage-b'));
  $('total-count').textContent = models.length;
  renderPanel('a');
  setMode(state.mode);
})();

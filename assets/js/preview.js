(() => {
  'use strict';

  // Give taller original pages enough room before fitting them into the shared frame.
  const viewports = {
    'animations/OpenAI-GPTAstra-6.html': { width: 1000, height: 900, background: '#f6f3e9' },
    'animations/OpenAI-GPTAstra-6.2.html': { width: 1000, height: 760, background: '#f6f2e8' }
  };
  const defaultViewport = { width: 1000, height: 650, background: '' };

  function fit(stage, file) {
    const frame = stage.querySelector('iframe');
    if (!frame) return;
    const { width, height, background } = viewports[file] || defaultViewport;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    stage.style.backgroundColor = background;
    const availableWidth = stage.clientWidth;
    const availableHeight = stage.clientHeight;
    if (!availableWidth || !availableHeight) return;
    const scale = Math.min(availableWidth / width, availableHeight / height);
    frame.style.left = `${(availableWidth - width * scale) / 2}px`;
    frame.style.top = `${(availableHeight - height * scale) / 2}px`;
    frame.style.transform = `scale(${scale})`;
  }

  window.PelicanPreview = { fit };
})();

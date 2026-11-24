// Expand the whole Workbench without requiring the browser Fullscreen API.
export function mountWorkbenchFullscreen(root, button, doc = document) {
  function toggleFullscreen(force) {
    const open = typeof force === 'boolean'
      ? force : !root.classList.contains('workbench-fullscreen');
    root.classList.toggle('workbench-fullscreen', open);
    doc.body.classList.toggle('workbench-fullscreen-open', open);
    button.setAttribute('aria-pressed', String(open));
    button.setAttribute('aria-label', open
      ? 'Riduci il Workbench' : 'Espandi il Workbench a schermo intero');
    button.textContent = open ? '✕ Riduci' : '⛶ Espandi';
    button.focus();
  }

  const onClick = () => toggleFullscreen();
  const onKey = event => {
    if (event.key !== 'Escape' || !root.classList.contains('workbench-fullscreen')) return;
    toggleFullscreen(false);
  };
  button.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);

  return {
    toggleFullscreen,
    dispose() {
      button.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKey);
      if (root.classList.contains('workbench-fullscreen')) toggleFullscreen(false);
    }
  };
}

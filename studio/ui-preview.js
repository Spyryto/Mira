// Fixed code inside a sandboxed iframe. The compiler and editor stay in the
// parent. The iframe has scripts but no same-origin access to Studio storage.
(function () {
  'use strict';
  const root = document.getElementById('mira-root');
  const errors = document.getElementById('errors');
  const notify = (kind, message) => window.parent.postMessage({
    type: 'mira-ui:' + kind, message
  }, '*');

  function run(code) {
    root.replaceChildren();
    errors.textContent = '';
    const host = Object.create(null);
    Object.assign(host, globalThis.MiraUiHost.createUiHost(
      document, root, message => {
        errors.textContent = message;
        notify('error', message);
      }
    ));
    host.log = message => notify('log', String(message));
    try {
      new Function('__miraHost', '"use strict";\n' + code)(Object.freeze(host));
      notify('ready', 'Anteprima UI avviata');
    } catch (error) {
      errors.textContent = String(error?.message ?? error);
      notify('error', errors.textContent);
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'mira-ui:run'
        || typeof event.data.code !== 'string') return;
    run(event.data.code);
  });
  notify('loaded', 'Host UI pronto');
})();

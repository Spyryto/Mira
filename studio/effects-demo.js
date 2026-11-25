(function () {
  'use strict';
  const mount = document.getElementById('mount');
  const status = document.getElementById('effect-error');
  const report = error => { status.textContent = String(error?.message ?? error); };
  let app;
  const renderer = MiraUiHost.createUiHost(document, mount, report);
  const services = {
    greeting(payload, signal) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (payload.fail) reject(Error('Servizio non disponibile (simulazione)'));
          else resolve({message: 'Risposta alla richiesta ' + payload.request});
        }, payload.request % 2 ? 1500 : 300);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(Error('Annullato'));
        }, {once: true});
      });
    }
  };
  const host = Object.freeze({
    start(spec) {
      if (app) throw Error('Only one effect app per page');
      app = MiraEffects.createApp(renderer, spec, services, report);
      return spec;
    },
    send(message) { return app.dispatch(message); }
  });
  try { MiraEffectsDemoProgram(host); }
  catch (error) { report(error); }
  window.addEventListener('pagehide', event => { if (!event.persisted) app?.stop(); });
})();

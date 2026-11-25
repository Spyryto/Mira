(function () {
  'use strict';
  const report = error => { document.getElementById('error').textContent = String(error?.message ?? error); };
  const renderer = MiraUiHost.createUiHost(document, document.getElementById('mount'), report);
  let app;
  const services = MiraEffects.rpcServices('./ledger.php', MiraRpcBindings, 10000, MiraRpcTypes);
  const host = Object.freeze({
    start(spec) { app = MiraEffects.createApp(renderer, spec, services, report); },
    send(message) { return app.dispatch(message); }
  });
  try { MiraFullstackLedgerProgram(host); app.dispatch({type:'load'}); }
  catch (error) { report(error); }
  window.addEventListener('pagehide', event => { if (!event.persisted) app?.stop(); });
})();

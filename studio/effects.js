// Effects are plain descriptions; only explicitly registered host services run.
(function (global) {
  'use strict';

  // Snapshot at the boundary. Reject non-JSON values instead of silently
  // dropping functions, undefined or non-finite numbers during serialization.
  function snapshot(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value))
      throw Error('Expected acyclic JSON data');
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== null && Object.getPrototypeOf(proto) !== null)
      throw Error('Expected a JSON record');
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return Array.from(value, item => snapshot(item, ancestors));
      return Object.fromEntries(Object.entries(value).map(([key, item]) =>
        [key, snapshot(item, ancestors)]));
    } finally { ancestors.delete(value); }
  }

  function createApp(renderer, spec, services, onError = () => {}) {
    if (typeof spec?.view !== 'function' || typeof spec.update !== 'function')
      throw Error('An effect app requires view and update functions');
    const handlers = new Map(Object.entries(services));
    const pending = new Set();
    const owner = renderer.renderState(spec.view, spec.initial);
    let stopped = false, busy = false;

    function validate(result) {
      if (!result || !Object.hasOwn(result, 'model') || !Array.isArray(result.effects) ||
          result.effects.length > 32 || pending.size + result.effects.length > 64)
        throw Error('Expected {model, effects} with at most 32 effects and 64 pending');
      return result.effects.map(raw => {
        const effect = snapshot(raw);
        if (!effect || typeof effect.service !== 'string' ||
            typeof handlers.get(effect.service) !== 'function' ||
            typeof effect.reply !== 'string' || !effect.reply ||
            !(typeof effect.id === 'string' || Number.isSafeInteger(effect.id)) ||
            !Object.hasOwn(effect, 'payload'))
          throw Error('Invalid or unregistered effect');
        return effect;
      });
    }

    function active() { return !stopped && owner.isActive(); }
    function dispatch(message) {
      if (!active()) return false;
      if (busy) throw Error('Reentrant effect dispatch');
      let effects, committed;
      busy = true;
      try {
        const input = snapshot(message);
        committed = owner.dispatch(model => {
          const result = spec.update(model, input);
          effects = validate(result);
          return result.model;
        });
      } finally { busy = false; }
      if (!committed || !active()) return false;
      for (const effect of effects) launch(effect);
      return true;
    }

    function launch(effect) {
      const controller = new AbortController();
      pending.add(controller);
      const finish = message => {
        pending.delete(controller);
        if (!active() || controller.signal.aborted) return;
        try { dispatch(message); }
        catch (error) { onError(error); }
      };
      Promise.resolve().then(async () => {
        if (!active() || controller.signal.aborted) return;
        const reply = {type: effect.reply, id: effect.id};
        let message;
        try {
          const value = await handlers.get(effect.service)(effect.payload, controller.signal);
          message = {...reply, ok: true, value: snapshot(value)};
        } catch (error) {
          message = {...reply, ok: false, error: String(error?.message ?? error)};
        }
        finish(message);
      }).finally(() => pending.delete(controller));
    }

    function stop() {
      stopped = true;
      for (const controller of pending) controller.abort();
      pending.clear();
    }
    return Object.freeze({dispatch, stop, getState: owner.getState});
  }

  // A capability is bound to a URL by the host, never chosen by Mira code.
  // No credentials, retries or automatic access from the Studio editor.
  function jsonService(url, fetcher = global.fetch.bind(global)) {
    return async (payload, signal) => {
      const response = await fetcher(url, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        credentials: 'omit', redirect: 'error', body: JSON.stringify(payload), signal
      });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return response.json();
    };
  }

  global.MiraEffects = Object.freeze({createApp, jsonService});
})(globalThis);

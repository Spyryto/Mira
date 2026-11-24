// Explicit execution, off the UI thread. Not a sandbox for untrusted scripts.
self.onmessage = event => {
  const {code, invoke} = event.data ?? {};
  const now = () => typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now() : Date.now();
  let startedAt = null;
  try {
    if (typeof code !== 'string') throw new Error('No JavaScript to execute');
    let expression = 'typeof result === "undefined" ? undefined : result';

    if (invoke != null) {
      if (typeof invoke.name !== 'string' ||
          !/^[A-Za-z_][A-Za-z_0-9]*$/.test(invoke.name) ||
          !Array.isArray(invoke.args) || invoke.args.length > 10 ||
          !invoke.args.every(arg =>
            typeof arg === 'string' ||
            (typeof arg === 'number' && Number.isFinite(arg)))) {
        throw new Error('Invalid example invocation');
      }
      expression = invoke.name + '(' +
        invoke.args.map(arg => JSON.stringify(arg)).join(', ') + ')';
    }

    const messages = [];
    const host = {
      log: message => messages.push(String(message)),
      "get:from:": (key, record) => {
        if (typeof key !== "string" || !record || typeof record !== "object" ||
            !Object.hasOwn(record, key)) {
          throw new Error("Missing record field: " + String(key));
        }
        return record[key];
      },
      "filter:with:": (items, predicate) => {
        if (!Array.isArray(items) || typeof predicate !== "function" ||
            items.length > 10000) {
          throw new Error("filter:with: expects a bounded list and predicate");
        }
        return items.filter(item => predicate(item));
      },
      "map:with:": (items, callback) => {
        if (!Array.isArray(items) || typeof callback !== "function" ||
            items.length > 10000) {
          throw new Error("map:with: expects a bounded list and function");
        }
        return items.map(callback);
      },
      "fold:with:from:": (items, callback, seed) => {
        if (!Array.isArray(items) || typeof callback !== "function" ||
            items.length > 10000) {
          throw new Error("fold:with:from: expects a bounded list and function");
        }
        return items.reduce(callback, seed);
      }
    };
    // Mirror the aliases of collection-host.js without duplicating any loop.
    host['select:with:'] = host['filter:with:'];
    host['select:if:'] = host['filter:with:'];
    host['collect:if:'] = host['filter:with:'];
    host['collect:with:'] = host['map:with:'];
    Object.freeze(host);
    // Parse/prepare the JS before starting the timer; only execute Mira code.
    const execute = new Function('__miraHost',
      '"use strict";\n' + code + '\nreturn (' + expression + ');'
    );
    startedAt = now();
    const value = execute(host);
    const executionMs = Math.max(0, now() - startedAt);
    startedAt = null;
    const format = item => item && typeof item === "object"
      ? JSON.stringify(item, null, 2) : String(item);
    const output = [
      ...messages,
      ...(value === undefined ? (messages.length ? [] : ['(nessun valore result)']) : [format(value)])
    ].join('\n');
    self.postMessage({ok: true, output, executionMs});
  } catch (error) {
    const executionMs = startedAt === null ? undefined : Math.max(0, now() - startedAt);
    self.postMessage({ok: false, message: String(error?.message ?? error), executionMs});
  }
};

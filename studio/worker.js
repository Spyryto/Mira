// Explicit execution, off the UI thread. Not a sandbox for untrusted scripts.
self.onmessage = event => {
  const {code, invoke} = event.data ?? {};
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
    const host = Object.freeze({
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
    });
    const value = new Function('__miraHost',
      '"use strict";\n' + code + '\nreturn (' + expression + ');'
    )(host);
    const format = item => item && typeof item === "object"
      ? JSON.stringify(item, null, 2) : String(item);
    const output = [
      ...messages,
      ...(value === undefined ? (messages.length ? [] : ['(nessun valore result)']) : [format(value)])
    ].join('\n');
    self.postMessage({ok: true, output});
  } catch (error) {
    self.postMessage({ok: false, message: String(error?.message ?? error)});
  }
};

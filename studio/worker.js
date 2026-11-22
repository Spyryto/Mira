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
      log: message => messages.push(String(message))
    });
    const value = new Function('__miraHost',
      '"use strict";\n' + code + '\nreturn (' + expression + ');'
    )(host);
    const output = [
      ...messages,
      ...(value === undefined ? (messages.length ? [] : ['(nessun valore result)']) : [String(value)])
    ].join('\n');
    self.postMessage({ok: true, output});
  } catch (error) {
    self.postMessage({ok: false, message: String(error?.message ?? error)});
  }
};

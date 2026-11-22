// Execution is explicitly requested, off the UI thread.
// The Worker is NOT a security sandbox for untrusted JavaScript.
self.onmessage = event => {
  const {code, invoke} = event.data ?? {};
  try {
    if (typeof code !== 'string') {
      throw new Error('No JavaScript to execute');
    }

    let expression = 'typeof result === "undefined" ? undefined : result';

    // Catalog fixtures with two placeholders expose a callable, but Mira 0.2
    // does not yet have syntax to invoke general binary functions. The Studio
    // worker can exercise the compiled result for documentation only.
    if (invoke !== undefined && invoke !== null) {
      if (typeof invoke.name !== 'string' ||
          !/^[A-Za-z_][A-Za-z_0-9]*$/.test(invoke.name) ||
          !Array.isArray(invoke.args) ||
          invoke.args.length > 10 ||
          !invoke.args.every(arg =>
            typeof arg === 'string' ||
            (typeof arg === 'number' && Number.isFinite(arg)))) {
        throw new Error('Invalid example invocation');
      }
      expression = invoke.name + '(' +
        invoke.args.map(arg => JSON.stringify(arg)).join(', ') + ')';
    }

    // Mira currently emits plain JS declarations; result is converted to
    // plain text by the controller to avoid HTML injection.
    const result = new Function(
      '"use strict";\n' + code + '\nreturn (' + expression + ');'
    )();
    self.postMessage({
      ok: true,
      output: result === undefined ? '(nessun valore result)' : String(result)
    });
  } catch (error) {
    self.postMessage({ok: false, message: String(error?.message ?? error)});
  }
};

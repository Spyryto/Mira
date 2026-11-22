// Code execution is explicitly requested by the user and occurs off the UI thread.
// This worker is NOT a security sandbox for arbitrary untrusted JavaScript.
self.onmessage = event => {
  const { code } = event.data ?? {};
  try {
    if (typeof code !== 'string') {
      throw new Error('No JavaScript to execute');
    }

    // Mira 0.1 emits plain JS declarations. No DOM is made available here.
    // Results are returned as text to prevent accidental HTML injection.
    const result = new Function(
      '"use strict";\n' + code +
      '\nreturn typeof result === "undefined" ? undefined : result;'
    )();
    self.postMessage({
      ok: true,
      output: result === undefined ? '(nessun valore result)' : String(result)
    });
  } catch (error) {
    self.postMessage({ ok: false, message: String(error?.message ?? error) });
  }
};

import { executeInspector } from './inspector-host.js';

self.onmessage = event => {
  try {
    const {code, ast} = event.data ?? {};
    self.postMessage({ok: true, stats: executeInspector(code, ast)});
  } catch (error) {
    self.postMessage({ok: false, message: String(error?.message ?? error)});
  }
};

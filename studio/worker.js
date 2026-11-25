// Explicit execution, off the UI thread. Not a sandbox for untrusted scripts.
// Translate only frames from our generated function; never guess from
// a host/library frame. Calibrate new Function's line offset on failure,
// because browser engines need not report identical wrapper offsets.
function frameLines(error, filename) {
  if (typeof error?.stack !== 'string') return [];
  const lines = [];
  for (const frame of error.stack.split('\n')) {
    if (!/^\s*at\s|@/.test(frame)) continue;
    const index = frame.indexOf(filename + ':');
    if (index < 0) continue;
    const position = frame.slice(index + filename.length + 1).match(/^(\d+)(?::\d+)?/);
    if (position) lines.push(Number(position[1]));
  }
  return lines;
}

function locateRuntimeError(error, locations) {
  if (!Array.isArray(locations) || !locations.length) return undefined;
  const frames = frameLines(error, 'mira-generated-runtime.js');
  if (!frames.length) return undefined;
  let offset;
  try {
    new Function('throw new Error("probe");\n//# sourceURL=mira-runtime-probe.js')();
  } catch (probe) {
    const lines = frameLines(probe, 'mira-runtime-probe.js');
    if (lines.length) offset = lines[0] - 1;
  }
  if (!Number.isInteger(offset)) return undefined;
  for (const frame of frames) {
    // The strict-mode prefix occupies one additional line.
    const generatedLine = frame - offset - 1;
    const location = locations.find(entry => entry &&
      generatedLine >= entry.generatedStartLine && generatedLine <= entry.generatedEndLine);
    if (location) return {
      line: location.line, column: location.column,
      name: location.name, generatedLine
    };
  }
  return undefined;
}

self.onmessage = event => {
  const {code, invoke, locations} = event.data ?? {};
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
      '"use strict";\n' + code + '\nreturn (' + expression + ');' +
      (Array.isArray(locations) ? '\n//# sourceURL=mira-generated-runtime.js' : '')
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
    const location = startedAt === null ? undefined : locateRuntimeError(error, locations);
    self.postMessage({ok: false, message: String(error?.message ?? error), executionMs, location});
  }
};

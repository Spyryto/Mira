import { collectionHost } from './collection-host.js';

// One host object: named values and callable selectors.
// A plain object is sufficient; no dispatcher, magic or dynamic imports.
const CAPABILITIES = Object.freeze({
  AST: 'ast tree',
  FOLD: 'fold:with:from:',
  IS: 'node:is:'
});

export function childrenOf(node) {
  if (!node || typeof node !== 'object') return [];
  switch (node.kind) {
    case 'Program': return Array.isArray(node.definitions) ? node.definitions : [];
    case 'Function':
    case 'Value':
    case 'ExpressionStatement': return node.body ? [node.body] : [];
    case 'Binary': return [node.left, node.right].filter(Boolean);
    case 'FieldGet': return node.record ? [node.record] : [];
    case 'Block': return node.body ? [node.body] : [];
    case 'Steps': return Array.isArray(node.expressions) ? node.expressions : [];
    case 'Local': return node.value ? [node.value] : [];
    case 'Conditional': return [node.condition, node.whenTrue, node.whenFalse].filter(Boolean);
    case 'Call':
    case 'Section':
    case 'HostCall':
    case 'HostSection': return Array.isArray(node.arguments) ? node.arguments : [];
    case 'Apply': return [node.callee, node.argument].filter(Boolean);
    case 'Sequence': return Array.isArray(node.items) ? node.items : [];
    case 'Record': return Array.isArray(node.fields)
      ? node.fields.map(field => field.value) : [];
    default: return [];
  }
}

export function createInspectorHost(ast) {
  if (!ast || ast.kind !== 'Program' || !Array.isArray(ast.definitions)) {
    throw new Error('Expected canonical Mira Program AST');
  }

  const host = Object.create(null);
  Object.assign(host, collectionHost());
  host[CAPABILITIES.AST] = ast;
  host[CAPABILITIES.IS] = (item, kind) => {
    if (typeof kind !== 'string') throw new Error('node:is: expects a kind');
    return item?.kind === kind ? 1 : 0;
  };
  host[CAPABILITIES.FOLD] = (root, reducer, initial) => {
    if (typeof reducer !== 'function') {
      throw new Error('fold:with:from: requires a root, reducer and seed');
    }
    if (Array.isArray(root)) return collectionHost()['fold:with:from:'](root, reducer, initial);
    const stack = [root];
    let acc = initial;
    let visits = 0;
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (++visits > 10000) throw new Error('AST inspector node limit exceeded');
      acc = reducer(acc, node);
      const children = childrenOf(node);
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
    return acc;
  };
  host.log = message => console.log(message);
  return Object.freeze(host);
}

const RESULT_NAMES = Object.freeze({
  total: 'totalNodes',
  functions: 'functionNodes',
  values: 'valueNodes',
  calls: 'callNodes',
  binary: 'binaryNodes',
  sections: 'sectionNodes',
  applies: 'applyNodes',
  definitions: 'definitionSummaries'
});

export function executeInspector(code, ast) {
  if (typeof code !== 'string') throw new Error('Expected compiled JS code');
  const host = createInspectorHost(ast);
  // A worker protects UI responsiveness, not security against untrusted code.
  const fields = Object.entries(RESULT_NAMES)
    .map(([label, name]) => label + ': ' + name).join(', ');
  const stats = new Function('__miraHost',
    '"use strict";\n' + code + '\nreturn {' + fields + '};'
  )(host);
  for (const [name, value] of Object.entries(stats)) {
    if (name === 'definitions') {
      if (!Array.isArray(value) || !value.every(item =>
        item && typeof item.name === 'string' &&
        Number.isFinite(item.nodes) && Number.isFinite(item.calls))) {
        throw new Error('Mira inspector returned invalid definition summaries');
      }
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('Mira inspector returned an invalid ' + name + ' metric');
    }
  }
  return stats;
}

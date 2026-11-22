// Narrow host boundary used by Mira's AST inspector.
// The host supplies AST data and a traversal *mechanism*. Mira supplies
// reducers, predicates to count, and the computed summary.
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
    case 'Value': return node.body ? [node.body] : [];
    case 'Binary': return [node.left, node.right].filter(Boolean);
    case 'Call':
    case 'Section': return Array.isArray(node.arguments) ? node.arguments : [];
    case 'Apply': return [node.callee, node.argument].filter(Boolean);
    default: return [];
  }
}

export function createInspectorHost(ast) {
  if (!ast || ast.kind !== 'Program' || !Array.isArray(ast.definitions)) {
    throw new Error('Expected canonical Mira Program AST');
  }
  return Object.freeze({
    get(name) {
      if (name !== CAPABILITIES.AST) throw new Error('Unknown host value: ' + name);
      return ast;
    },
    call(selector, args) {
      if (selector === CAPABILITIES.IS) {
        if (args.length !== 2 || typeof args[1] !== 'string') {
          throw new Error('node:is: expects a node and a kind');
        }
        return args[0]?.kind === args[1] ? 1 : 0;
      }

      if (selector === CAPABILITIES.FOLD) {
        const [root, reducer, initial] = args;
        if (args.length !== 3 || typeof reducer !== 'function') {
          throw new Error('fold:with:from: requires a root, reducer and seed');
        }

        const stack = [root];
        let accumulator = initial;
        let visits = 0;
        while (stack.length) {
          const node = stack.pop();
          if (!node || typeof node !== 'object') continue;
          visits++;
          if (visits > 10000) throw new Error('AST inspector node limit exceeded');
          accumulator = reducer(accumulator, node);
          const children = childrenOf(node);
          for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
          }
        }
        return accumulator;
      }
      throw new Error('Unknown host selector: ' + selector);
    }
  });
}

const RESULT_NAMES = Object.freeze({
  total: 'totalNodes',
  functions: 'functionNodes',
  values: 'valueNodes',
  calls: 'callNodes',
  binary: 'binaryNodes',
  sections: 'sectionNodes',
  applies: 'applyNodes'
});

export function executeInspector(code, ast) {
  if (typeof code !== 'string') throw new Error('Expected compiled JS code');
  const host = createInspectorHost(ast);
  // This is a same-origin Worker's code evaluation, not a security sandbox.
  // The host contract exposes only three explicit capabilities.
  const expression = Object.entries(RESULT_NAMES)
    .map(([label, name]) => label + ': ' + name)
    .join(', ');
  const stats = new Function('__miraHost',
    '"use strict";\n' + code + '\nreturn {' + expression + '};'
  )(host);

  for (const [name, value] of Object.entries(stats)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('Mira inspector returned an invalid ' + name + ' metric');
    }
  }
  return stats;
}

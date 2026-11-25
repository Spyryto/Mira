// Minimal declarative DOM host for compiled Mira. Browser-facing, not an
// implementation of Mira semantics. Text is inserted with textContent only.
(function (global) {
  'use strict';

  // A deliberately small typed CSS vocabulary. Numeric lengths are px.
  const length = value => Number.isFinite(value) && value >= 0 && value <= 4096
    ? value + 'px' : null;
  const color = value => typeof value === 'string' &&
    (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
      || ['transparent', 'currentColor'].includes(value)) ? value : null;
  const choice = (...values) => value => values.includes(value) ? value : null;
  const size = value => value === 'fill' ? '100%' : value === 'auto' ? 'auto' : length(value);
  const styles = {
    background: ['background-color', color], color: ['color', color],
    padding: ['padding', length], margin: ['margin', length], gap: ['gap', length],
    radius: ['border-radius', length], borderWidth: ['border-width', length],
    borderColor: ['border-color', color], borderStyle: ['border-style', choice('solid', 'none', 'dashed')],
    fontSize: ['font-size', length],
    fontWeight: ['font-weight', value => Number.isInteger(value) && value >= 100 && value <= 900 ? String(value) : null],
    width: ['width', size], maxWidth: ['max-width', size], minWidth: ['min-width', size],
    flex: ['flex-grow', value => Number.isFinite(value) && value >= 0 && value <= 100 ? String(value) : null],
    align: ['align-items', choice('start', 'center', 'end', 'stretch', 'baseline')],
    justify: ['justify-content', choice('start', 'center', 'end', 'space-between', 'space-around')],
    wrap: ['flex-wrap', choice('wrap', 'nowrap')],
    textAlign: ['text-align', choice('left', 'center', 'right')],
    shadow: ['box-shadow', value => typeof value === 'string' && Object.hasOwn(shadows, value) ? shadows[value] : null]
  };
  const shadows = {none: 'none', hard: '3px 3px 0 #1e2529', soft: '0 4px 16px #1e252926'};

  function styleRecord(record, output) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Each style must be a record');
    }
    for (const [key, value] of Object.entries(record)) {
      if (!Object.hasOwn(styles, key)) throw new Error('Unsupported style property: ' + key);
      const [property, validate] = styles[key];
      const css = validate(value);
      if (css === null) throw new Error('Invalid style value for ' + key);
      output[property] = css;
    }
  }

  function resolveStyles(layers) {
    const css = Object.create(null);
    for (const layer of layers) for (const record of layer) styleRecord(record, css);
    return css;
  }

  function createUiHost(doc, mount, onError = () => {}) {
    const MAX_NODES = 1000;
    const MAX_DEPTH = 24;
    const uiHost = Object.create(null);

    function report(error) {
      onError(String(error?.message ?? error));
    }

    function addText(tag, value, className) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      node.textContent = String(value ?? '');
      return node;
    }

    // Decorations are transparent: no wrapper DOM node, and the underlying
    // component keeps its identity. Inner styles first, outer styles last.
    function unwrap(spec) {
      const layers = [];
      while (spec?.type === 'styled') {
        if (layers.length >= MAX_DEPTH || !Array.isArray(spec.styles) || spec.styles.length > 32) {
          throw new Error('styled.styles must be a bounded sequence');
        }
        layers.push(spec.styles);
        spec = spec.view;
      }
      return {spec, css: resolveStyles(layers.reverse())};
    }

    function patchStyles(instance, css) {
      const previous = instance.css ?? {};
      for (const name of Object.keys(previous)) {
        if (!Object.hasOwn(css, name)) instance.node.style.removeProperty(name);
      }
      for (const [name, value] of Object.entries(css)) {
        if (previous[name] !== value) instance.node.style.setProperty(name, value);
      }
      instance.css = css;
    }

    // Prepare a validated view before touching the mounted DOM. Instances
    // retain native nodes and the current callbacks, not copies of Mira state.
    function prepare(spec, previous, parentState, budget, depth, nextState) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('A view must be a Mira record');
      }
      if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) {
        throw new Error('The view exceeds its size/depth limit');
      }
      const source = spec;
      const decorated = unwrap(spec);
      spec = decorated.spec;
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('A styled view must contain a Mira record');
      }
      const type = spec.type;
      if (type === 'state' && spec.key !== undefined && typeof spec.key !== 'string') {
        throw new Error('state.key must be a string');
      }
      const same = previous && previous.spec.type === type &&
        (type !== 'state' || previous.spec.key === spec.key);
      const instance = same ? previous : {active: false, children: [], node: null};
      const plan = {instance, spec, source, css: decorated.css, parentState, depth, children: []};
      const oldChildren = same ? instance.children : [];
      const child = (value, index, owner = parentState) =>
        prepare(value, oldChildren[index], owner, budget, depth + 1);

      switch (type) {
        case 'title':
        case 'text':
          plan.text = String(spec.text ?? '');
          break;
        case 'grid':
          if (!Number.isInteger(spec.columns) || spec.columns < 1 || spec.columns > 6) {
            throw new Error('grid.columns must be an integer from 1 to 6');
          }
          plan.css['grid-template-columns'] = 'repeat(' + spec.columns + ', minmax(0, 1fr))';
          // fall through to the shared container case
        case 'column':
        case 'row':
          if (!Array.isArray(spec.children)) throw new Error(type + '.children must be a sequence');
          plan.children = spec.children.map((value, index) => child(value, index));
          break;
        case 'button':
          if (spec.update !== undefined && typeof spec.update !== 'function') {
            throw new Error('button.update must be a Mira function');
          }
          if (spec.onClick !== undefined && typeof spec.onClick !== 'function') {
            throw new Error('button.onClick must be a Mira function');
          }
          plan.text = String(spec.label ?? '');
          break;
        case 'input':
        case 'checkbox':
        case 'select':
          if (typeof spec.update !== 'function') throw new Error(type + '.update must be a Mira function');
          if (!parentState) throw new Error(type + '.update requires a state parent');
          plan.text = String(spec.label ?? '');
          if (type === 'checkbox') {
            if (typeof spec.checked !== 'boolean') throw new Error('checkbox.checked must be boolean');
          } else if (type === 'select') {
            if (!Array.isArray(spec.options) || !spec.options.every(option => typeof option === 'string') ||
                new Set(spec.options).size !== spec.options.length ||
                typeof spec.value !== 'string' || !spec.options.includes(spec.value)) {
              throw new Error('select requires unique string options and a matching string value');
            }
            budget.nodes += spec.options.length;
            if (budget.nodes > MAX_NODES) throw new Error('The view exceeds its size/depth limit');
          } else if (typeof spec.value !== 'string') {
            throw new Error('input.value must be a string');
          }
          break;
        case 'state':
          if (typeof spec.view !== 'function') throw new Error('state.view must be a Mira function');
          plan.state = nextState ? nextState.value : same ? instance.state : spec.initial;
          plan.children = [child(spec.view(plan.state), 0, instance)];
          break;
        default:
          throw new Error('Unsupported view type: ' + String(type));
      }
      return plan;
    }

    function deactivate(instance) {
      instance.active = false;
      for (const child of instance.children) deactivate(child);
    }

    function update(instance, transition) {
      if (!instance?.active) return;
      const next = transition(instance.state);
      const plan = prepare(instance.source, instance, instance.parentState,
        {nodes: 0}, instance.depth, {value: next});
      commit(plan);
    }

    function syncControl(instance) {
      const {spec, control} = instance;
      if (spec.type === 'checkbox') {
        if (control.checked !== spec.checked) control.checked = spec.checked;
      } else if (!instance.composing && control.value !== spec.value) {
        control.value = spec.value;
      }
    }

    function buildControl(instance, type) {
      const wrapper = doc.createElement('label');
      wrapper.className = 'mira-ui-control' + (type === 'checkbox' ? ' mira-ui-check' : '');
      instance.label = addText('span', '', 'mira-ui-label');
      const control = instance.control = doc.createElement(type === 'select' ? 'select' : 'input');
      control.className = 'mira-ui-input';
      if (type !== 'select') control.type = type === 'checkbox' ? 'checkbox' : 'text';
      function change(event) {
        if (!instance.active) return;
        if (event?.isComposing) { instance.composing = true; return; }
        if (instance.composing) return;
        const {spec, parentState} = instance;
        const value = type === 'checkbox' ? control.checked : control.value;
        if (value === (type === 'checkbox' ? spec.checked : spec.value)) return;
        try {
          update(parentState, old => spec.update(old, value));
        } catch (error) {
          syncControl(instance);
          report(error);
        }
      }
      control.addEventListener(type === 'input' ? 'input' : 'change', change);
      if (type === 'input') {
        control.addEventListener('compositionstart', () => { instance.composing = true; });
        control.addEventListener('compositionend', () => {
          instance.composing = false;
          change();
        });
      }
      wrapper.append(instance.label, control);
      return wrapper;
    }

    function setText(node, value) {
      if (node.textContent !== value) node.textContent = value;
    }

    function build(instance, type) {
      switch (type) {
        case 'title': return addText('h2', '', 'mira-ui-title');
        case 'text': return addText('p', '', 'mira-ui-text');
        case 'column':
        case 'row':
        case 'grid':
        case 'state': {
          const node = doc.createElement(type === 'state' ? 'section' : 'div');
          node.className = 'mira-ui-' + type;
          return node;
        }
        case 'input':
        case 'checkbox':
        case 'select':
          return buildControl(instance, type);
        case 'button': {
          const node = addText('button', '', 'mira-ui-button');
          node.type = 'button';
          node.addEventListener('click', () => {
            if (!instance.active) return;
            const {spec, parentState} = instance;
            try {
              if (spec.update) {
                if (!parentState) throw new Error('button.update requires a state parent');
                update(parentState, spec.update);
              }
              if (spec.onClick) spec.onClick(null);
            } catch (error) { report(error); }
          });
          return node;
        }
      }
    }

    function commit(plan) {
      const {instance, spec} = plan;
      const previous = instance.spec;
      const type = spec.type;
      if (!instance.node) instance.node = build(instance, type);
      const node = instance.node;
      instance.spec = spec;
      instance.source = plan.source;
      patchStyles(instance, plan.css);
      instance.parentState = plan.parentState;
      instance.depth = plan.depth;
      instance.active = true;
      if (type === 'state') instance.state = plan.state;
      if (type === 'title' || type === 'text' || type === 'button') {
        setText(node, plan.text);
      } else if (type === 'input' || type === 'checkbox' || type === 'select') {
        setText(instance.label, plan.text);
        const control = instance.control;
        if (control.getAttribute('aria-label') !== plan.text) control.setAttribute('aria-label', plan.text);
        if (type === 'select' && (!previous || previous.options.length !== spec.options.length ||
            spec.options.some((value, i) => value !== previous.options[i]))) {
          control.replaceChildren(...spec.options.map(choice => {
            const option = addText('option', choice);
            option.value = choice;
            return option;
          }));
        }
        syncControl(instance);
      }
      // Positional reconciliation: stable type/position keeps native identity.
      // No keyed list reordering; state keys only opt into a local reset.
      const old = instance.children;
      const children = plan.children.map((child, index) => {
        const next = commit(child);
        const before = old[index];
        if (!before) node.append(next.node);
        else if (before !== next) {
          deactivate(before);
          node.replaceChild(next.node, before.node);
        }
        return next;
      });
      for (let i = children.length; i < old.length; i++) {
        deactivate(old[i]);
        old[i].node.remove();
      }
      instance.children = children;
      return instance;
    }

    let mounted = null;
    uiHost.render = spec => {
      // Explicit render starts a new tree; state updates reconcile in place.
      const plan = prepare(spec, null, null, {nodes: 0}, 0);
      const next = commit(plan);
      if (mounted) deactivate(mounted);
      mount.replaceChildren(next.node);
      mounted = next;
      return spec;
    };

    uiHost.alert = message => {
      const dialog = doc.createElement('dialog');
      dialog.className = 'mira-ui-dialog';
      dialog.append(addText('p', message, 'mira-ui-dialog-message'));
      const close = addText('button', 'Chiudi', 'mira-ui-button');
      close.type = 'button';
      close.addEventListener('click', () => {
        if (typeof dialog.close === 'function') dialog.close();
        dialog.remove();
      });
      dialog.append(close);
      mount.append(dialog);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      return message;
    };

    return Object.freeze(uiHost);
  }

  global.MiraUiHost = Object.freeze({createUiHost, resolveStyles});
})(globalThis);

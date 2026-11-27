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

  // Both renderers use the same native control lifecycle and IME handling.
  const checkedType = type => type === 'checkbox' || type === 'toggle';
  const choiceType = type => type === 'select' || type === 'tabs';
  const numericType = type => type === 'slider' || type === 'stepper';
  function controlValue(type, value, options) {
    if (checkedType(type)) {
      if (typeof value !== 'boolean') throw new Error(type + '.checked must be boolean');
    } else if (numericType(type)) {
      if (!Number.isSafeInteger(value) || (type === 'slider' && (value < 0 || value > 100)))
        throw new Error(type + ' requires a safe integer' + (type === 'slider' ? ' from 0 to 100' : ''));
    } else if (choiceType(type)) {
      if (typeof value !== 'string' || !options.includes(value)) {
        throw new Error('select requires unique string options and a matching string value');
      }
    } else if (typeof value !== 'string') throw new Error('input.value must be a string');
    return value;
  }

  function connectControl(control, type, binding, report) {
    let composing = false;
    const property = checkedType(type) ? 'checked' : 'value';
    function sync(value) {
      if (composing) return;
      const native = type === 'slider' ? String(value) : value;
      if (control[property] !== native) control[property] = native;
      if (control.miraSync) control.miraSync(value);
    }
    function change(event) {
      if (!binding.active()) return;
      if (event?.isComposing) { composing = true; return; }
      if (composing) return;
      const value = numericType(type) ? Number(control[property]) : control[property];
      if (value === binding.read()) { sync(value); return; }
      try { binding.apply(value); }
      catch (error) { sync(binding.read()); report(error); }
    }
    if (type === 'tabs' || type === 'stepper') control.miraChange = change;
    else control.addEventListener(type === 'input' || type === 'slider' ? 'input' : 'change', change);
    if (type === 'input') {
      control.addEventListener('compositionstart', () => { composing = true; });
      control.addEventListener('compositionend', () => { composing = false; change(); });
    }
    return sync;
  }

  function createUiHost(doc, mount, onError = () => {}, bindControl = connectControl, onRootCommit = () => {}) {
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

    // Decorations are transparent: no wrapper DOM node. Keys are scoped
    // to siblings, independently of the existing state.key reset token.
    function unwrap(spec) {
      const layers = [];
      let identity, depth = 0;
      while (spec?.type === 'styled' || spec?.type === 'keyed') {
        if (++depth > MAX_DEPTH) throw new Error('View decoration depth limit');
        if (spec.type === 'keyed') {
          if (identity !== undefined) throw new Error('Multiple identity keys on one view');
          const key = spec.key;
          if (!(typeof key === 'string' && key.length > 0) && !Number.isSafeInteger(key))
            throw new Error('Identity key must be a nonempty string or safe integer');
          identity = key;
        } else {
          if (!Array.isArray(spec.styles) || spec.styles.length > 32)
            throw new Error('styled.styles must be a bounded sequence');
          layers.push(spec.styles);
        }
        spec = spec.view;
      }
      return {spec, identity, css: resolveStyles(layers.reverse())};
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
    function prepare(spec, previous, parentState, budget, depth, nextState, decoration) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('A view must be a Mira record');
      }
      if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) {
        throw new Error('The view exceeds its size/depth limit');
      }
      const source = spec;
      const decorated = decoration ?? unwrap(spec);
      spec = decorated.spec;
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('A styled view must contain a Mira record');
      }
      const type = spec.type;
      if (type === 'state' && spec.key !== undefined && typeof spec.key !== 'string') {
        throw new Error('state.key must be a string');
      }
      const same = previous && previous.spec.type === type && previous.identity === decorated.identity &&
        (type !== 'state' || previous.spec.key === spec.key);
      const instance = same ? previous : {active: false, children: [], node: null};
      const plan = {instance, spec, source, identity: decorated.identity, css: decorated.css, parentState, depth, children: []};
      const oldChildren = same ? instance.children : [];
      const child = (value, index, owner = parentState) =>
        prepare(value, oldChildren[index], owner, budget, depth + 1);

      switch (type) {
        case 'title':
        case 'text':
        case 'led':
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
          // Validate keys before committing any node. Unkeyed siblings retain
          // positional matching; they never consume a keyed instance.
          const decoratedChildren = spec.children.map(unwrap);
          plan.keyed = oldChildren.some(c => c.identity !== undefined) ||
            decoratedChildren.some(c => c.identity !== undefined);
          if (!plan.keyed) {
            plan.children = spec.children.map((value, i) =>
              prepare(value, oldChildren[i], parentState, budget, depth + 1, undefined, decoratedChildren[i]));
          } else {
            const byKey = new Map(oldChildren.filter(c => c.identity !== undefined).map(c => [c.identity, c]));
            const seen = new Set();
            plan.children = spec.children.map((value, i) => {
              const decoration = decoratedChildren[i], key = decoration.identity;
              if (key !== undefined) {
                if (seen.has(key)) throw new Error('Duplicate sibling identity: ' + String(key));
                seen.add(key);
              }
              const previous = key === undefined
                ? (oldChildren[i]?.identity === undefined ? oldChildren[i] : undefined)
                : byKey.get(key);
              return prepare(value, previous, parentState, budget, depth + 1, undefined, decoration);
            });
          }
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
        case 'slider':
        case 'toggle':
        case 'tabs':
        case 'stepper':
          if (typeof spec.update !== 'function') throw new Error(type + '.update must be a Mira function');
          if (!parentState) throw new Error(type + '.update requires a state parent');
          plan.text = String(spec.label ?? '');
          if (choiceType(type)) {
            if (!Array.isArray(spec.options) || !spec.options.every(option => typeof option === 'string') ||
                new Set(spec.options).size !== spec.options.length) {
              throw new Error('select requires unique string options and a matching string value');
            }
            budget.nodes += spec.options.length;
            if (budget.nodes > MAX_NODES) throw new Error('The view exceeds its size/depth limit');
          }
          controlValue(type, checkedType(type) ? spec.checked : spec.value, spec.options);
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
      if (!instance?.active || !mounted || mount.children[0] !== mounted.node) return false;
      const next = transition(instance.state);
      if (instance.hybrid) {
        updateHybrid(instance, next);
        if (instance === mounted) onRootCommit(instance.state);
        return true;
      }
      const plan = prepare(instance.source, instance, instance.parentState,
        {nodes: 0}, instance.depth, {value: next});
      commit(plan);
      if (instance === mounted) onRootCommit(instance.state);
      return true;
    }

    function syncControl(instance) {
      instance.sync(checkedType(instance.spec.type) ? instance.spec.checked : instance.spec.value);
    }

    function buildControl(instance, type) {
      const composite = type === 'tabs' || type === 'stepper';
      const wrapper = doc.createElement(composite ? 'div' : 'label');
      wrapper.className = 'mira-ui-control' + (type === 'checkbox' ? ' mira-ui-check' :
        type === 'toggle' ? ' mira-ui-toggle' : '');
      instance.label = addText('span', '', 'mira-ui-label');
      const control = instance.control = doc.createElement(composite ? 'div' : type === 'select' ? 'select' : 'input');
      control.className = composite ? 'mira-ui-' + type : type === 'slider' ? 'mira-ui-slider-input' :
        type === 'toggle' ? 'mira-ui-toggle-input' : 'mira-ui-input';
      if (!composite && type !== 'select') control.type = checkedType(type) ? 'checkbox' : type === 'slider' ? 'range' : 'text';
      let surface = control;
      if (type === 'slider') {
        control.min = '0'; control.max = '100'; control.step = '1';
        surface = doc.createElement('div'); surface.className = 'mira-ui-rangebox';
        const output = addText('output', '', 'mira-ui-slider-value');
        surface.append(control, output);
        let last;
        control.miraSync = value => {
          if (last === value) return;
          last = value;
          control.style.setProperty('--pct', value + '%');
          setText(output, value + '%');
        };
      } else if (type === 'toggle') {
        surface = doc.createElement('span'); surface.className = 'mira-ui-switch';
        const track = doc.createElement('i'); track.setAttribute('aria-hidden','true');
        control.setAttribute('role','switch');
        surface.append(control, track);
      } else if (type === 'tabs') {
        control.setAttribute('role','group');
        control.miraSync = value => {
          for (const button of control.children) {
            const selected = button.value === value;
            if (button.getAttribute('aria-selected') !== String(selected)) button.setAttribute('aria-selected', String(selected));
            if (button.getAttribute('aria-pressed') !== String(selected)) button.setAttribute('aria-pressed', String(selected));
          }
        };
      } else if (type === 'stepper') {
        control.setAttribute('role','group');
        const minus = addText('button','−','mira-ui-step-button'), plus = addText('button','+','mira-ui-step-button');
        const value = addText('strong','','mira-ui-step-value');
        value.setAttribute('aria-live','polite');
        for (const [button,delta,label] of [[minus,-1,'Decrementa'],[plus,1,'Incrementa']]) {
          button.type = 'button'; button.setAttribute('aria-label',label);
          button.addEventListener('click',()=>{
            if (!instance.active || button.disabled) return;
            control.value = Number(control.value) + delta;
            control.miraChange();
          });
        }
        control.append(minus,value,plus);
        control.miraSync = n => {
          setText(value,String(n));
          minus.disabled = n === Number.MIN_SAFE_INTEGER;
          plus.disabled = n === Number.MAX_SAFE_INTEGER;
        };
      }
      instance.sync = bindControl(control, type, {
        active: () => instance.active,
        read: () => checkedType(type) ? instance.spec.checked : instance.spec.value,
        transition: () => instance.spec.update,
        apply: value => update(instance.parentState, old => instance.spec.update(old, value))
      }, report);
      wrapper.append(instance.label, surface);
      return wrapper;
    }

    function setText(node, value) {
      if (node.textContent !== value) node.textContent = value;
    }

    function build(instance, type) {
      switch (type) {
        case 'title': return addText('h2', '', 'mira-ui-title');
        case 'text': return addText('p', '', 'mira-ui-text');
        case 'led': { const node = addText('span', '', 'mira-ui-led'); node.setAttribute('role','status'); return node; }
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
        case 'slider':
        case 'toggle':
        case 'tabs':
        case 'stepper':
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
      instance.identity = plan.identity;
      patchStyles(instance, plan.css);
      instance.parentState = plan.parentState;
      instance.depth = plan.depth;
      instance.active = true;
      if (type === 'state') instance.state = plan.state;
      if (type === 'title' || type === 'text' || type === 'button' || type === 'led') {
        setText(node, plan.text);
      } else if (type === 'input' || checkedType(type) || choiceType(type) || numericType(type)) {
        setText(instance.label, plan.text);
        const control = instance.control;
        if (control.getAttribute('aria-label') !== plan.text) control.setAttribute('aria-label', plan.text);
        if (choiceType(type) && (!previous || previous.options.length !== spec.options.length ||
            spec.options.some((value, i) => value !== previous.options[i]))) {
          control.replaceChildren(...spec.options.map(choice => {
            const option = addText(type === 'tabs' ? 'button' : 'option', choice);
            option.value = choice;
            if (type === 'tabs') {
              option.type = 'button';
              option.addEventListener('click',()=>{
                if (!instance.active || option.parentNode !== control) return;
                control.value = choice; control.miraChange();
              });
            }
            return option;
          }));
        }
        syncControl(instance);
      }
      const old = instance.children;
      if (plan.keyed) {
        const children = plan.children.map(commit);
        const retained = new Set(children);
        for (const previous of old) if (!retained.has(previous)) {
          deactivate(previous);
          previous.node.remove();
        }
        // Reuse existing native nodes, including nested state owners.
        // moveBefore preserves browser state on supporting engines. For
        // older engines, restore focus/selection after an actual DOM move.
        for (let i = 0; i < children.length; i++) {
          const next = children[i].node, before = node.children[i] ?? null;
          if (next === before) continue;
          if (next.parentNode === node && typeof node.moveBefore === 'function') {
            node.moveBefore(next, before);
          } else {
            const focused = doc.activeElement;
            const preserve = next.parentNode === node && focused && next.contains(focused);
            const selection = preserve && typeof focused.selectionStart === 'number'
              ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection] : null;
            node.insertBefore(next, before);
            if (preserve && doc.activeElement !== focused) {
              focused.focus({preventScroll: true});
              if (selection) focused.setSelectionRange(...selection);
            }
          }
        }
        instance.children = children;
        return instance;
      }
      // Fast positional path for ordinary static siblings.
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

    // Generic fallback keeps the same root shape and state owner.
    uiHost.renderState = (view, initial) => {
      uiHost.render({type: 'state', initial, view});
      const owner = mounted;
      return {
        getState: () => owner.state,
        isActive: () => owner.active && mounted === owner && mount.children[0] === owner.node,
        dispatch: transition => update(owner, transition)
      };
    };

    // Hybrid roots use the ordinary state owner and reconciliation for
    // generic regions. Specialized regions retain instance references.
    function regionSize(instance) {
      return 1 + (choiceType(instance.spec.type) ? instance.spec.options.length : 0)
        + instance.children.reduce((sum, child) => sum + regionSize(child), 0);
    }

    function updateHybrid(owner, next) {
      const hybrid = owner.hybrid;
      hybrid.validateState(next);
      // Account for the root, fixed column and all specialized regions.
      // Generic regions charge the very same budget as normal prepare().
      const budget = {nodes: 2 + hybrid.fixedSize};
      const plans = hybrid.regions.map(region => {
        if (!region.specialized) {
          return {region, plan: prepare(region.view(next), region.instance, owner, budget, 2)};
        }
        const values = region.specialized.values(next);
        if (values.length !== region.slots.length) throw new Error('Invalid specialized slot count');
        return {region, values: values.map((value, i) => hybrid.slotValue(region.slots[i].slot, value))};
      });
      // All regions validated before any commit. One owner, one state value.
      const column = owner.children[0];
      for (const item of plans) {
        const region = item.region;
        if (item.plan) {
          const previous = region.instance;
          const updated = commit(item.plan);
          if (updated !== previous) {
            deactivate(previous);
            column.node.replaceChild(updated.node, previous.node);
          }
          region.instance = updated;
          column.children[region.index] = updated;
        } else {
          region.slots.forEach(({slot, instance}, i) => {
            const value = item.values[i];
            if (slot.kind === 'text') setText(instance.node, value);
            else if (slot.kind === 'style') patchStyles(instance, {...instance.css, ...value});
            else if (slot.kind === 'control') {
              const key = checkedType(slot.type) ? 'checked' : 'value';
              instance.spec = {...instance.spec, [key]: value};
              syncControl(instance);
            }
          });
        }
      }
      owner.state = next;
    }

    // Internal browser API, deliberately not exposed as a Mira host selector.
    // Regions are explicit fixed siblings, each compiled or generic.
    uiHost.renderHybrid = (regions, initial, validateState, slotValue) => {
      validateState(initial);
      uiHost.render({type: 'state', initial, view: value => ({
        type: 'column', children: regions.map(region => region.view(value))
      })});
      const owner = mounted;
      const children = owner.children[0].children;
      let fixedSize = 0;
      const installed = regions.map((region, index) => {
        const instance = children[index];
        let slots = [];
        if (region.specialized) {
          fixedSize += regionSize(instance);
          slots = region.specialized.slots.map(slot => {
            let node = instance;
            for (const part of slot.path) node = node.children[part];
            if (!node) throw new Error('Invalid specialized slot path');
            return {slot, instance: node};
          });
        }
        return {...region, index, instance, slots};
      });
      owner.hybrid = {regions: installed, fixedSize, validateState, slotValue};
      return {getState: () => owner.state};
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

  global.MiraUiHost = Object.freeze({createUiHost, resolveStyles, controlValue, connectControl});
})(globalThis);

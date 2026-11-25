// Minimal declarative DOM host for compiled Mira. Browser-facing, not an
// implementation of Mira semantics. Text is inserted with textContent only.
(function (global) {
  'use strict';

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

    // Preserve focus/caret on a structurally stable control across a state
    // refresh. No general DOM diffing or mutable Mira bindings are needed.
    function focusedControl(slot) {
      const node = doc.activeElement;
      if (!node || !['INPUT', 'SELECT', 'BUTTON'].includes(String(node.tagName).toUpperCase())) return null;
      const path = [];
      let cursor = node;
      while (cursor !== slot) {
        const parent = cursor.parentNode;
        if (!parent) return null;
        const index = Array.from(parent.children).indexOf(cursor);
        if (index < 0) return null;
        path.unshift(index);
        cursor = parent;
      }
      return {path, tag: node.tagName, type: node.type, value: node.value,
        label: node.getAttribute?.('aria-label') ?? node.textContent,
        start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection};
    }

    function restoreFocus(slot, saved) {
      if (!saved) return;
      let node = slot;
      for (const index of saved.path) {
        node = node.children[index];
        if (!node) return;
      }
      if (node.tagName !== saved.tag || node.type !== saved.type ||
          (node.getAttribute?.('aria-label') ?? node.textContent) !== saved.label) return;
      node.focus?.({preventScroll: true});
      if (node.value === saved.value && Number.isInteger(saved.start) &&
          Number.isInteger(saved.end) && typeof node.setSelectionRange === 'function') {
        node.setSelectionRange(saved.start, saved.end, saved.direction ?? 'none');
      }
    }

    function boundControl(spec, updateState) {
      if (typeof spec.update !== 'function') throw new Error(spec.type + '.update must be a Mira function');
      if (!updateState) throw new Error(spec.type + '.update requires a state parent');
      const wrapper = doc.createElement('label');
      wrapper.className = 'mira-ui-control' + (spec.type === 'checkbox' ? ' mira-ui-check' : '');
      wrapper.append(addText('span', spec.label, 'mira-ui-label'));
      const control = doc.createElement(spec.type === 'select' ? 'select' : 'input');
      control.className = 'mira-ui-input';
      control.setAttribute('aria-label', String(spec.label ?? ''));
      if (spec.type === 'checkbox') {
        if (typeof spec.checked !== 'boolean') throw new Error('checkbox.checked must be boolean');
        control.type = 'checkbox';
        control.checked = spec.checked;
      } else if (spec.type === 'select') {
        if (!Array.isArray(spec.options) || !spec.options.every(option => typeof option === 'string') ||
            new Set(spec.options).size !== spec.options.length || spec.options.length > MAX_NODES ||
            typeof spec.value !== 'string' || !spec.options.includes(spec.value)) {
          throw new Error('select requires unique string options and a matching string value');
        }
        for (const choice of spec.options) {
          const option = addText('option', choice);
          option.value = choice;
          control.append(option);
        }
        control.value = spec.value;
      } else {
        if (typeof spec.value !== 'string') throw new Error('input.value must be a string');
        control.type = 'text';
        control.value = spec.value;
      }
      function commit(event) {
        if (event?.isComposing) return;
        try {
          const value = spec.type === 'checkbox' ? control.checked : control.value;
          updateState(old => spec.update(old, value));
        } catch (error) { report(error); }
      }
      control.addEventListener(spec.type === 'input' ? 'input' : 'change', commit);
      if (spec.type === 'input') control.addEventListener('compositionend', commit);
      wrapper.append(control);
      return wrapper;
    }

    function createNode(spec, updateState, budget, depth) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('A view must be a Mira record');
      }
      if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) {
        throw new Error('The view exceeds its size/depth limit');
      }

      switch (spec.type) {
        case 'title':
          return addText('h2', spec.text, 'mira-ui-title');
        case 'text':
          return addText('p', spec.text, 'mira-ui-text');
        case 'column':
        case 'row': {
          if (!Array.isArray(spec.children)) {
            throw new Error(spec.type + '.children must be a sequence');
          }
          const col = doc.createElement('div');
          col.className = 'mira-ui-' + spec.type;
          for (const child of spec.children) {
            col.append(createNode(child, updateState, budget, depth + 1));
          }
          return col;
        }
        case 'input':
        case 'checkbox':
        case 'select':
          return boundControl(spec, updateState);
        case 'button': {
          const button = addText('button', spec.label, 'mira-ui-button');
          button.type = 'button';
          if (spec.update !== undefined && typeof spec.update !== 'function') {
            throw new Error('button.update must be a Mira function');
          }
          if (spec.onClick !== undefined && typeof spec.onClick !== 'function') {
            throw new Error('button.onClick must be a Mira function');
          }
          button.addEventListener('click', () => {
            try {
              if (spec.update) {
                if (!updateState) throw new Error('button.update requires a state parent');
                updateState(spec.update);
              }
              if (spec.onClick) spec.onClick(null);
            } catch (error) {
              report(error);
            }
          });
          return button;
        }
        case 'state': {
          if (typeof spec.view !== 'function') {
            throw new Error('state.view must be a Mira function');
          }
          const slot = doc.createElement('section');
          slot.className = 'mira-ui-state';
          let state = spec.initial;
          function refreshState(next) {
            const saved = focusedControl(slot);
            const child = createNode(spec.view(next), update, {nodes: 0}, depth + 1);
            state = next;
            slot.replaceChildren(child);
            restoreFocus(slot, saved);
          }
          function update(transition) {
            // Commit state only after a new view has been constructed successfully.
            refreshState(transition(state));
          }
          refreshState(state);
          return slot;
        }
        default:
          throw new Error('Unsupported view type: ' + String(spec.type));
      }
    }

    uiHost.render = spec => {
      // A failed render must not expose raw HTML or modify Studio's DOM.
      const node = createNode(spec, null, {nodes: 0}, 0);
      mount.replaceChildren(node);
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

  global.MiraUiHost = Object.freeze({createUiHost});
})(globalThis);

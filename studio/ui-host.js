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
        case 'column': {
          if (!Array.isArray(spec.children)) {
            throw new Error('column.children must be a sequence');
          }
          const col = doc.createElement('div');
          col.className = 'mira-ui-column';
          for (const child of spec.children) {
            col.append(createNode(child, updateState, budget, depth + 1));
          }
          return col;
        }
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
          function refreshState() {
            slot.replaceChildren(createNode(
              spec.view(state), update, {nodes: 0}, depth + 1
            ));
          }
          function update(transition) {
            // State transition is executed in Mira; DOM host only retains the value.
            state = transition(state);
            refreshState();
          }
          refreshState();
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

// Use the existing renderer, not a second GUI runtime.
const __miraHost = Object.assign({}, MiraUiHost.createUiHost(document, document.getElementById('app'), error => {
  document.getElementById('error').textContent = String(error);
}), {log: value => console.log(value)});

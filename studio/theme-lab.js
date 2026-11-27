(function(global){
  'use strict';
  const source = "# Real Mira view; theme settings live outside the application model.\ntheme view: n = {type: \"column\", children: [\n  {type: \"title\", text: \"Mira\"},\n  {type: \"input\", label: \"Campo di testo\", value: (n ~ name), update: {old, value | {name: value, target: (old ~ target), active: (old ~ active), level: (old ~ level), count: (old ~ count)}}},\n  {type: \"select\", label: \"Menu a tendina\", value: (n ~ target), options: [\"JavaScript\", \"PHP\"], update: {old, value | {name: (old ~ name), target: value, active: (old ~ active), level: (old ~ level), count: (old ~ count)}}},\n  {type: \"switch\", label: \"Attivo\", checked: (n ~ active), update: {old, value | {name: (old ~ name), target: (old ~ target), active: value, level: (old ~ level), count: (old ~ count)}}},\n  {type: \"slider\", label: \"Livello\", value: (n ~ level), update: {old, value | {name: (old ~ name), target: (old ~ target), active: (old ~ active), level: value, count: (old ~ count)}}},\n  {type: \"row\", children: [\n    {type: \"button\", label: \"−\", update: {old | {name: (old ~ name), target: (old ~ target), active: (old ~ active), count: (old ~ count - 1)}}},\n    {type: \"text\", text: (n ~ count)},\n    {type: \"button\", label: \"+\", update: {old | {name: (old ~ name), target: (old ~ target), active: (old ~ active), count: (old ~ count + 1)}}}\n  ]},\n  {type: \"button\", label: \"Ripristina\", update: {old | {name: \"Hello, Mira!\", target: \"JavaScript\", active: true, level: 65, count: 0}}}\n]};\n";
  const initial = () => ({name:'Hello, Mira!', target:'JavaScript', active:true, level:65, count:0});
  function mount(compiler, root, report) {
    const compiled = compiler.compile(source, 'js');
    if(!compiled.ok) throw new Error(compiled.message);
    const view = new Function(compiled.output+'\nreturn theme_view;')();
    return global.MiraUiHost.createUiHost(root.ownerDocument, root, report).renderState(view, initial());
  }
  global.MiraThemeLab = Object.freeze({source, mount});
  if(!global.document) return;
  const doc = global.document, root = doc.getElementById('theme-preview');
  if(!root) return;
  const status = doc.getElementById('theme-status');
  const report = error => {status.textContent=String(error);};
  try {
    mount(global.MiraStudioCompiler, root, report);
    doc.getElementById('theme-source').textContent=source;
    for(const control of doc.querySelectorAll('[data-theme-axis]')) {
      const axis=control.dataset.themeAxis;
      const apply=()=>{root.dataset[axis]=control.value;};
      control.addEventListener('change',apply); apply();
    }
    status.textContent='View compilata e montata. Il tema cambia solo tramite CSS.';
  } catch(error) {report(error.message);}
})(globalThis);

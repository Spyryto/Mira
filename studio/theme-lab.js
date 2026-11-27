(function(global){
  'use strict';
  const source = "# Real Mira view; theme settings live outside the application model.\ntheme view: n = {type: \"column\", children: [\n  {type: \"title\", text: \"Mira\"},\n  {type: \"input\", label: \"Campo di testo\", value: (n ~ name), update: {old, value | update: old, with: {name: value}}},\n  {type: \"select\", label: \"Menu a tendina\", value: (n ~ target), options: [\"JavaScript\", \"PHP\"], update: {old, value | update: old, with: {target: value}}},\n  {type: \"checkbox\", label: \"Anteprima\", checked: (n ~ preview), update: {old, value | update: old, with: {preview: value}}},\n  {type: \"slider\", label: \"Slider\", value: (n ~ amount), update: {old, value | update: old, with: {amount: value}}},\n  {type: \"toggle\", label: \"Attivo\", checked: (n ~ active), update: {old, value | update: old, with: {active: value}}},\n  {type: \"tabs\", label: \"Sezione\", value: (n ~ tab), options: [\"Controlli\", \"Dati\", \"Opzioni\"], update: {old, value | update: old, with: {tab: value}}},\n  {type: \"stepper\", label: \"Contatore\", value: (n ~ count), update: {old, value | update: old, with: {count: value}}},\n  {type: \"led\", text: (n ~ tab)},\n  {type: \"button\", label: \"Ripristina\", update: {old | {name: \"Hello, Mira!\", target: \"JavaScript\", preview: true, amount: 65, active: true, tab: \"Controlli\", count: 0}}}\n]};\n";
  const initial = () => ({name:'Hello, Mira!', target:'JavaScript', preview:true, amount:65, active:true, tab:'Controlli', count:0});
  function mount(compiler, root, report) {
    const specializer=global.MiraGuiSpecialize;
    const plan=specializer.compileAuto(compiler,source,'theme view:');
    if(plan.mode!=='specialized') throw Error('Expected static Cozy control plan: '+plan.reason);
    return specializer.mountAuto(plan,root,initial(),report);
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
    const theme=global.MiraCozyTheme, scope=doc.getElementById('native-theme');
    const palette=doc.getElementById('native-palette'), font=doc.getElementById('native-font'),
      size=doc.getElementById('native-size'), spacing=doc.getElementById('native-spacing');
    const colors=doc.getElementById('native-colors');
    let selected=0, custom=false, p=theme.presets[0].slice(1);
    theme.presets.forEach((preset,i)=>{
      const option=doc.createElement('option');option.value=String(i);option.textContent=preset[0];palette.append(option);
    });
    const inputs=theme.labels.map((name,i)=>{
      const label=doc.createElement('label'), input=doc.createElement('input');
      input.type='color';input.value=p[i];label.append(input,name);colors.append(label);
      input.addEventListener('input',()=>{p[i]=input.value;custom=true;apply();});
      return input;
    });
    function apply(){
      theme.apply(scope,p,selected,custom);
      theme.typography(scope,font.value,+size.value,+spacing.value);
      status.textContent='View compilata e montata · '+theme.presets[selected][0]+(custom?' Custom':' Balanced')+' · '+size.value+' px / '+spacing.value+'%';
    }
    palette.addEventListener('change',()=>{selected=+palette.value;p=theme.presets[selected].slice(1);custom=false;inputs.forEach((input,i)=>input.value=p[i]);apply();});
    for(const control of [font,size,spacing])control.addEventListener('input',apply);
    apply();
  } catch(error) {report(error.message);}
})(globalThis);

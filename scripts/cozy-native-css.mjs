// Adapt the canonical Cozy CSS to the existing native DOM vocabulary.
// The canonical stylesheet uses one rule per line; fail on missing source rules.
export function nativeCozyCss(source) {
  const rule=(selector,target)=>{
    const prefix=selector+'{';
    const line=source.split('\n').find(line=>line.startsWith(prefix));
    if(!line || !line.endsWith('}')) throw Error('Missing Cozy rule: '+selector);
    // Explicit native view styles must retain their normal inline precedence.
    return target+'{'+line.slice(prefix.length,-1).replaceAll('!important','')+'}';
  };
  const pairs=[
    ['#cozy','.mira-theme'],
    ['#cozy *','.mira-theme *'],
    ['#cozy button,#cozy input,#cozy select,#cozy output','.mira-theme button,.mira-theme input,.mira-theme select,.mira-theme output'],
    ['#cozy button','.mira-theme button'],
    ['#cozy button:disabled','.mira-theme button:disabled'],
    ['#cozy :focus-visible','.mira-theme :focus-visible'],
    ['#cozy .stage','.mira-theme .stage'],
    ['#cozy .shell','.mira-theme .shell'],
    ['#cozy .panel','.mira-theme .panel'],
    ['#cozy .panel label,#cozy .panel output,#cozy .panel strong,#cozy .panel span:not(.switch),#cozy .panel pre,#cozy .panel .group','.mira-theme .panel .mira-ui-label,.mira-theme .panel .mira-ui-text,.mira-theme .panel .mira-ui-title'],
    ['#cozy .field label','.mira-theme .mira-ui-control:not(.mira-ui-check) .mira-ui-label'],
    ['#cozy .btn','.mira-theme .mira-ui-button'],
    ['#cozy .btn.primary','.mira-theme .mira-ui-button.mira-primary'],
    ['#cozy .btn:active:not(:disabled)','.mira-theme .mira-ui-button:active:not(:disabled)'],
    ['#cozy input[type=text],#cozy select','.mira-theme input.mira-ui-input[type=text],.mira-theme select.mira-ui-input'],
    ['#cozy input[type=text]','.mira-theme input.mira-ui-input[type=text]'],
    ['#cozy select','.mira-theme select.mira-ui-input'],
    ['#cozy select option','.mira-theme select.mira-ui-input option'],
    ['#cozy .check','.mira-theme input.mira-ui-input[type=checkbox]'],
    ['#cozy .check:checked','.mira-theme input.mira-ui-input[type=checkbox]:checked'],
    ['#cozy .check:checked:after','.mira-theme input.mira-ui-input[type=checkbox]:checked:after']
  ];
  const internal=rule('#cozy .stepper .btn','.unused').match(/box-shadow:[^;}]+/)[0];
  return '/* Generated from mira-theme.css; do not edit. */\n'+pairs.map(([a,b])=>rule(a,b)).join('\n')+
    '\n.mira-theme .panel .mira-ui-button:not(:active){'+internal+'}'+
    '\n.mira-theme{font-size:var(--size);letter-spacing:var(--spacing);color:var(--pInk)}'+
    '\n.mira-theme .mira-ui-state{display:block}'+
    '\n.mira-theme .mira-ui-column,.mira-theme .mira-ui-grid{display:grid;gap:17px}'+
    '\n.mira-theme .mira-ui-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px}'+
    '\n.mira-theme .mira-ui-control{display:grid;gap:6px;min-width:0}'+
    '\n.mira-theme .mira-ui-check{display:flex;align-items:center;gap:7px}'+
    '\n.mira-theme .mira-ui-check input{order:-1}'+
    '\n.mira-theme .mira-ui-title,.mira-theme .mira-ui-text{margin:0;overflow-wrap:anywhere}'+
    '\n.mira-theme .mira-ui-dialog{background:var(--panel);color:var(--pInk);border:1px solid var(--edge);border-radius:13px;padding:15px;max-width:calc(100% - 24px)}'+
    '\n.mira-theme .mira-ui-dialog::backdrop{background:#0008}'+
    '\n@media(max-width:520px){.mira-theme .panel{padding:15px 12px}}\n';
}

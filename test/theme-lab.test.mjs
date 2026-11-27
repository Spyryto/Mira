import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../dist/studio/'+name,import.meta.url),'utf8');
test('theme lab uses real Mira compiler and existing native descriptors',()=>{
  const context={};
  runInNewContext(read('compiler.js'),context);
  runInNewContext(read('theme-lab.js'),context);
  const compiled=context.MiraStudioCompiler.compile(context.MiraThemeLab.source,'js');
  assert.equal(compiled.ok,true,compiled.message);
  const view=runInNewContext(compiled.output+'\ntheme_view',context);
  const model={name:'Hello, Mira!',target:'JavaScript',preview:true,amount:65,active:true,tab:'Controlli',count:0};
  const children=view(model).children;
  assert.equal(children[1].update(model,'New').name,'New');
  assert.equal(children[2].update(model,'PHP').target,'PHP');
  assert.equal(children[3].update(model,false).preview,false);
  assert.equal(children[4].update(model,38).amount,38);
  assert.equal(children[5].update(model,false).active,false);
  assert.equal(children[6].update(model,'Dati').tab,'Dati');
  assert.equal(children[7].update(model,1).count,1);
  assert.equal(children[8].text,'Controlli');
  assert.equal(children[9].update({...model,count:9}).count,0);
});
test('canonical theme and generated native adapter are published and cached',()=>{
  const css=read('mira-theme.css'),native=read('mira-native-theme.css'),html=read('theme-native-lab.html'),sw=read('sw.js');
  for(const file of ['theme-lab.html','theme-native-lab.html','theme-lab.js','mira-theme.css','mira-native-theme.css','cozy-palette.js'])assert.ok(sw.includes("'./"+file+"'"));
  assert.ok(read('index.html').includes('./theme-lab.html'));
  assert.ok(html.includes('./mira-native-theme.css'));
  const body=(sheet,selector)=>sheet.split('\n').find(line=>line.startsWith(selector+'{')).split('{')[1].slice(0,-1).replaceAll('!important','');
  for(const [a,b] of [['#cozy .btn','.mira-theme .mira-ui-button'],['#cozy input[type=text]','.mira-theme input.mira-ui-input[type=text]'],['#cozy select','.mira-theme select.mira-ui-input'],['#cozy .check','.mira-theme input.mira-ui-input[type=checkbox]'],['#cozy .panel','.mira-theme .panel']])assert.equal(body(css,a),body(native,b));
});
test('shared palette derivation retains presets, contrast and independent typography',()=>{
  const context={};runInNewContext(read('cozy-palette.js'),context);
  const theme=context.MiraCozyTheme;
  assert.equal(theme.presets.length,12);
  const values={};const root={style:{setProperty:(k,v)=>values[k]=v}};
  for(let i=0;i<12;i++){
    const p=theme.presets[i].slice(1),result=theme.derive(p,i);
    assert.equal(result.variables.accent,p[3]);
    assert.equal(result.report.length,6);
    assert.ok(result.report.every(x=>Number.isFinite(x.ratio)));
    theme.apply(root,p,i);
    assert.equal(values['--accent'],p[3]);
  }
  assert.equal(theme.derive(theme.presets[0].slice(1)).variables.aTop,'#bac1f0');
  assert.equal(theme.derive(theme.presets[0].slice(1)).variables.knobEdge,'#d2b8c9');
  const p=theme.presets[0].slice(1);p[3]='#123456';
  assert.equal(theme.derive(p,0,true).variables.accent,'#123456');
  theme.typography(root,'cozy',16,5);assert.equal(values['--size'],'16px');assert.equal(values['--spacing'],'0.05em');
});
test('Cozy Edition is the main Theme Lab and retains the approved defaults',()=>{
  const html=read('theme-lab.html'),sw=read('sw.js');
  assert.ok(html.includes('./theme-native-lab.html'));
  assert.ok(sw.includes("endsWith('/theme-native-lab.html') ? './theme-native-lab.html'"));
  assert.ok(read('mira-theme.css').includes('--spacing:.05em;--size:16px'));
  assert.ok(html.includes('./mira-theme.css'));
  assert.ok(html.includes('./cozy-palette.js'));
  assert.match(html,/id="czSize"[^>]*value="16"/);
  assert.match(html,/id="czSpacing"[^>]*value="5"/);
  const script=html.split('<script>')[1].split('</script>')[0];
  assert.doesNotThrow(()=>new Function(script));
  assert.ok(script.includes('q("Size").value=16;q("Spacing").value=5'));
  assert.ok(script.includes('outer:74,inner:0,inset:29,toggle:64,grain:0'));
  for(const palette of ['Prisma','Acqua','Cristallo','Ambra','Salvia','Corallo','Avorio','Laguna','Orchidea','Notturno','Grafite','Bosco']){
    assert.ok(read('cozy-palette.js').includes('["'+palette+'",'));
  }
  assert.ok(script.includes('[0,9,10,1,2,3,4,5,6,7,8,11].map'));
  assert.ok(script.includes('data-color='));
  assert.ok(script.includes('function apply()'));
});

test('browser: native widget styles agree with Cozy and palette changes keep real Mira nodes', t=>{
  const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)
    .find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
  if(!chrome){if(process.env.CI)assert.fail('Chromium required for theme regression in CI');t.skip('Chromium not available locally');return;}
  const folder=mkdtempSync(join(tmpdir(),'mira-cozy-'));
  try{
    const reference=new URL('../dist/studio/theme-lab.html',import.meta.url).href;
    const native=new URL('../dist/studio/theme-native-lab.html',import.meta.url).href;
    const page=join(folder,'test.html');
    writeFileSync(page,`<!doctype html><meta charset="utf-8"><body><pre id="result">PENDING</pre><script>
    const load=url=>new Promise(resolve=>{const frame=document.createElement('iframe');frame.style.width='650px';frame.style.height='900px';frame.onload=()=>resolve(frame);frame.src=url;document.body.append(frame)});
    const equal=(a,b,label)=>{if(a!==b)throw Error(label+': '+a+' != '+b)};
    const check=(a,b,props,label)=>{for(const p of props)equal(a.ownerDocument.defaultView.getComputedStyle(a)[p],b.ownerDocument.defaultView.getComputedStyle(b)[p],label+' '+p)};
    (async()=>{
      const [ref,native]=await Promise.all([load(${JSON.stringify(reference)}),load(${JSON.stringify(native)})]);
      const r=ref.contentDocument,n=native.contentDocument, q=s=>n.querySelector(s);
      const root=q('#theme-preview'), field=q('input.mira-ui-input[type=text]'), select=q('select.mira-ui-input'), checkbox=q('input.mira-ui-input[type=checkbox]');
      if(!field||!select||!checkbox)throw Error('Compiled Mira view did not mount: '+q('#theme-status').textContent);
      const selection=q('#native-palette');
      equal(selection.options.length,12,'palette count');
      field.value='Native state';field.dispatchEvent(new native.contentWindow.Event('input',{bubbles:true}));
      q('.mira-ui-stepper button:last-child').click();
      equal(q('.mira-ui-stepper strong').textContent,'1','native counter');
      const slider=q('.mira-ui-slider-input'),toggle=q('.mira-ui-toggle-input'),tabs=q('.mira-ui-tabs'),stepper=q('.mira-ui-stepper'),led=q('.mira-ui-led');
      slider.value='38';slider.dispatchEvent(new native.contentWindow.Event('input',{bubbles:true}));
      equal(q('.mira-ui-slider-value').textContent,'38%','slider update');
      r.querySelector('#czRange').value='38';r.querySelector('#czRange').dispatchEvent(new ref.contentWindow.Event('input',{bubbles:true}));
      toggle.click();equal(toggle.checked,false,'toggle update');r.querySelector('#czActive').click();
      tabs.children[1].click();equal(led.textContent,'Dati','tab and LED update');
      r.querySelector('[data-tab=data]').setAttribute('aria-selected','true');r.querySelector('[data-tab=controls]').setAttribute('aria-selected','false');
      const props=['backgroundImage','boxShadow','borderColor','borderRadius','color','fontFamily','fontSize','letterSpacing','height'];
      for(let i=0;i<12;i++){
        r.querySelector('[data-preset="'+i+'"]').click();selection.value=String(i);selection.dispatchEvent(new native.contentWindow.Event('change',{bubbles:true}));
        equal(q('input.mira-ui-input[type=text]'),field,'field identity');
        equal(field.value,'Native state','field state');
        equal(q('.mira-ui-stepper strong').textContent,'1','counter state');
        check(r.querySelector('#czText'),field,props,'text box '+i);
        check(r.querySelector('#czTarget'),select,props,'select '+i);
        check(r.querySelector('#czPreview'),checkbox,props,'checkbox '+i);
        check(r.querySelector('#cozy .panel'),root,['backgroundImage','boxShadow','borderColor','borderRadius'],'panel '+i);
        check(r.querySelector('label[for=czText]'),q('.mira-ui-label'),['color','fontFamily','fontSize','letterSpacing','fontWeight'],'label '+i);
        check(r.querySelector('[data-act=minus]'),q('.mira-ui-stepper button'),['backgroundImage','boxShadow','borderColor','color','height'],'button '+i);
        check(r.querySelector('#czRange'),slider,['backgroundImage','boxShadow','borderColor','borderRadius','height'],'slider '+i);
        check(r.querySelector('.switch i'),q('.mira-ui-switch i'),['backgroundImage','boxShadow','borderColor','borderRadius'],'toggle '+i);
        check(r.querySelector('[data-tab=data]'),tabs.children[1],['backgroundImage','boxShadow','borderColor','color','height'],'tabs '+i);
        check(r.querySelector('.stepper'),stepper,['backgroundColor','boxShadow','borderColor','borderRadius'],'stepper '+i);
        for(const key of ['backgroundImage','boxShadow','borderColor','borderRadius','width','height']){
          equal(ref.contentWindow.getComputedStyle(r.querySelector('.led'))[key],native.contentWindow.getComputedStyle(led,'::before')[key],'LED '+i+' '+key);
        }
        equal(q('.mira-ui-slider-input'),slider,'slider identity');
        equal(q('.mira-ui-toggle-input'),toggle,'toggle identity');
        equal(q('.mira-ui-tabs'),tabs,'tabs identity');
        equal(q('.mira-ui-stepper'),stepper,'stepper identity');
        equal(toggle.checked,false,'toggle state');
        equal(slider.value,'38','slider state');
        equal(led.textContent,'Dati','LED state');
      }
      const size=q('#native-size');size.value='18';size.dispatchEvent(new native.contentWindow.Event('input',{bubbles:true}));
      equal(native.contentWindow.getComputedStyle(field).fontSize,'18px','font config');
      equal(q('input.mira-ui-input[type=text]'),field,'font preserves node');
      const color=q('#native-colors input');color.value='#123456';color.dispatchEvent(new native.contentWindow.Event('input',{bubbles:true}));
      equal(q('#native-theme').style.getPropertyValue('--top'),'#123456','custom color');
      q('.mira-ui-column > button:last-child').click();equal(field.value,'Hello, Mira!','native reset');
      document.querySelector('#result').textContent='MIRA_COZY_PASS';
    })().catch(e=>document.querySelector('#result').textContent='FAIL: '+e.message);
    </script></body>`);
    const run=spawnSync(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--allow-file-access-from-files','--user-data-dir='+join(folder,'profile'),'--virtual-time-budget=10000','--dump-dom',pathToFileURL(page).href],{encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
    assert.equal(run.status,0,run.error?.message||run.stderr);
    assert.match(run.stdout,/<pre id="result">MIRA_COZY_PASS<\/pre>/,run.stdout.match(/<pre id="result">[^<]*/)?.[0]||run.stdout.slice(0,500));
  }finally{rmSync(folder,{recursive:true,force:true});}
});

import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startDesktop} from './studio-desktop.mjs';

function chooseFolder(){
 const script=[
  '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
  'Add-Type -AssemblyName System.Windows.Forms',
  '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
  '$dialog.Description = "Scegli o crea la cartella del progetto Mira"',
  '$dialog.ShowNewFolderButton = $true',
  'try { if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($dialog.SelectedPath) } } finally { $dialog.Dispose() }'
 ].join('; ');
 const result=spawnSync('powershell.exe',['-NoProfile','-STA','-Command',script],{encoding:'utf8',windowsHide:true});
 if(result.error||result.status!==0)throw Error(result.stderr||result.error?.message||'Selettore cartella non disponibile.');
 return result.stdout.trim();
}
try{
 const args=process.argv.slice(2),noBrowser=args.includes('--no-browser');
 const paths=args.filter(a=>a!=='--no-browser');
 if(paths.length>1)throw Error('Indica una sola cartella del progetto.');
 const root=paths[0]||chooseFolder();
 if(root){
  const site=fileURLToPath(new URL('./dist/studio/',import.meta.url));
  const host=await startDesktop(root,site);
  console.log('Mira Studio Desktop\n'+host.url+'\nLascia aperta questa finestra. Ctrl+C per terminare.');
  if(!noBrowser){
   const browser=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command','Start-Process $env:MIRA_STUDIO_URL'],{env:{...process.env,MIRA_STUDIO_URL:host.url},stdio:'ignore',windowsHide:true});
   browser.on('error',()=>console.error('Apri manualmente il link qui sopra.'));
   browser.on('exit',code=>{if(code)console.error('Apri manualmente il link qui sopra.');});
  }
 }
}catch(error){console.error('Mira Studio: '+error.message);process.exitCode=1;}

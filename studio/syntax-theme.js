export const syntaxPalettes=Object.freeze({"notturno":["#1b293b","#e2edf6","#8496ac","#a9dba8","#9ecbfa","#dcc0ed","#dcc29a","#a6b6c9","#c5b3ff","#f4a9c3","#adc8d9","#a8c9d8","#233548","#526e83"],"prisma":["#f9edf1","#39334e","#65508c","#286747","#245f94","#923c70","#9a4b25","#59617b","#794397","#a04478","#5d526e","#35667b","#eee2ec","#bca8c4"],"grafite":["#292f3a","#e6ebf2","#a5afbd","#b9d6ac","#a6c9f4","#f0be85","#f1b7a6","#b8c2d1","#d6baf7","#f1d08b","#bac8d7","#9fcad0","#343b47","#626e7d"],"ambra":["#fff4df","#463322","#78644b","#36643b","#285b8e","#8d3e53","#99491d","#695a47","#744780","#8c4567","#645444","#35636b","#f2e3c8","#bba384"],"bosco":["#233c34","#e6f2e8","#a4bcb0","#c4e2a6","#9bd8e5","#e6b7db","#efc18c","#afc5b9","#c9bcf2","#f4b6a6","#b8d0c4","#9ed5d4","#304b40","#607c6d"]});
export const syntaxKeys=Object.freeze(["bg","plain","comment","string","number","selector","operator","punctuation","keyword","placeholder","parameter","field","gutter","edge"]);
const fonts=[["jetbrains","JetBrains Mono"],["fira","Fira Mono"],["dejavu","DejaVu Sans Mono"],["cascadia","Cascadia Code"]];
export function mountSyntaxSettings(root=document,storage=globalThis.localStorage){
  const html=root.documentElement;
  const read=(key,fallback)=>{try{return storage?.getItem(key)||fallback}catch{return fallback}};
  const save=(key,value)=>{try{storage?.setItem(key,value)}catch{}};
  const palette=root.getElementById('syntaxPalette'),font=root.getElementById('syntaxFont');
  const chosen=read('mira:syntax-palette','notturno'),face=read('mira:syntax-font','jetbrains');
  html.dataset.miraSyntax=Object.hasOwn(syntaxPalettes,chosen)?chosen:'notturno';
  html.dataset.miraCodeFont=fonts.some(f=>f[0]===face)?face:'jetbrains';
  if(palette){palette.value=html.dataset.miraSyntax;palette.addEventListener('change',()=>{if(Object.hasOwn(syntaxPalettes,palette.value)){html.dataset.miraSyntax=palette.value;save('mira:syntax-palette',palette.value)}});}
  if(font){font.value=html.dataset.miraCodeFont;font.addEventListener('change',()=>{if(fonts.some(f=>f[0]===font.value)){html.dataset.miraCodeFont=font.value;save('mira:syntax-font',font.value)}});}
}

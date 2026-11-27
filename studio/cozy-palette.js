(function(global){
'use strict';
const presets=[
["Prisma","#f5dee7","#b9bde5","#fae9e5","#969dd5","#f3e3e3"],
["Acqua","#e1f3ff","#98c8eb","#f0f7fc","#4da4d7","#e1edf5"],
["Cristallo","#d4f5fa","#c4c3ef","#edf8fc","#60bcd9","#e1ebfa"],
["Ambra","#fae6c5","#d9b47e","#fff0d8","#cc914c","#f4dfbe"],
["Salvia","#e4ebd6","#a9c7b2","#f4f6e9","#73a58c","#e3ebdb"],
["Corallo","#ffe5dc","#e7b2ae","#fff1e7","#cc817d","#f6e1d8"],
["Avorio","#fbf3e0","#d9cbb5","#fffaf0","#a99c80","#f4ecdb"],
["Laguna","#d2f0e6","#7bbdb9","#e8f7f1","#3e9d9c","#d7ebe5"],
["Orchidea","#f4dcef","#c4acd7","#fff0f8","#af83b9","#eddfec"],
["Notturno","#34485f","#1b293d","#25384a","#79d5c5","#3b5065"],
["Grafite","#525c6b","#252c38","#323a47","#f0b879","#47515e"],
["Bosco","#455c51","#213b35","#2f493e","#b2d6a1","#4b6456"]];
const keys=["top","bottom","panel","accent","neutral"],labels=["Superficie superiore","Superficie inferiore","Pannello","Colore attivo","Pulsanti neutri"];
const fonts={cozy:'ui-rounded,"Nunito","Ubuntu Sans","Avenir Next",sans-serif',human:'"Ubuntu Sans",Ubuntu,"Avenir Next","Trebuchet MS",sans-serif',system:'system-ui,sans-serif'};
const rgb=c=>c.slice(1).match(/../g).map(v=>parseInt(v,16));
const mix=(a,b,t)=>"#"+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,"0")).join("");
const L=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(L(a),L(b))+.05)/(Math.min(L(a),L(b))+.05);
const best=bg=>{const choices=["#39334e","#f5f7fa","#111018","#ffffff"];return choices.map(c=>[c,Math.min(...bg.map(b=>contrast(c,b)))]).sort((a,b)=>b[1]-a[1]).find(([c,n])=>n>=7)||choices.map(c=>[c,Math.min(...bg.map(b=>contrast(c,b)))]).sort((a,b)=>b[1]-a[1])[0]};
const lighten=(c,t)=>mix(c,"#ffffff",t),darken=(c,t)=>mix(c,"#171625",t);
const rgba=(c,a)=>`rgba(${rgb(c).join(",")},${a})`;

function derive(p,selected=0,custom=false){
const [top,bottom,panel,accent,neutral]=p,dark=L(panel)<.25;
const v={top,bottom,panel,accent,neutral,aTop:lighten(accent,.32),aBottom:darken(accent,.16),nTop:lighten(neutral,dark?.13:.47),nBottom:darken(neutral,.095),pLight:lighten(panel,dark?.045:.45),pBottom:darken(panel,.055),well:darken(panel,dark?.30:.105),track:darken(mix(panel,accent,.25),dark?.40:.12),tabTop:mix(accent,panel,.55),tabBottom:mix(accent,panel,.25),edge:dark?lighten(panel,.25):darken(mix(panel,bottom,.35),.25),light:dark?"#ffffff40":"#ffffffd6",shadow:rgba(darken(bottom,.58),dark?.75:.42),contact:rgba(darken(bottom,.58),dark?.40:.20),knob:dark?"#eef5f7":lighten(neutral,.68)};
v.knobEdge=darken(v.knob,.12);
if(!custom&&selected===0)Object.assign(v,{aTop:"#bac1f0",aBottom:"#8189c3",nTop:"#fbefea",nBottom:"#e3ccd5",pLight:"#fff3ed",pBottom:"#f1dfe4",well:"#e6d7db",track:"#d6c4df",tabTop:"#e0dffa",tabBottom:"#b5b9e8",edge:"#bca8bb",shadow:"#71556c65",contact:"#71556c30",knob:"#fff9f1",knobEdge:"#d2b8c9"});
const groups=[["ink","Intestazione e stato",[top,bottom]],["pInk","Etichette, slider e valori",[panel,v.pLight,v.pBottom]],["bInk","Pulsanti neutri",[v.nTop,neutral,v.nBottom]],["aInk","Pulsante principale",[v.aTop,accent,v.aBottom]],["tabInk","Tab selezionato",[v.tabTop,v.tabBottom]],["wellInk","Campi e contatore",[v.well,panel]]];

const report=groups.map(([k,label,bg])=>{const [c,n]=best(bg);v[k]=c;return {key:k,label,ratio:n};});
v.textShadow=L(v.aInk)>.5?"0 1px 2px #0008":"0 1px 0 #ffffff40";

return {variables:v,report};
}
function apply(root,p,selected=0,custom=false){
const result=derive(p,selected,custom);
Object.entries(result.variables).forEach(([k,val])=>root.style.setProperty("--"+k,val));
return result.report;
}
function typography(root,font,size,spacing){
root.style.fontFamily=fonts[font];
root.style.setProperty("--size",size+"px");
root.style.setProperty("--spacing",spacing/100+"em");
}
global.MiraCozyTheme=Object.freeze({presets:Object.freeze(presets.map(Object.freeze)),keys:Object.freeze(keys),labels:Object.freeze(labels),fonts:Object.freeze(fonts),derive,apply,typography});
})(globalThis);

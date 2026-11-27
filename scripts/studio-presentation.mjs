// Presentation adapters for the legacy lab documents. Explicit language tags
// keep diagnostic prose and benchmark result tables out of syntax highlighting.
const sources={
  'index.html':{code:{},edit:{inspectorProgram:'mira'}},
  'grammar-lab.html':{code:{library:'mira',output:'js'},edit:{source:'mira'}},
  'type-lab.html':{edit:{source:'mira',host:'json',modules:'json'}},
  'host-module-lab.html':{code:{bindings:'json'},edit:{source:'mira',contract:'mira',native:'mira',pure:'mira',host:'json','text-source':'mira','json-source':'mira','date-source':'mira','storage-source':'mira','http-source':'mira'}},
  'module-explorer.html':{code:{'interface-json':'json'},edit:{source:'mira',modules:'json',host:'json',bindings:'json',contract:'mira'}},
  'theme-native-lab.html':{code:{'theme-source':'mira'}},
  'theme-lab.html':{code:{czData:'json',czSaved:'json'}},
  'projection-lab.html':{code:{'projection-export':'mira'}},
  'lesson-import.html':{code:{source:'mira',schema:'json',js:'js',php:'php'},edit:{raw:'json'}},
  'gui-benchmark.html':{code:{'form-source':'mira','hybrid-source':'mira'}},
};
export function decorateStudioHtml(filename,html){
  const config=sources[filename]||{};
  for(const [tag,items] of [['pre',config.code||{}],['textarea',config.edit||{}]]){
    html=html.replace(new RegExp('<'+tag+'\\b[^>]*>','gi'),opening=>{
      const id=opening.match(/\bid=["']([^"']+)["']/)?.[1];
      const language=items[id];
      return language?opening.slice(0,-1)+' data-code-language="'+language+'">':opening;
    });
  }
  if(filename==='index.html'){
    html=html.replace(/<code>(add(?::| )[^<]+)<\/code>/g,'<code data-code-language="mira">$1</code>');
  }
  // Append the common surface styles after each lab's own layout rules.
  if(!['index.html','theme-lab.html','theme-native-lab.html','ui-preview.html'].includes(filename)){
    if(!/href=["'](?:\.\/)?styles\.css["']/.test(html))
      html=html.replace('</head>','<link rel="stylesheet" href="./styles.css"></head>');
    html=html.replace('</head>','<link rel="stylesheet" href="./cozy-labs.css"></head>');
  }
  if(!html.includes('data-code-language='))return html;
  // Theme demo pages without the Studio CSS need only its syntax rules.
  if(!/href=["'](?:\.\/)?styles\.css["']/.test(html))
    html=html.replace('</head>','<link rel="stylesheet" href="./lab-highlight.css"></head>');
  return html.replace('</body>','<script type="module" src="./lab-highlight.js"></script></body>');
}

'use strict';
// C branch-only materialization. Keep the approved delta and exact baseline for reproducibility.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const builder=require('../sengoku/v2/candidate-delta-20261128.js'),core=require('../sengoku-v2-core.js');
const basePath='sengoku/v2/approved-c-20261126-new4.json',deltaPath='sengoku/v2/c-20261128-approved-delta.json',outPath='sengoku/v2/approved-c-20261128-cv3-94.json';
const base=JSON.parse(read(basePath)),delta=JSON.parse(read(deltaPath)),registry=JSON.parse(read('data/title-registry.json'));
const doc=builder.apply(base,delta,sha),idx=core.validate(doc,new Set(registry.areas.map(a=>a.code)),sha);
const presentation=builder.presentation(require('../sengoku/v2/related-site-presentation-cv3.js'));
core.withRelatedSitePresentation(idx,presentation);
assert.deepEqual([idx.people.size,idx.histories.size,idx.sites.size,[...idx.sites.values()].filter(s=>s.publicPin).length],[94,1682,594,556]);
const serialized=JSON.stringify(doc,null,2)+'\n';fs.writeFileSync(outPath,serialized);
assert.deepEqual(JSON.parse(read(outPath)),doc);
const before="  const [r,areas,patch]=await Promise.all([\n   fetch('./"+basePath+"',{cache:'no-store'}),\n   fetch('./data/title-registry.json',{cache:'no-cache'}),\n   fetch('./"+deltaPath+"',{cache:'no-store'})\n  ]);\n  if(!r.ok||!areas.ok||!patch.ok)throw Error('承認済み戦国v2のデータを読み込めません');\n  const base=await r.json(),registry=await areas.json(),delta=await patch.json();\n  const doc=SengokuCandidateDelta.apply(base,delta,PublicationRuntime.sha256);";
const after="  const [r,areas]=await Promise.all([\n   fetch('./"+outPath+"',{cache:'no-store'}),\n   fetch('./data/title-registry.json',{cache:'no-cache'})\n  ]);\n  if(!r.ok||!areas.ok)throw Error('承認済み戦国v2のデータを読み込めません');\n  const doc=await r.json(),registry=await areas.json();\n  if(doc.version!==SengokuCandidateDelta.VERSION||PublicationRuntime.sha256(JSON.stringify(doc))!=='"+sha(JSON.stringify(doc))+"')throw Error('C候補の統合版・ハッシュが一致しません');";
const html=read('index.html');
if(html.includes(before)){assert.equal(html.split(before).length,2);fs.writeFileSync('index.html',html.replace(before,after));}
else assert(html.includes(after),'unexpected index loader; stop rather than guess');
assert(read('index.html').includes("fetch('./"+outPath+"'"));
console.log('C_V13_MATERIALIZED',JSON.stringify({version:doc.version,people:idx.people.size,histories:idx.histories.size,sites:idx.sites.size,pins:[...idx.sites.values()].filter(s=>s.publicPin).length,sha256:sha(serialized)}));

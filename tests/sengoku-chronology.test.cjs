const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const non=read('sengoku/non-place-history.json').entries;
const provisional=read('sengoku/provisional-history.json').entries;
const hints=read('sengoku/chronology-hints.json').entries;
const baseCards=read('sengoku/cards.json');
const sites=read('sengoku/sites.json');
const pkg=read('publication-import/releases/20261102-line-c/package.json');
const patched=(list,file)=>{
 const map=new Map(list.map(x=>[x.id,x]));
 for(const op of pkg.operations.filter(x=>x.file===file)){if(op.after)map.set(op.id,op.after);else map.delete(op.id);}
 return [...map.values()];
};
const cards=patched(baseCards,'sengoku/cards.json'),siteMap=new Map(patched(sites,'sengoku/sites.json').map(x=>[x.id,x]));
const eligible=cards.filter(c=>c.verification==='reviewed'&&siteMap.get(c.siteId)?.verification==='reviewed'&&siteMap.get(c.siteId)?.boundaryAudit!=='unresolved_polygon_mismatch'&&siteMap.get(c.siteId)?.catalogEligibility!=='exclude_pending_evidence');
const hintById=new Map(hints.map(x=>[x.id,x]));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=html.split('<script>').at(-1).split('</script>')[0];
test('inline app code remains valid JavaScript',()=>{new vm.Script(inline)});
test('all 130 non-location and provisional undated histories have sourced-order hints',()=>{
 assert.equal(non.length,306);assert.equal(provisional.length,512);
 const undated=[...non,...provisional].filter(x=>x.eventYear===null);
 assert.equal(undated.length,130);assert.equal(new Set(hints.map(x=>x.id)).size,hints.length);
 for(const row of undated)assert.ok(hintById.has(row.id),row.id);
});
test('all 30 undated reviewed cards have hints without changing card acquisition',()=>{
 assert.equal(eligible.length,250);
 const undated=eligible.filter(c=>c.eventYear===null);assert.equal(undated.length,30);
 for(const card of undated)assert.ok(hintById.has(card.id),card.id);
});
test('uncertain historical dates remain labels, not silently authoritative event years',()=>{
 assert.equal(hints.length,160);
 const allowed=new Set(['life','posthumous','context']);
 for(const x of hints){assert.ok(Number.isInteger(x.sortYear));assert.ok(allowed.has(x.section));assert.ok(x.label.length>0);}
 for(const x of [...non,...provisional].filter(x=>x.eventYear===null))assert.equal(x.eventYear,null);
});
test('reader uses chronology hints only for ordering and preserves unknown-card locks',()=>{
 const start=inline.indexOf('function sengokuTimelineMeta(row){'),end=inline.indexOf('function showSengokuPerson(person){');
 assert.ok(start>=0&&end>start);
 const api=vm.runInNewContext(inline.slice(start,end)+'\n({sengokuTimelineMeta,sortSengokuTimeline})',{sengokuChronologyHints:hintById});
 const id='sg-a7bb09927601';
 const rows=[...non,...provisional].filter(e=>e.personId===id).map(e=>({id:e.id,kind:'text',entry:e}));
 for(const row of rows)row.timeline=api.sengokuTimelineMeta(row);
 const sorted=rows.filter(x=>x.timeline.section==='life').sort(api.sortSengokuTimeline);
 for(let i=1;i<sorted.length;i++)assert.ok((sorted[i-1].timeline.year??Infinity)<=(sorted[i].timeline.year??Infinity));
 assert.ok(inline.includes("else content.textContent='🔒 未発見の足跡'"));
 assert.ok(inline.includes('const acquiredPerson=countOwned(person.id)>0'));
 assert.ok(inline.includes('const groups=['));
 assert.ok(!inline.includes('年が未確認の経歴は末尾にまとめます'));
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../sengoku-v2-core.js');
const View=require('../sengoku-pin-display.js');
const approved=require('../sengoku-pin-approved-v2.js');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../sengoku/v2/approved-pin-display-20261122-v2.json'),'utf8'));
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const pins=original.sites.filter(s=>s.publicPin),byId=new Map(pins.map(s=>[s.siteId,s]));
class FakeNode{
 constructor(tag,content=''){this.tagName=tag;this.own=content;this.children=[];this.className=''}
 set textContent(s){this.own=String(s);this.children=[]}
 get textContent(){return this.own+this.children.map(x=>x.textContent).join('')}
 append(...x){this.children.push(...x)}
 getElements(tag){return this.children.filter(x=>x.tagName===tag).concat(...this.children.flatMap(x=>x.getElements(tag)))}
}
const document={createElement:tag=>new FakeNode(tag),createTextNode:text=>new FakeNode('#text',text)};
test('C: user approved exactly 16 fully structured v2 sites; both publication fixtures are byte-equivalent objects',()=>{
 assert.equal(manifest.schemaVersion,'walked.sengoku.pin-display.v2.approved');
 assert.equal(manifest.count,16);
 assert.deepEqual(approved,manifest.entries);
 assert.equal(Object.keys(approved).length,16);
 assert.equal(manifest.sourceApprovalRows,'3686:3701');
 assert.deepEqual(Object.values(approved).map(x=>x.approval.sheetRow).sort((a,b)=>a-b),Array.from({length:16},(_,i)=>3686+i));
 assert.ok(Object.values(approved).every(x=>x.approval.user==='公開OK'&&x.approval.bReview==='B合格'&&x.approval.sourceMatch==='一致'));
});
test('C: approved 16 render distinct site history, B/⑥ notes, official guide, CODH credit, colors and no internal management',()=>{
 assert.equal(pins.length,419);
 const counts={green:0,yellow:0,red:0};
 for(const entry of Object.values(approved)){
  const site=byId.get(entry.siteId);
  assert.ok(site,'missing published pin '+entry.siteId);
  assert.equal(site.pinReview.sourceSheetRow,entry.positionSourceSheetRow);
  assert.deepEqual(site.point,entry.expectedPoint);
  const r=View.approvedDisplay(site,approved);
  assert.equal(r,entry,entry.siteId);
  counts[r.accessStatus]++;
  const node=View.makePopup(site,Core,document,approved);
  const text=node.textContent, links=node.getElements('a');
  assert.ok(text.includes(site.name));
  assert.ok(text.includes(r.historyText),'latest ⑥ history missing '+entry.siteId);
  assert.ok(text.includes(r.notice),'B-review note missing '+entry.siteId);
  assert.ok(text.includes(r.attributions[0].label),'CODH credit missing '+entry.siteId);
  assert.ok(text.includes('CC BY 4.0'),'CC attribution missing '+entry.siteId);
  assert.ok(text.includes('情報確認日：')&&text.includes(r.checkedAt));
  assert.ok(text.includes(View.labels[r.accessStatus]));
  assert.equal(text.includes('【③史跡!'),false,'management ③ visible '+entry.siteId);
  assert.equal(text.includes('【④経歴と史跡の関係】'),false);
  assert.equal(text.includes('【管理用・非表示'),false);
  assert.equal(text.includes('100m接近による獲得判定'),false);
  assert.equal(text.includes('立入制限：'),false,'legacy restriction visible '+entry.siteId);
  assert.equal(links.length,r.attributions.length+(r.officialInfoUrl?1:0));
  assert.ok(links.every(x=>View.safeUrl(x.href)&&x.target==='_blank'&&x.rel==='noopener noreferrer'));
  assert.deepEqual(links.map(x=>x.href),[...(r.officialInfoUrl?[r.officialInfoUrl]:[]),...r.attributions.map(a=>a.url)]);
  assert.equal(View.statusFor(site,approved),r.accessStatus);
 }
 assert.deepEqual(counts,{green:4,yellow:7,red:5});
});
test('C: 403 unapproved sites keep their existing validated original restriction, guide and attributions',()=>{
 const before=JSON.stringify(original);
 const legacy=pins.filter(s=>!approved[s.siteId]);assert.equal(legacy.length,403);
 for(const site of legacy){
  assert.equal(View.approvedDisplay(site,approved),null);
  const p=View.makePopup(site,Core,document,approved),t=p.textContent;
  assert.ok(t.includes(site.name));
  assert.ok(t.includes(site.description),'existing approved historical text missing '+site.siteId);
  assert.ok(t.includes(site.pinReview.restriction),'published legacy restrictions lost '+site.siteId);
  assert.equal(View.statusFor(site,approved),site.pinReview.accessStatus);
  if(site.pinReview.officialInfoUrl)
   assert.ok(p.getElements('a').some(x=>x.href===site.pinReview.officialInfoUrl),'published link lost '+site.siteId);
 }
 assert.equal(JSON.stringify(original),before,'publication JSON mutated');
});
test('C: only B+⑥-approved toramaru site changes red to yellow; all other 418 colors unchanged',()=>{
 const changed=pins.filter(s=>View.statusFor(s,approved)!==s.pinReview.accessStatus);
 assert.deepEqual(changed.map(x=>x.siteId),['sg2site-new9-sweep-sogo-toramaru-20261120']);
 assert.equal(changed[0].pinReview.accessStatus,'red');
 assert.equal(View.statusFor(changed[0],approved),'yellow');
 const approve=approved[changed[0].siteId];
 assert.equal(approve.approval.sheetRow,3692);assert.equal(approve.approval.user,'公開OK');
 assert.equal(View.makePopup(changed[0],Core,document,approved).textContent.includes('黄（注意あり）'),true);
 assert.ok(pins.filter(s=>View.statusFor(s,approved)==='red').every(s=>View.makePopup(s,Core,document,approved).textContent.includes('接近・経路案内は行いません')));
});
test('C: strict source row, approval, coordinates, URL and contamination gates reject forged unapproved versions',()=>{
 const item=approved['sg2site-new9-aso-shrine-20261119'],site=byId.get(item.siteId);
 for(const mutate of [
  e=>{e.approval.user=''},
  e=>{e.approval.version='v1'},
  e=>{e.approval.bReview='B保留'},
  e=>{e.positionSourceSheetRow++},
  e=>{e.expectedPoint[0]+=0.001},
  e=>{e.officialInfoUrl='javascript:alert(1)'},
  e=>{e.attributions=[]}
 ]){
  const bad=JSON.parse(JSON.stringify(item));mutate(bad);
  assert.equal(View.approvedDisplay(site,{[item.siteId]:bad}),null);
 }
});
test('C: history source separators already published remain in index without touching URLs and awards',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.includes('SengokuSourceLinks.append(content,history.sourceUrls,document)'));
 assert.ok(html.includes('SengokuPinDisplay.makePopup(site,SengokuV2,document,SengokuPinApprovedV2)'));
 assert.ok(html.includes('SengokuPinDisplay.statusFor(site,SengokuPinApprovedV2)'));
 assert.ok(html.includes('黄：注意あり')&&html.includes('赤：危険・立入制限あり'));
 assert.ok(html.includes('sengoku-pin-approved-v2.js?v=c20261122-approved16'));
 assert.ok(!html.includes('pinReview.restriction ='));
});

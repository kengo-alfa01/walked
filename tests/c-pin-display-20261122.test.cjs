'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Pin=require('../sengoku-pin-display.js');
const Core=require('../sengoku-v2-core.js');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const staging=JSON.parse(fs.readFileSync(path.join(__dirname,'../qa/pin-display-candidates-20261122.json'),'utf8'));

class Node{
 constructor(type,content=''){this.nodeType=type==='text'?3:1;this.tagName=type;this.children=[];this._text=content;this.className='';}
 set textContent(value){this.children=[];this._text=String(value)}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
 append(...items){this.children.push(...items.map(x=>typeof x==='string'?new Node('text',x):x))}
 queryAll(tag){return [...this.children.filter(x=>x.tagName===tag),...this.children.flatMap(x=>x.queryAll(tag))]}
}
const document={
 createElement:tag=>new Node(tag),createTextNode:text=>new Node('text',text)
};
function approvedPreview(candidate){
 return {
  siteId:candidate.siteId,notice:candidate.notice,
  officialInfoUrl:candidate.officialInfoUrl,
  attributions:candidate.attributions,
  approval:{kind:'史跡見学表示',sourceId:candidate.siteId,version:'v2',sheetRow:99999,user:'公開OK',bReview:'B合格'}
 };
}
const publicPins=catalog.sites.filter(s=>s.publicPin);
const byId=new Map(catalog.sites.map(s=>[s.siteId,s]));
const rawMeta=site=>({...site.pinReview});
test('C: 419 published pins retain original ID/coord/access, show ③C history and hide internal ⑥E review text',()=>{
 assert.equal(catalog.sites.length,436);
 assert.equal(publicPins.length,419);
 assert.equal(new Set(publicPins.map(s=>s.siteId)).size,419);
 const totals={green:0,yellow:0,red:0};
 for(const site of publicPins){
  const before=JSON.stringify(rawMeta(site)),beforePoint=JSON.stringify(site.point);
  const html=Pin.makePopup(site,Core,document),visible=html.textContent;
  const status=site.pinReview.accessStatus;
  totals[status]++;
  assert.ok(visible.includes(site.name),'pin name '+site.siteId);
  assert.ok(visible.includes(site.description),'history ③C missing '+site.siteId);
  assert.ok(visible.includes(Pin.POLICY_LABELS[status]),'wrong legend label '+site.siteId);
  assert.ok(!visible.includes('【③史跡!'),'management row exposed '+site.siteId);
  assert.ok(!visible.includes('【④経歴と史跡の関係】'),'④ relationship exposed '+site.siteId);
  assert.ok(!visible.includes('【出典・利用】'),'license memo exposed '+site.siteId);
  assert.ok(!visible.includes('100m接近による獲得判定'),'internal acquisition memo exposed '+site.siteId);
  assert.ok(!visible.includes('立入制限：'),'raw review label exposed '+site.siteId);
  assert.equal(html.queryAll('a').length,0,'legacy URL not independently approved '+site.siteId);
  assert.equal(JSON.stringify(rawMeta(site)),before,'audit evidence altered '+site.siteId);
  assert.equal(JSON.stringify(site.point),beforePoint,'point altered '+site.siteId);
 }
 assert.equal(Object.values(totals).reduce((a,b)=>a+b,0),419);
 console.log('PIN419_QA_PASS',totals);
});

test('C: B candidate separation: 19+121, preservation, approval-gated display and CODH attribution preview',()=>{
 assert.equal(staging.counts.new19,19);assert.equal(staging.counts.legacy121,121);
 assert.equal(staging.counts.total,140);assert.equal(staging.counts.licenses,140);
 assert.equal(staging.records.length,140);
 assert.equal(new Set(staging.records.map(r=>r.siteId)).size,140);
 let notes=0,attributions=0;
 for(const candidate of staging.records){
  const site=byId.get(candidate.siteId);
  assert.ok(site?.publicPin,'staging site missing from 419 '+candidate.siteId);
  assert.equal(candidate.approval,null,'pending candidate must not masquerade as approved');
  assert.equal(candidate.permission,'PENDING_⑥_PUBLIC_OK');
  const base=Pin.makePopup(site,Core,document).textContent;
  const unchanged=JSON.stringify(site.pinReview);
  assert.ok(!base.includes('CODH作成'),'unapproved CODH attribution must not be injected '+candidate.siteId);
  const mocked={...site,pinDisplay:approvedPreview(candidate)};
  const structured=Pin.approvedDisplay(mocked);
  assert.ok(structured,'synthetic approved-data contract failed '+candidate.siteId);
  const content=Pin.makePopup(mocked,Core,document).textContent;
  if(candidate.notice){notes++;assert.ok(content.includes(candidate.notice),'approved preview missing safety note '+candidate.siteId)}
  for(const credit of candidate.attributions){
   attributions++;
   assert.ok(content.includes(credit.label),'approved preview missing attribution '+candidate.siteId);
  }
  if(candidate.officialInfoUrl){
   assert.ok(Pin.safeUrl(candidate.officialInfoUrl),'B proposal official URL invalid '+candidate.siteId);
   const a=Pin.makePopup(mocked,Core,document).queryAll('a');
   assert.ok(a.find(x=>x.href===candidate.officialInfoUrl),'approved preview official link mismatch '+candidate.siteId);
  }
  assert.equal(JSON.stringify(site.pinReview),unchanged);
  const rejected={...mocked,pinDisplay:{...mocked.pinDisplay,approval:{...mocked.pinDisplay.approval,user:''}}};
  assert.equal(Pin.approvedDisplay(rejected),null,'unapproved new version leaked');
 }
 assert.equal(notes,55);assert.equal(attributions,140);
});

test('C: source links 0, 1, 2, 3+ use DOM text node separators with valid URL filtering',()=>{
 const u=['https://example.org/a','https://example.org/b','https://example.org/c','https://example.org/d'];
 for(const urls of [[],u.slice(0,1),u.slice(0,2),u]){
  const target=document.createElement('div');
  const count=Pin.appendSourceLinks(target,urls,document),links=target.queryAll('a');
  assert.equal(count,urls.length);
  assert.deepEqual(links.map(x=>x.href),urls);
  assert.ok(links.every(x=>x.target==='_blank'&&x.rel==='noopener noreferrer'));
  const spans=target.queryAll('span');
  if(!urls.length){assert.equal(spans.length,0);continue}
  assert.equal(spans.length,1);
  assert.deepEqual(spans[0].children.filter(x=>x.nodeType===3).map(x=>x.textContent),Array(Math.max(0,count-1)).fill(' / '));
  assert.equal(spans[0].children[0].nodeType,1);
  assert.equal(spans[0].children.at(-1).nodeType,1);
  assert.equal(spans[0].textContent,Array(count).fill('出典を読む').join(' / '));
 }
 const mixed=document.createElement('div');
 assert.equal(Pin.appendSourceLinks(mixed,['',u[0],null,'http://insecure.invalid','javascript:alert(1)',u[1],' https://bad.example ',u[2]],document),3);
 assert.deepEqual(mixed.queryAll('a').map(x=>x.href),u.slice(0,3));
 assert.equal(mixed.textContent,'出典を読む / 出典を読む / 出典を読む');
});

test('C: changed safety words do not relabel red as universal prohibition',()=>{
 assert.equal(Core.pinPresentation('green').label,'通常見学可能');
 assert.equal(Core.pinPresentation('yellow').label,'注意あり');
 assert.equal(Core.pinPresentation('red').label,'危険・立入制限あり');
 assert.equal(Core.pinPresentation('red').symbol,'×');
 const red=publicPins.find(s=>s.pinReview.accessStatus==='red');
 const text=Pin.makePopup(red,Core,document).textContent;
 assert.match(text,/赤（危険・立入制限あり）/);
 assert.ok(!text.includes('赤（全面立入禁止）'));
 assert.match(text,/経路案内は行いません/);
});

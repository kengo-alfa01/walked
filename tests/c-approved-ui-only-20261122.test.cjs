'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Ui=require('../sengoku-source-links.js'),Core=require('../sengoku-v2-core.js');
const doc=JSON.parse(fs.readFileSync(path.join(__dirname,'../sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
class Element{
 constructor(tag,text=''){this.tagName=tag;this.nodeType=tag==='#text'?3:1;this.ownText=text;this.children=[];this.className=''}
 set textContent(v){this.ownText=String(v);this.children=[]}
 get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('')}
 append(...items){this.children.push(...items)}
 descendants(tag){return this.children.filter(x=>x.tagName===tag).concat(...this.children.map(x=>x.descendants(tag)))}
}
const document={createElement:t=>new Element(t),createTextNode:t=>new Element('#text',t)};
function append(urls){
 const el=document.createElement('div'),count=Ui.append(el,urls,document);
 return {el,count,links:el.descendants('a'),nodes:el.descendants('#text')};
}
test('C technical-only: exact 0, 1, 2, 3, 4 valid link separators with no edge separators',()=>{
 const u=Array.from({length:4},(_,i)=>'https://example.org/source/'+i);
 for(const n of [0,1,2,3,4]){
  const r=append(u.slice(0,n));
  assert.equal(r.count,n);
  assert.deepEqual(r.links.map(a=>a.href),u.slice(0,n));
  assert.deepEqual(r.nodes.map(x=>x.textContent),Array(Math.max(0,n-1)).fill(' / '));
  assert.equal(r.el.textContent,Array(n).fill('出典を読む').join(' / '));
  assert.ok(r.links.every(x=>x.target==='_blank'&&x.rel==='noopener noreferrer'));
 }
});
test('C technical-only: malformed/empty URLs do not add separators or alter source ordering',()=>{
 const u=['https://example.org/one','https://example.org/two','https://example.org/three'];
 const r=append([null,'',u[0],'https://bad url','http://insecure.example','javascript:alert(1)',u[1],u[2],' https://example.com ']);
 assert.equal(r.count,3);
 assert.deepEqual(r.links.map(x=>x.href),u);
 assert.equal(r.el.textContent,'出典を読む / 出典を読む / 出典を読む');
});
test('C technical-only: all 1251 histories retain source URL order and content, 419 original site notes remain in JSON',()=>{
 assert.equal(doc.histories.length,1251);
 assert.equal(doc.sites.filter(x=>x.publicPin).length,419);
 const before=JSON.stringify(doc);
 for(const h of doc.histories){
  const expected=(h.sourceUrls||[]).filter(Ui.validSourceUrl);
  const r=append(h.sourceUrls);
  assert.equal(r.count,expected.length,h.historyId);
  assert.deepEqual(r.links.map(x=>x.href),expected,h.historyId);
  assert.equal(r.nodes.length,Math.max(0,expected.length-1),h.historyId);
 }
 assert.equal(JSON.stringify(doc),before,'source catalog was mutated');
 assert.ok(doc.sites.filter(s=>s.publicPin).every(s=>typeof s.pinReview.restriction==='string'));
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.includes("SengokuSourceLinks.append(content,history.sourceUrls,document)"));
 const display=fs.readFileSync(path.join(__dirname,'../sengoku-pin-display.js'),'utf8');
 assert.ok(display.includes("if(d.restriction)field('立入制限：',d.restriction)"),'legacy 403 safety notes must not silently disappear');
 assert.ok(html.includes('SengokuPinDisplay.makePopup(site,SengokuV2,document,SengokuPinApprovedV2)'),'approved popup migration must be wired');
 assert.ok(html.includes("黄：注意あり"));
 assert.ok(html.includes("赤：危険・立入制限あり"));
});
test('C technical-only: no pin color or route availability is changed',()=>{
 assert.equal(Core.pinPresentation('green').label,'通常見学可能');
 assert.equal(Core.pinPresentation('yellow').label,'注意あり');
 assert.equal(Core.pinPresentation('red').label,'危険・立入制限あり');
 const red=doc.sites.filter(s=>s.publicPin&&s.pinReview.accessStatus==='red');
 assert.ok(red.length>0);
 for(const s of red){
  assert.equal(Core.pinDetails(s).noRouting,true);
  assert.deepEqual(Core.pinDetails(s).restriction,s.pinReview.restriction);
 }
});

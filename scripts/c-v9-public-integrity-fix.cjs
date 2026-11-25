#!/usr/bin/env node
'use strict';
// One-off C v9 repair. Run only on the dedicated QA branch, never on main.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const path='sengoku/v2/approved-c-20261124-p2-88.json';
const original=JSON.parse(fs.readFileSync(path,'utf8'));
if(original.version==='v2-approved-c-20261124-p2-88-v9'){
 const core=require('../sengoku-v2-core.js');
 const registry=JSON.parse(fs.readFileSync('data/title-registry.json','utf8'));
 const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
 const check=core.validate(original,new Set(registry.areas.map(v=>v.code)),sha);
 assert.deepEqual([check.people.size,check.histories.size,check.sites.size,
   original.relations.length,original.sites.filter(v=>v.publicPin).length],[88,1589,553,868,521]);
 console.log('C_V9_ALREADY_VALIDATED; avoiding repeat writes');
 process.exit(0);
}
assert.equal(original.version,'v2-approved-c-20261124-p2-88');
assert.deepEqual([original.people.length,original.histories.length,original.sites.length,original.relations.length,original.sites.filter(x=>x.publicPin).length],[88,1591,556,871,517]);
const blocked=new Set([
 'sg2hist-nobutora-kofu-founding',
 'sg2hist-katsuyori-1582-death',
 'sg2site-a-joun-body-mound-20261111',
 'sg2site-a-katsuyori-tano-20261111',
 'sg2site-a-nobutora-kawada-old-20261111'
]);
const pins=[
 {id:'sg2site-a-miy-koshimizu-20261114',approval:3681,row:424,longitude:135.336812,latitude:34.745646,color:'red',date:'2026-11-20',version:'v2',municipality:'兵庫県西宮市',official:'https://www.nishi.or.jp/shisei/sankaku/community/community/taisyachiiki.html',location:'https://geoshape.ex.nii.ac.jp/nrct-poi/resource/29/290000072700.html',notice:'大社小学校の校地や近隣の私有地には立ち入らないでください。CODHの歴史地名参照点であり、城址碑の厳密な位置や入口・安全な通路を示すものではありません。'},
 {id:'sg2site-a28-murakami-shioda-20261121',approval:3904,row:495,longitude:138.19609,latitude:36.339715,color:'green',date:'2026-11-22',version:'v1',municipality:'長野県上田市',official:'https://ueda-kanko.or.jp/spot/shiodacastle/',location:'https://geoshape.ex.nii.ac.jp/nrct-poi/resource/20/200000093600.html',notice:'一般に案内された散策区域を利用してください。周辺住宅・畑・私有地には立ち入らず、史跡の情報点を安全な通行経路や入口とみなさないでください。'},
 {id:'sg2site-a28-murakami-nechi-20261121',approval:3905,row:496,longitude:137.869634,latitude:36.959569,color:'yellow',date:'2026-11-22',version:'v1',municipality:'新潟県糸魚川市',official:'https://www.itoigawa-kanko.net/trad/nechijo/',location:'https://geoshape.ex.nii.ac.jp/nrct-poi/resource/15/150000023500.html',notice:'山城には急な登りがあります。積雪・悪天候に注意し、現地の案内に従ってください。この情報点は登山口や安全な経路ではありません。'},
 {id:'sg2site-a27-ujitsuna-taisekiji-1537-20261121',approval:3986,row:494,longitude:138.583466,latitude:35.281353,color:'red',date:'2026-11-22',version:'v1',municipality:'静岡県富士宮市',official:'https://www.nichirenshoshu.or.jp/jpn/taisekiji-faq.html',location:'https://geoshape.ex.nii.ac.jp/nrct-poi/resource/22/220000141900.html',notice:'一般に散策できる境内と堂内・管理区画の立入制限は別です。非公開区画に入らず、公式の見学規則に従ってください。情報ピンは参拝許可や経路の保証ではありません。'}
];
original.histories=original.histories.filter(h=>!blocked.has(h.historyId));
original.sites=original.sites.filter(s=>!blocked.has(s.siteId));
original.relations=original.relations.filter(r=>!blocked.has(r.historyId)&&!blocked.has(r.siteId));
original.municipalityAwards=original.municipalityAwards.filter(r=>!blocked.has(r.historyId)&&!blocked.has(r.relatedSiteId));
const nobutora=original.people.find(p=>p.personId==='sg-98514cee0056');
assert(nobutora);
const own=original.histories.filter(h=>h.personId===nobutora.personId);
assert.deepEqual([own.length,own.filter(h=>h.kind==='place').length],[29,7]);
nobutora.story.unlock.requiredHistoryCount=own.length;
nobutora.story.unlock.requiredPlaceHistoryCount=own.filter(h=>h.kind==='place').length;
nobutora.story.unlock.historyIdsSHA256=crypto.createHash('sha256').update(own.map(h=>h.historyId).sort().join('\n')).digest('hex');
const katsuyori=original.people.find(p=>p.personId==='sg-e00b2631eded');
assert(katsuyori,'Katsuyori is required for approved-history dependency check');
const katsuyoriHistories=original.histories.filter(h=>h.personId===katsuyori.personId);
const katsuyoriUnlock=katsuyori.story.unlock;
assert.equal(katsuyoriHistories.length+1,katsuyoriUnlock.requiredHistoryCount);
katsuyoriUnlock.requiredHistoryCount=katsuyoriHistories.length;
katsuyoriUnlock.requiredPlaceHistoryCount=katsuyoriHistories.filter(h=>h.kind==='place').length;
katsuyoriUnlock.historyIdsSHA256=crypto.createHash('sha256').update(katsuyoriHistories.map(h=>h.historyId).sort().join('\n')).digest('hex');
for(const p of pins){
 const site=original.sites.find(s=>s.siteId===p.id);
 assert(site,'Missing site '+p.id);
 assert.equal(site.publicPin,false);assert.equal(site.point,null);
 assert.equal(site.approval.sheetRow,p.approval);assert.equal(site.approval.version,p.version);
 assert.equal(site.approval.user,'公開OK');assert.equal(site.approval.quality,'品質合格');
 assert.equal(site.approval.sourceMatch,'一致');
 assert.equal(site.approval.handoff,'C候補（別途公開承認）');
 site.publicPin=true;site.point=[p.longitude,p.latitude];
 site.pinApproval={...site.approval};
 site.pinPersonIds=site.approval.personId.split('\n').filter(Boolean);
 site.pinReview={
  sourceSheetRow:p.row,decision:'可',municipality:p.municipality,
  locationKind:'B公表史跡・歴史情報参照点（入口・経路ではありません）',
  accessStatus:p.color,restriction:p.notice,checkedAt:p.date,
  officialInfoUrl:p.official,positionEvidenceUrl:p.location,
  positionSourceIds:[...site.sourceIds],
  attributions:[
   {label:'『日本歴史地名大系』施設・地点項目データセット（CODH作成） doi:10.20676/00000456（CC BY 4.0）',url:'https://geoshape.ex.nii.ac.jp/nrct-poi/index.html.ja'},
   {label:'CC BY 4.0 利用条件',url:'https://creativecommons.org/licenses/by/4.0/deed.ja'},
   {label:'公式見学案内',url:p.official}
  ],
  approvedE:'⑥'+p.approval+' '+p.version+'・③'+p.row+' B公開位置版照合。'+p.notice
 };
}
original.version='v2-approved-c-20261124-p2-88-v9';
original.notes.cRelease.v9={
 date:'2026-11-25',description:'C禁止の旧承認データ4件を削除、取得関係のない勝頼経歴1件を条件付き保留、B/⑥公開位置承認済み4ピン復旧',
 existingUsersAndApprovedTextUnchanged:true,noChangesToBDecisions:true,priorRelease:'v2-approved-c-20261124-p2-88'
};
assert.deepEqual([original.people.length,original.histories.length,original.sites.length,original.relations.length,original.sites.filter(s=>s.publicPin).length],[88,1589,553,868,521]);
const corepath='sengoku-v2-core.js',coreOriginal=fs.readFileSync(corepath,'utf8');
const marker='const C20261124_V7_PHASE1_PIN_META=Object.freeze({';
assert(coreOriginal.includes(marker));
const entries=pins.map(p=>JSON.stringify(p.id)+':['+[p.approval,p.row,p.longitude,p.latitude,JSON.stringify(p.color),JSON.stringify(p.date),JSON.stringify(p.version)].join(',')+']').join(',');
const updatedCore=coreOriginal.replace(marker,marker+entries+',');
fs.writeFileSync(corepath,updatedCore);
const core=require('../sengoku-v2-core.js');
const registry=JSON.parse(fs.readFileSync('data/title-registry.json','utf8'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const checked=core.validate(original,new Set(registry.areas.map(x=>x.code)),sha);
assert.deepEqual([checked.people.size,checked.histories.size,checked.sites.size],[88,1589,553]);
const out=JSON.stringify(original,null,2)+'\n';
for(const id of blocked)assert(!out.includes('"'+id+'"'),'Blocked ID remains '+id);
fs.writeFileSync(path,out);
console.log('C_V9_PRECOMMIT_VALIDATED',original.version,original.people.length,original.histories.length,original.sites.length,original.relations.length,original.sites.filter(s=>s.publicPin).length);

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');
const root=path.join(__dirname,'..');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const known=new Set(JSON.parse(fs.readFileSync(path.join(root,'data/title-registry.json'),'utf8')).areas.map(x=>x.code));
const hash=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const newPeople=['sg-596de9e9d2c2','sg-79a4eefd8d40','sg-master-0344','sg-master-0345','sg-master-0680','sg-master-0301','sg-master-1996','sg-37fdfb0d52c1','sg-master-0062','sg-added-new14-asakura-soteki-20261120','sg-added-new14-katakura-kagetsuna-20261120','sg-added-new14-ashina-moriuji-20261120','sg-added-new14-nagano-narimasa-20261120','sg-added-new14-sogo-kazumasa-20261120'];
const approval=(kind,personId,sourceId,text,row)=>({sheetRow:row,version:'v1',user:'公開OK',quality:'品質合格',rights:'位置不要・権利OK',handoff:'C候補（別途公開承認）',sourceMatch:'一致',sha256:hash(text),kind,personId,sourceId});
// All extra records below are synthetic and only test the structural validator.
// They are NEVER included in the production JSON or treated as real ⑥ approvals.
function fixture88(){
 const p=structuredClone(baseline);p.version='v2-test-88-not-for-publication';
 for(let i=0;i<newPeople.length;i++){
  const personId=newPeople[i],row=50000+3*i,historyId='sg2hist-v6-fixture-'+String(i).padStart(2,'0');
  const intro='テスト用人物紹介'+i,story='テスト用完成版ストーリー'+i,hText='テスト用経歴'+i;
  p.people.push({personId,name:'検証用人物'+i,
   introduction:{text:intro,yearText:'',approval:approval('人物紹介',personId,null,intro,row)},
   story:{text:story,yearText:'',approval:approval('完成版ストーリー',personId,null,story,row+1),
    unlock:{requiredHistoryCount:1,requiredPlaceHistoryCount:0,historyIdsSHA256:hash(historyId)}}});
  p.histories.push({historyId,personId,kind:'nonplace',title:'検査経歴'+i,yearText:'年次未詳',
   eventYear:null,eventYearEnd:null,text:hText,sourceIds:[],sourceUrls:[],
   approval:approval('経歴',personId,historyId,hText,row+2)});
 }
 return p;
}
test('current live 74-person payload remains valid and unchanged',()=>{
 assert.equal(baseline.people.length,74);
 assert.equal(core.validate(baseline,known,hash).people.size,74);
});
test('88-person candidate requires the exact 14 approved IDs (with synthetic valid approvals)',()=>{
 const f=fixture88();
 assert.equal(f.people.length,88);
 assert.equal(core.validate(f,known,hash).people.size,88);
});
test('wrong or missing new person is rejected even when the total is still 88',()=>{
 const f=fixture88();
 f.people[74].personId='sg-fixture-unauthorized-person';
 assert.throws(()=>core.validate(f,known,hash),/対象外・重複人物/);
});
test('blank or non-approved introduction does not satisfy the new 88-person gate',()=>{
 const f=fixture88();
 f.people[74].introduction.approval.user='承認待ち';
 assert.throws(()=>core.validate(f,known,hash),/ユーザー承認・品質・原文照合/);
});
test('same ⑥ approval row cannot be reused for another person',()=>{
 const f=fixture88();
 f.people[75].introduction.approval.sheetRow=f.people[74].introduction.approval.sheetRow;
 assert.throws(()=>core.validate(f,known,hash),/同じ承認行を重複流用/);
});

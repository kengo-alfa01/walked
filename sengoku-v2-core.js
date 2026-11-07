/* Sengoku v2 staging: approval-gated municipality history cards; legacy storage stays intact. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SengokuV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='walked.sengoku.v2.approved.v1';
  const SOURCE='1KirrKgmmK6j9boIzsOGlGqFAGVK7t8K5yoDvWsxfSsw';
  const PEOPLE=new Set(['sg-6eaf66c3d7c8','sg-f47391608dbb','sg-a7bb09927601']);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function check(ok,message){if(!ok)throw Error('戦国v2: '+message);}
  function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  function id(x){return typeof x==='string'&&/^[-a-z0-9:]+$/.test(x)&&x.length<120;}
  function codeSet(codes){return codes instanceof Set?codes:new Set(codes||[]);}
  function normalizeCodes(value,known){
    const raw=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
    check(raw.length>0,'獲得自治体コードがありません');
    const out=[];
    for(const c of raw){
      const v=String(c).trim();
      check(/^\d{5}$/.test(v),'不正な自治体コード '+v);
      check(!known||known.has(v),'未収録の自治体コード '+v);
      if(!out.includes(v))out.push(v);
    }
    return out;
  }
  function approval(a,body,hash,context){
    check(plain(a)&&Number.isInteger(a.sheetRow)&&a.sheetRow>=2,'⑥承認行がありません');
    check(/^v[1-9]\d*$/.test(a.version||''),'版番号が不正です');
    check(a.kind===context.kind&&a.personId===context.personId&&a.sourceId===context.sourceId,'承認行の人物・文章種別・元IDが一致しません');
    check(a.user==='公開OK'&&a.quality==='品質合格'&&a.sourceMatch==='一致','ユーザー承認・品質・原文照合が未完了です');
    check(a.handoff==='C候補（別途公開承認）','C受渡し判定が未完了です');
    check(typeof body==='string'&&body.length>0,'承認本文が空です');
    check(typeof a.sha256==='string'&&/^[0-9a-f]{64}$/.test(a.sha256)&&hash(body)===a.sha256,'承認済み文章のハッシュが一致しません');
  }
  function validate(doc,knownCodes,sha256){
    check(plain(doc)&&doc.schemaVersion===SCHEMA&&doc.sourceSpreadsheetId===SOURCE,'正本・スキーマが違います');
    check(Array.isArray(doc.people)&&Array.isArray(doc.histories)&&Array.isArray(doc.sites)&&Array.isArray(doc.relations),'台帳の構造が不正です');
    check(typeof sha256==='function','本文照合関数がありません');
    const known=codeSet(knownCodes), personMap=new Map(),siteMap=new Map(),historyMap=new Map(),linkKeys=new Set(),regionMap=new Map(),linkSites=new Map(),approvalRows=new Set();
    function uniqueApproval(a){check(!approvalRows.has(a.sheetRow),'⑥の同じ承認行を重複流用できません');approvalRows.add(a.sheetRow);}
    for(const p of doc.people){
      check(PEOPLE.has(p.personId)&&!personMap.has(p.personId)&&typeof p.name==='string','対象外・重複人物');
      for(const type of ['introduction','story']){
        const t=p[type];check(plain(t),'人物紹介・通史の欠落 '+p.personId);
        approval(t.approval,t.text,sha256,{kind:type==='introduction'?'人物紹介':'完成版ストーリー',personId:p.personId,sourceId:null});
        uniqueApproval(t.approval);
        check(t.approval.rights==='位置不要・権利OK'||t.approval.rights==='自治体確認済・権利OK','権利が未確認');
      }
      personMap.set(p.personId,p);
    }
    check(personMap.size===3,'先行3人物以外を混入させないでください');
    for(const s of doc.sites){
      check(id(s.siteId)&&!siteMap.has(s.siteId),'史跡IDの重複・欠落');
      check(s.locationReviewed===true&&s.rightsReviewed===true&&s.bStatus==='合格','史跡B審査・権利が未完了');
      const codes=normalizeCodes(s.municipalityCodes?.length?s.municipalityCodes:s.municipalityCode,known);
      check(!s.point||(s.publicPin===true&&Array.isArray(s.point)&&s.point.length===2&&s.point.every(Number.isFinite)&&s.point[0]>=122&&s.point[0]<=154&&s.point[1]>=20&&s.point[1]<=47),'未承認または範囲外のピン');
      check(s.publicPin!==true||Array.isArray(s.point),'公開ピンの位置がありません');
      siteMap.set(s.siteId,{...s,codes});
    }
    for(const h of doc.histories){
      check(id(h.historyId)&&h.historyId.startsWith('sg2hist-')&&!historyMap.has(h.historyId),'経歴IDの重複・形式不正');
      check(personMap.has(h.personId)&&['place','nonplace'].includes(h.kind),'対象外人物・経歴種別');
      check(typeof h.title==='string'&&h.title&&typeof h.yearText==='string','経歴の年次・タイトルがありません');
      approval(h.approval,h.text,sha256,{kind:'経歴カード',personId:h.personId,sourceId:h.historyId});
      uniqueApproval(h.approval);
      check(h.approval.rights==='自治体確認済・権利OK'||(h.kind==='nonplace'&&h.approval.rights==='位置不要・権利OK'),'経歴の位置・権利が未承認');
      historyMap.set(h.historyId,h);
    }
    for(const r of doc.relations){
      check(id(r.siteId)&&historyMap.has(r.historyId)&&siteMap.has(r.siteId),'未承認の経歴・史跡参照');
      const h=historyMap.get(r.historyId);
      check(h.kind==='place'&&h.personId===r.personId,'人物と経歴の関連が不一致');
      const key=r.historyId+'|'+r.siteId;
      check(!linkKeys.has(key),'経歴×史跡の重複');linkKeys.add(key);
      check(r.bStatus==='合格'&&r.linkDecision==='関係上対象'&&['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(r.classification),'④B関連審査または獲得対象が不適格');
      if(!regionMap.has(r.historyId))regionMap.set(r.historyId,new Set());
      if(!linkSites.has(r.historyId))linkSites.set(r.historyId,new Set());
      linkSites.get(r.historyId).add(r.siteId);
      for(const code of siteMap.get(r.siteId).codes)regionMap.get(r.historyId).add(code);
    }
    for(const h of historyMap.values())if(h.kind==='place')check(regionMap.has(h.historyId)&&regionMap.get(h.historyId).size>0,'経歴に承認済みの獲得リンクがありません: '+h.historyId);
    return {people:personMap,histories:historyMap,sites:siteMap,codes:regionMap,linkSites,version:doc.version||'v2-stage'};
  }
  function municipalityFromKey(key){
    const raw=String(key||'');
    if(/^\d{5}$/.test(raw))return raw;
    if(/^[ms]:\d{5}/.test(raw)||/^n:\d{5}:/.test(raw))return raw.slice(2,7);
    return '';
  }
  function visitedCodes(visited){
    const set=new Set();
    for(const k of Object.keys(visited||{}))if(visited[k]){const code=municipalityFromKey(k);if(code)set.add(code);}
    return set;
  }
  function acquired(index,found,personId){
    let count=0;
    if(!index)return count;
    for(const h of index.histories.values())if(h.personId===personId&&own(found,h.historyId))count++;
    return count;
  }
  function award(index,visited,found,unlockedPeople,at){
    const seen=visitedCodes(visited),next={...found},added=[],when=at||new Date().toISOString(),personUnlocked=new Set(unlockedPeople||[]);
    for(const h of index.histories.values()){
      if(h.kind!=='place'||own(next,h.historyId))continue;
      if(![...(index.codes.get(h.historyId)||[])].some(c=>seen.has(c)))continue;
      const site=[...(index.linkSites.get(h.historyId)||[])].map(sid=>index.sites.get(sid)).find(s=>s.codes.some(c=>seen.has(c)));
      next[h.historyId]={at:when,siteId:site?.siteId||'',basis:index.version};added.push(h.historyId);personUnlocked.add(h.personId);
    }
    for(const h of index.histories.values()){
      if(h.kind!=='nonplace'||own(next,h.historyId)||!personUnlocked.has(h.personId))continue;
      next[h.historyId]={at:when,basis:index.version};added.push(h.historyId);
    }
    return {records:next,added};
  }
  return {SCHEMA,SOURCE,PEOPLE,normalizeCodes,municipalityFromKey,visitedCodes,validate,award,acquired};
});
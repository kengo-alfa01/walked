/* Sengoku v2 staging: approval-gated municipality history cards; legacy storage stays intact. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SengokuV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='walked.sengoku.v2.approved.v1';
  const SOURCE='1KirrKgmmK6j9boIzsOGlGqFAGVK7t8K5yoDvWsxfSsw';
  const PEOPLE=new Set(["sg-6eaf66c3d7c8","sg-f47391608dbb","sg-a7bb09927601","sg-4cb1a557e060","sg-29c3bc68aa37","sg-4c0c12460efa","sg-dc8c550d8769","sg-31e0e85d7a10","sg-98139e31efb2","sg-master-0817","sg-b9bb61125a1b","sg-22f595e1c616","sg-added-maeda-toshiie","sg-a94db8113d4e","sg-master-0891","sg-819c365a83e4","sg-281d92dc2e0f","sg-1a91ae29cb5a","sg-2d3f90c28c8f","sg-025ab3a6ee3f"]);
  const INTRO_PENDING=new Set(["sg-281d92dc2e0f","sg-1a91ae29cb5a","sg-2d3f90c28c8f","sg-025ab3a6ee3f"]);
  // Immutable release manifest: ⑥ row, ③ row, [longitude,latitude], status, and reviewed date.
  const PIN_APPROVED_META=Object.freeze({
  "sg2site-hideyoshi-fushimi-kohata": [1567, 37, 135.780854, 34.941691, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-fushimi-shigetsu": [1566, 36, 135.77034, 34.929703, "yellow", "2026-11-09"],
  "sg2site-hideyoshi-juraku": [1565, 31, 135.7460625, 35.0249375, "green", "2026-11-08"],
  "sg2site-hideyoshi-gakuden": [1564, 30, 136.950542, 35.32825, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-shizugatake": [1563, 28, 136.19306, 35.50611, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-bitchu-takamatsu": [1562, 27, 133.822263, 34.692673, "green", "2026-11-08"],
  "sg2site-nobu-ishiyama-honganji": [1561, 19, 135.5244375, 34.6845625, "green", "2026-11-08"],
  "sg2site-nobu-azuchi-town": [1560, 17, 136.1352344, 35.15029465, "green", "2026-11-08"],
  "sg2site-nobu-nagashima-castle": [1559, 16, 136.698899, 35.092373, "yellow", "2026-11-08"],
  "sg2site-nobu-enryakuji": [1558, 13, 135.84096, 35.070503, "yellow", "2026-11-08"],
  "sg2site-nobu-anegawa": [1557, 12, 136.3222, 35.415961, "yellow", "2026-11-08"],
  "sg2site-nobu-shotokuji-disputed": [1556, 9, 136.7350625, 35.2991875, "green", "2026-11-08"],
  "sg2site-nobu-honnoji-old": [1555, 8, 135.7536875, 35.0059375, "green", "2026-11-08"],
  "sg2site-nobu-shitaragahara": [1554, 6, 137.52502778, 34.92175, "green", "2026-11-08"],
  "sg2site-hideyoshi-taiheiji": [1553, 216, 130.305374, 31.824417, "green", "2026-11-08"],
  "sg2site-ieyasu-edo": [1546, 54, 139.7559375, 35.6861875, "yellow", "2026-11-10"],
  "sg2site-nobu-okehazama-tradition": [
    465,
    2,
    136.9807,
    35.05998,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-komakiyama": [
    466,
    3,
    136.9133984,
    35.2924575,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-gifu": [
    467,
    4,
    136.782034,
    35.433927,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-nobu-toji": [
    468,
    5,
    135.747703,
    34.980317,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-azuchi": [
    469,
    7,
    136.139542,
    35.155818,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-nobu-kiyosu-old": [
    470,
    10,
    136.8420625,
    35.2171875,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-kanegasaki": [
    471,
    11,
    136.074112,
    35.666393,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-ichijodani": [
    472,
    14,
    136.295692,
    35.999445,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-odani": [
    473,
    15,
    136.272303,
    35.449437,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-arioka": [
    474,
    18,
    135.420992,
    34.781112,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-ohkawachi": [
    475,
    20,
    136.472926,
    34.527127,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-inou-battle-commemorative": [
    476,
    21,
    136.8905,
    35.206083,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-fujisan-hongu-sengen": [
    477,
    22,
    138.610535,
    35.225037,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-inuyama": [
    478,
    23,
    136.939177,
    35.38836,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-birth-memorial": [
    479,
    24,
    136.85409,
    35.17472,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-nagahama": [
    480,
    25,
    136.261784,
    35.377409,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-himeji": [
    481,
    26,
    134.6939,
    34.83935,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-osaka-castle": [
    482,
    29,
    135.526,
    34.68734,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-kitano": [
    483,
    32,
    135.735123,
    35.031174,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-ishigakiyama": [
    484,
    33,
    139.1278124,
    35.23538433,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-odawara": [
    485,
    34,
    139.1573811,
    35.24966708,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-hizen-nagoya": [
    486,
    35,
    129.868966,
    33.530396,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-daigoji": [
    487,
    38,
    135.822634,
    34.950962,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-miki": [
    488,
    39,
    134.987864,
    34.799872,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-hiraiyama": [
    489,
    40,
    135.0160625,
    34.8081875,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-tottori": [
    490,
    41,
    134.23872,
    35.50416,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-negoroji": [
    491,
    42,
    135.321625,
    34.294727,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-kurokawa": [
    492,
    43,
    139.932324,
    37.487317,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-odoi-hirano": [
    493,
    44,
    135.7349167,
    35.03330556,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-yamazaki-castle": [
    494,
    45,
    135.676282,
    34.901786,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-okazaki": [
    495,
    46,
    137.1596639,
    34.956153,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-odaka": [
    496,
    47,
    136.936302,
    35.064525,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-honshoji": [
    497,
    48,
    137.085083,
    34.900173,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-kakegawa": [
    498,
    49,
    138.015145,
    34.776906,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-hamamatsu": [
    499,
    50,
    137.723698,
    34.712366,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-saigagake": [
    500,
    51,
    137.7183622,
    34.7196531,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-takatenjin": [
    501,
    52,
    138.035571,
    34.698262,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-sunpu": [
    502,
    53,
    138.383163,
    34.979285,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-momokubari": [
    503,
    55,
    136.488411,
    35.365395,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-jinbano": [
    504,
    56,
    136.465098,
    35.365809,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nijo": [
    505,
    57,
    135.7503,
    35.01263,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-chausu": [
    506,
    58,
    135.5114375,
    34.6518125,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-kunozan": [
    507,
    59,
    138.4676128,
    34.9648125,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nagakute": [
    508,
    60,
    137.049856,
    35.171566,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-oyama-council-tradition": [
    509,
    61,
    139.800754,
    36.3145282,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nikko-toshogu": [
    510,
    62,
    139.597214,
    36.759941,
    "green",
    "2026-11-07"
  ]
});
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
        const t=p[type];if(type==='introduction'&&!t&&INTRO_PENDING.has(p.personId))continue;
        check(plain(t),'人物紹介・通史の欠落 '+p.personId);
        approval(t.approval,t.text,sha256,{kind:type==='introduction'?'人物紹介':'完成版ストーリー',personId:p.personId,sourceId:null});
        uniqueApproval(t.approval);
        check(t.approval.rights==='位置不要・権利OK'||t.approval.rights==='自治体確認済・権利OK','権利が未確認');
      }
      const unlock=p.story.unlock;
      check(plain(unlock)&&Number.isInteger(unlock.requiredHistoryCount)&&unlock.requiredHistoryCount>0&&Number.isInteger(unlock.requiredPlaceHistoryCount)&&unlock.requiredPlaceHistoryCount>=0&&unlock.requiredPlaceHistoryCount<=unlock.requiredHistoryCount&&/^[a-f0-9]{64}$/.test(unlock.historyIdsSHA256||''),'完成版ストーリーの全経歴解放条件が不正です');
      personMap.set(p.personId,p);
    }
    check(personMap.size===3||personMap.size===20,'先行3人物または承認20人物以外を混入させないでください');
    for(const s of doc.sites){
      check(id(s.siteId)&&!siteMap.has(s.siteId),'史跡IDの重複・欠落');
      check(Array.isArray(s.personIds)&&s.personIds.length>0&&s.personIds.every(x=>personMap.has(x)),'史跡承認に対象外人物を含む');
      check(s.locationReviewed===true&&s.rightsReviewed===true&&s.bStatus==='合格','史跡B審査・権利が未完了');
      approval(s.approval,s.description,sha256,{kind:'史跡',personId:s.personIds.join('\n'),sourceId:s.siteId});
      uniqueApproval(s.approval);
      check(['自治体確認済・権利OK','地点確認済・権利OK'].includes(s.approval.rights),'史跡の権利・所在地確認が未承認');
      check(typeof s.name==='string'&&s.name&&typeof s.description==='string'&&s.description,'史跡の表示名・本文がありません');
      check(Array.isArray(s.sourceUrls)&&s.sourceUrls.every(x=>typeof x==='string'&&/^https:\/\//.test(x)),'史跡出典URL不正');
      const codes=normalizeCodes(s.municipalityCodes?.length?s.municipalityCodes:s.municipalityCode,known);
      check(!s.point||(s.publicPin===true&&Array.isArray(s.point)&&s.point.length===2&&s.point.every(Number.isFinite)&&s.point[0]>=122&&s.point[0]<=154&&s.point[1]>=20&&s.point[1]<=47),'未承認または範囲外のピン');
      if(s.publicPin===true){
        check(Array.isArray(s.point),'公開ピンの位置がありません');
        check(plain(s.pinApproval),'位置更新版の⑥公開承認がありません');
        approval(s.pinApproval,s.description,sha256,{kind:'史跡',personId:s.personIds.join('\n'),sourceId:s.siteId});
        uniqueApproval(s.pinApproval);
        check(s.pinApproval.version==='v2'&&s.pinApproval.sheetRow===PIN_APPROVED_META[s.siteId]?.[0],'位置版v2と史跡IDの⑥承認行が一致しません');
        check(['自治体確認済・権利OK','地点確認済・権利OK'].includes(s.pinApproval.rights),'位置版の権利・所在地確認が未承認');
        const p=s.pinReview;
        check(plain(p)&&p.decision==='可'&&['green','yellow','red'].includes(p.accessStatus),'Bの最新公開ピン・見学区分が未確認');
        const expected=PIN_APPROVED_META[s.siteId];
        check(!!expected&&p.sourceSheetRow===expected[1]&&s.point[0]===expected[2]&&s.point[1]===expected[3]&&p.accessStatus===expected[4]&&p.checkedAt===expected[5],'⑥位置版と③最新B記録の座標・見学区分が一致しません');
        check(typeof p.locationKind==='string'&&p.locationKind.length>0&&p.locationKind!=='未設定','表示位置の種別が未確認');
        check(typeof p.municipality==='string'&&p.municipality.length>0&&Number.isInteger(p.sourceSheetRow)&&p.sourceSheetRow>=2,'③史跡の参照行・市区町村がありません');
        check(/^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt||''),'見学情報の確認日がありません');
        check(typeof p.restriction==='string'&&(p.accessStatus==='green'||p.restriction.trim()),'立入制限の内容がありません');
        check([p.officialInfoUrl,p.positionEvidenceUrl].every(u=>u===null||typeof u==='string'&&/^https:\/\//.test(u)),'史跡案内・根拠URL不正');
        check(Array.isArray(p.positionSourceIds)&&p.positionSourceIds.every(x=>typeof x==='string'),'位置情報の出典IDが不正です');
      }else{
        check(s.publicPin===false&&s.point===null&&!s.pinApproval&&!s.pinReview,'未承認史跡に位置情報が混入しています');
      }
      siteMap.set(s.siteId,{...s,codes});
    }
    for(const h of doc.histories){
      check(id(h.historyId)&&h.historyId.startsWith('sg2hist-')&&!historyMap.has(h.historyId),'経歴IDの重複・形式不正');
      check(personMap.has(h.personId)&&['place','nonplace'].includes(h.kind),'対象外人物・経歴種別');
      check(typeof h.title==='string'&&h.title&&typeof h.yearText==='string','経歴の年次・タイトルがありません');
      approval(h.approval,h.text,sha256,{kind:'経歴',personId:h.personId,sourceId:h.historyId});
      uniqueApproval(h.approval);
      check((h.kind==='place'&&['自治体確認済・権利OK','地点確認済・権利OK'].includes(h.approval.rights))||(h.kind==='nonplace'&&h.approval.rights==='位置不要・権利OK'),'経歴の場所区分と権利承認が一致しません');
      check(Array.isArray(h.sourceUrls)&&h.sourceUrls.every(x=>typeof x==='string'&&/^https:\/\//.test(x)),'経歴出典URL不正');
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
    for(const h of historyMap.values()){
      if(h.kind==='place')check(regionMap.has(h.historyId)&&regionMap.get(h.historyId).size>0,'経歴に承認済みの獲得リンクがありません: '+h.historyId);
      else check(!regionMap.has(h.historyId),'場所不要経歴には史跡獲得リンクを設定できません');
    }
    for(const p of personMap.values()){
      const histories=[...historyMap.values()].filter(h=>h.personId===p.personId);
      const unlock=p.story.unlock;
      if(histories.length){
        check(histories.length===unlock.requiredHistoryCount&&histories.filter(h=>h.kind==='place').length===unlock.requiredPlaceHistoryCount,'通史の対象経歴件数が一致しません');
        check(sha256(histories.map(h=>h.historyId).sort().join('\n'))===unlock.historyIdsSHA256,'通史の対象経歴ID集合が承認版と一致しません');
      }
    }
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
  // Return ONLY visited municipalities that genuinely qualified an approved,
  // acquired location history. Never reveal unvisited eligible locations or
  // attach a made-up place to a non-location history.
  function earnedMunicipalities(index,historyId,visited,found){
    if(!index||!index.histories.has(historyId)||!found||
       !own(found,historyId)||index.histories.get(historyId).kind!=='place')return [];
    const eligible=index.codes.get(historyId);
    if(!eligible)return [];
    const visitedSet=visitedCodes(visited);
    return [...eligible].filter(code=>visitedSet.has(code)).sort();
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
  // Do not unlock a 1000-character biography just because only a subset of the
  // required histories has received final ⑥ approval. Both count and exact ID-set
  // digest must match the authorized release rule before all acquired IDs count.
  function canUnlockStory(index,personId,found,sha256){
    if(!index||typeof sha256!=='function')return false;
    const rule=index.people.get(personId)?.story?.unlock;
    if(!rule)return false;
    const histories=[...index.histories.values()].filter(h=>h.personId===personId);
    if(histories.length!==rule.requiredHistoryCount||
       histories.filter(h=>h.kind==='place').length!==rule.requiredPlaceHistoryCount)return false;
    if(sha256(histories.map(h=>h.historyId).sort().join('\n'))!==rule.historyIdsSHA256)return false;
    return histories.every(h=>own(found,h.historyId));
  }

  // Color communicates published access conditions, never discovery or card ownership.
  function pinPresentation(status){
    const config={
      green:{label:'通常見学可能',symbol:'○',fill:'#21864e',stroke:'#125c35'},
      yellow:{label:'一部立入制限',symbol:'△',fill:'#edb42d',stroke:'#77510c'},
      red:{label:'全面立入禁止',symbol:'×',fill:'#ca3a3a',stroke:'#7f1d1d'}
    };
    const selected=config[status];
    check(!!selected,'未確認の立入区分はピンに表示できません');
    return {...selected,colorName:{green:'緑',yellow:'黄',red:'赤'}[status]};
  }
  function pinDetails(site){
    check(plain(site)&&site.publicPin===true&&plain(site.pinReview),'未承認の公開ピンです');
    const p=site.pinReview;
    return {
      name:site.name,municipality:p.municipality,
      positionKind:p.locationKind,checkedAt:p.checkedAt,
      access:pinPresentation(p.accessStatus),restriction:p.restriction,
      officialInfoUrl:p.officialInfoUrl,
      guidance:'立入状況は変わる場合があります。現地の案内に従ってください。',
      noRouting:p.accessStatus==='red'
    };
  }
  return {SCHEMA,SOURCE,PEOPLE,normalizeCodes,municipalityFromKey,visitedCodes,earnedMunicipalities,validate,award,acquired,canUnlockStory,pinPresentation,pinDetails};
});
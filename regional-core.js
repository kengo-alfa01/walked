(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./walked-core.js'):root.WalkedCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.RegionalCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(W){
'use strict';
const categories=['特産品・名物','景勝・自然','伝説・民話','故事・ことわざ','文化・祭り','歴史・街並み','妖怪・怪異・怖い話'];
function validate(doc,registry){
 if(doc.schemaVersion!==1||typeof doc.version!=='string')throw Error('地域図鑑の版が不正です');
 const fields={items:['id','name','category','description','nature','sourceIds','publicationStatus'],relations:['id','areaCode','itemId','sourceIds','publicationStatus'],sources:['id','name','url','publisher','checkedOn']};
 const ids={};for(const key of ['items','relations','sources']){if(!Array.isArray(doc[key]))throw Error('地域図鑑の配列が不正です');ids[key]=new Set();for(const r of doc[key]){if(Object.keys(r).some(k=>!fields[key].includes(k)))throw Error('未承認のフィールド');if(typeof r.id!=='string'||!r.id||ids[key].has(r.id))throw Error('ID重複/欠落');ids[key].add(r.id);}}
 const codes=new Set(registry.areas.map(a=>a.code));
 for(const i of doc.items)if(i.publicationStatus!=='公開可'||!categories.includes(i.category)||typeof i.name!=='string'||!i.name||typeof i.description!=='string'||!i.description||!Array.isArray(i.sourceIds)||!i.sourceIds.length||i.sourceIds.some(id=>!ids.sources.has(id)))throw Error('項目の公開条件/出典が不正です');
 const pairs=new Set();for(const r of doc.relations){const key=r.areaCode+'|'+r.itemId;if(r.publicationStatus!=='公開可'||!codes.has(r.areaCode)||!ids.items.has(r.itemId)||pairs.has(key)||!Array.isArray(r.sourceIds)||!r.sourceIds.length||r.sourceIds.some(id=>!ids.sources.has(id)))throw Error('対応の公開条件/参照が不正です');pairs.add(key);}
 for(const i of doc.items)if(!doc.relations.some(r=>r.itemId===i.id))throw Error('項目の地域対応がありません');
 for(const s of doc.sources)if(typeof s.url!=='string'||!/^https:\/\//.test(s.url)||!s.name||!s.publisher)throw Error('出典が不正です');return doc;
}
function view(doc,visited,registry){
 const valid=new Set(registry.areas.map(a=>a.code)),codes=new Set(Object.keys(visited).map(W.municipality).filter(c=>valid.has(c)));
 const relations=doc.relations.filter(r=>codes.has(r.areaCode)),owned=new Set(relations.map(r=>r.itemId));
 return {codes,relations,items:doc.items.filter(i=>owned.has(i.id)),areas:registry.areas.filter(a=>codes.has(a.code)),prefectures:registry.prefectures.filter(p=>registry.areas.some(a=>a.prefecture===p.code&&codes.has(a.code)))};
}
return {categories,validate,view};
});

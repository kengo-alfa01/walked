(function(root){'use strict';
function mount({getVisits,getRegistry}){
 const host=document.getElementById('regionalPanel');let catalog=null,open=false,mode='area',pref='',area='',category='',limit=30;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const toggle=host.querySelector('button'),body=host.querySelector('[data-body]'),status=host.querySelector('[data-status]');
 toggle.onclick=()=>{open=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'図鑑を閉じる':'地域図鑑を開く';body.hidden=!open;refresh();};
 function refresh(){
  const registry=getRegistry();if(!catalog||!registry)return;
  try{
   const v=RegionalCore.view(catalog,getVisits(),registry);status.textContent=`獲得済み ${v.items.length}項目・訪問済み ${v.areas.length}地域`;
   if(!open)return;body.replaceChildren();
   const note=el('p','地域の訪問記録に基づく図鑑です。個別の施設への訪問・購入・参加を示す記録ではありません。');note.className='small-note';body.append(note);
   if(!v.areas.length){body.append(el('p','地域を登録すると、その地域の公開された記事がここに集まります。'));return;}
   const nav=el('div');nav.className='regional-actions';for(const [value,label] of [['area','都道府県から探す'],['category','カテゴリーから探す']]){const b=el('button',label);b.type='button';b.className=mode===value?'':'alt';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;limit=30;refresh();};nav.append(b);}body.append(nav);
   let list=v.items;
   if(mode==='area'){
    if(!v.prefectures.some(p=>p.code===pref)){pref='';area='';}
    const label=el('label','都道府県を選択');label.htmlFor='regionalPref';const select=el('select');select.id='regionalPref';select.append(new Option('都道府県を選んでください',''));
    for(const p of v.prefectures)select.append(new Option(p.name,p.code));select.value=pref;select.onchange=()=>{pref=select.value;area='';category='';limit=30;refresh();};body.append(label,select);
    if(!pref)return;
    const areas=v.areas.filter(a=>a.prefecture===pref);if(!areas.some(a=>a.code===area))area='';
    const choices=el('div');choices.className='regional-actions';for(const a of areas){const b=el('button',a.name);b.type='button';b.className=a.code===area?'':'alt';b.onclick=()=>{area=a.code;category='';limit=30;refresh();};choices.append(b);}body.append(choices);
    if(!area)return;
    const ids=new Set(v.relations.filter(r=>r.areaCode===area).map(r=>r.itemId));list=list.filter(i=>ids.has(i.id));
   }
   const cats=el('div');cats.className='regional-categories';for(const c of RegionalCore.categories){const b=el('button',c+'（'+list.filter(i=>i.category===c).length+'）');b.type='button';b.className=c===category?'':'alt';b.onclick=()=>{category=c;limit=30;refresh();};cats.append(b);}body.append(cats);
   if(!category){body.append(el('p','カテゴリーを選んでください。'));return;}
   list=list.filter(i=>i.category===category);if(!list.length){body.append(el('p','このカテゴリーの公開記事はまだありません。'));return;}
   const grid=el('div');grid.className='regional-articles';
   for(const i of list.slice(0,limit)){
    const card=el('button');card.type='button';card.className='regional-article';card.dataset.itemId=i.id;card.append(el('strong',i.name));
    const names=v.relations.filter(r=>r.itemId===i.id).map(r=>v.areas.find(a=>a.code===r.areaCode)).filter(Boolean).map(a=>registry.prefectures.find(p=>p.code===a.prefecture).name+' '+a.name);
    card.append(el('small',names.join(' ／ ')));card.onclick=()=>show(i,v,registry);grid.append(card);
   }body.append(grid);
   if(list.length>limit){const more=el('button','続きを表示（残り'+(list.length-limit)+'件）');more.type='button';more.onclick=()=>{limit+=30;refresh();};body.append(more);}
  }catch(e){status.textContent='地域図鑑を表示できません：'+e.message;body.replaceChildren();}
 }
 const dialog=document.getElementById('regionalDialog');
 function show(item,v,registry){
  if(!v.items.some(i=>i.id===item.id))return;
  dialog.replaceChildren();const close=el('button','閉じる');close.type='button';close.className='alt';close.onclick=()=>dialog.close();
  const title=el('h3',item.name),category=el('p',item.category),desc=el('p',item.description),nature=el('p',item.nature);desc.className='regional-description';
  const areas=v.relations.filter(r=>r.itemId===item.id).map(r=>v.areas.find(a=>a.code===r.areaCode)).filter(Boolean);
  dialog.append(close,title,category,el('p',areas.map(a=>registry.prefectures.find(p=>p.code===a.prefecture).name+' '+a.name).join(' ／ ')),desc,nature,el('h4','出典'));
  const ids=new Set([...item.sourceIds,...v.relations.filter(r=>r.itemId===item.id).flatMap(r=>r.sourceIds)]);
  for(const s of catalog.sources.filter(s=>ids.has(s.id))){const p=el('p'),a=el('a',s.name+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';p.append(el('span',s.publisher+' ／ '),a,el('small','確認日：'+s.checkedOn));dialog.append(p);}
  dialog.append(el('p','発信主体による本アプリの公認・推奨を示すものではありません。写真・図版・原文等は掲載していません。'));dialog.showModal();
 }
 async function load(){try{const r=await fetch('./regional/catalog.json',{cache:'no-cache'});if(!r.ok)throw Error('データ取得失敗');const doc=await r.json();const registry=getRegistry();if(registry)RegionalCore.validate(doc,registry);catalog=doc;refresh();}catch(e){status.textContent='地域図鑑を読み込めません：'+e.message;}}
 // Loading can finish before the title registry; validate on each refresh as well.
 const guardedRefresh=()=>{if(catalog&&getRegistry()){try{RegionalCore.validate(catalog,getRegistry());refresh();if(dialog.open)dialog.close();}catch(e){catalog=null;body.replaceChildren();status.textContent='地域図鑑の公開データが不正です';}}};
 load();return {refresh:guardedRefresh};
}
root.RegionalUI={mount};
})(window);

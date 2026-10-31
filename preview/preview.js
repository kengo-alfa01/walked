/* Loaded only by scripts/build-preview.py, never by the public application. */
(function(){
 'use strict';
 if(!document.querySelector('meta[name="walked-preview"]'))return;
 const panel=document.createElement('section');panel.className='walked-preview';panel.setAttribute('aria-label','確認用ページの案内');
 const heading=document.createElement('strong');heading.textContent='🧪 WALKED 確認用ページ';
 const description=document.createElement('p');description.textContent='ここでの記録は公開版と別です。まずサンプルで称号を試せます。自分の記録で試す場合は、公開版で保存したバックアップのコピーを「復元」してください。';
 const sample=document.createElement('button');sample.type='button';sample.textContent='サンプルで称号を試す';sample.id='previewSample';
 const reset=document.createElement('button');reset.type='button';reset.textContent='確認用の記録をリセット';reset.className='alt';reset.id='previewReset';
 const note=document.createElement('p');note.className='preview-note';note.id='previewNote';
 const revision=document.createElement('small');revision.textContent='確認対象：'+document.querySelector('meta[name="walked-preview"]').content;
 const actions=document.createElement('div');actions.className='preview-actions';actions.append(sample,reset);
 panel.append(heading,description,actions,note,revision);document.querySelector('main').prepend(panel);
 const sampleKey='walked_preview_sample_v1';
 function syncNote(){note.textContent=localStorage.getItem(sampleKey)==='true'?'サンプル記録で表示中。自分のバックアップを試す前に「確認用の記録をリセット」してください。':'試す順番：①サンプル → ②称号を選択 → ③再読み込みして表示を確認。旧バックアップにはカード記録が含まれない場合があります。';}
 sample.onclick=()=>{
  if(lockedStorageKeys.size)return status('保存記録に読込エラーがあります。設定の保存データ救出を先に実行してください。');
  if(!titleRegistry)return status('称号データの読み込み後にもう一度お試しください。');
  if(state.busy)return status('位置データの処理が終わってからお試しください。');
  if(Object.keys(state.visited).length||Object.keys(sengokuFound).length||Object.keys(titleState.awards).length)return status('サンプルは記録が空の時に追加できます。必要なら確認用記録をバックアップ後、リセットしてください。');
  const now=new Date().toISOString(),visited={};
  for(const [pref,n] of [['13',16],['14',15]])for(const area of titleRegistry.areas.filter(a=>a.prefecture===pref).slice(0,n))visited[area.code]={first:now,last:now,source:'確認用サンプル'};
  try{
   WalkedCore.transaction(localStorage,{[DBKEY]:JSON.stringify(visited),[sampleKey]:'true'},restoreJournalKey);
   state.visited=visited;updateTitles();repaint();renderHistory();reconcileSengokuVisits();
   selectTitle('national-2');$('titlePanel').hidden=false;$('titleToggle').setAttribute('aria-expanded','true');renderTitles();syncNote();
   status('サンプル31エリアを登録しました。「足軽大将」と東京都・神奈川県の25%称号を確認できます。');
  }catch(error){status('サンプルを保存できません：'+error.message)}
 };
 reset.onclick=()=>{
  if(state.busy)return status('位置データの処理が終わってからリセットしてください。');
  if(!confirm('この確認用ページの制覇・カード・称号をリセットします。公開版の記録には影響しません。必要な記録は先にバックアップしてください。続けますか？'))return;
  try{
   if(localStorage.getItem(restoreJournalKey))throw Error('復元保護記録の回復待ちです。ページを再読み込みしてください。');
   WalkedCore.transaction(localStorage,{[DBKEY]:'{}',[sengokuStoreKey]:'{}',[titleStoreKey]:JSON.stringify({awards:{},selected:null}),[sampleKey]:'false'},restoreJournalKey);
   location.reload();
  }catch(error){status('確認用記録をリセットできません：'+error.message)}
 };
 syncNote();
})();

/* Source-link presentation only. Does not alter approved history, URLs or awards. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SengokuSourceLinks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validSourceUrl(url){
  if(typeof url!=='string'||!/^https:\/\/[^\s]+$/.test(url))return false;
  try{
   const parsed=new URL(url);
   return parsed.protocol==='https:'&&!!parsed.hostname;
  }catch{return false}
 }
 function append(container,urls,document){
  const valid=(Array.isArray(urls)?urls:[]).filter(validSourceUrl);
  if(!valid.length)return 0;
  const links=document.createElement('span');links.className='sengoku-source-links';
  valid.forEach((url,i)=>{
   if(i)links.append(document.createTextNode(' / '));
   const a=document.createElement('a');
   a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='出典を読む';
   links.append(a);
  });
  container.append(links);
  return valid.length;
 }
 return {validSourceUrl,append};
});

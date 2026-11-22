/* Shared smartphone and desktop, non-modal historic-site bottom sheet.
 * Reuses the exact approved DOM content built by SengokuPinDisplay.
 * Never modifies site data, map center/zoom, card acquisition or other popups.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SengokuPinSheet=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MOBILE_QUERY='(max-width: 700px), (pointer: coarse) and (max-width: 1024px)';
 function create({document,window,map,renderContent,statusFor}){
  const mq=window.matchMedia(MOBILE_QUERY),body=document.body,html=document.documentElement;
  const root=document.createElement('section');
  root.id='sengokuPinSheet';root.className='sengoku-pin-sheet';
  root.hidden=true;root.setAttribute('role','dialog');
  // Nonmodal: the visible part of the map stays tappable for replacement pins and closing.
  root.setAttribute('aria-modal','false');
  root.setAttribute('aria-labelledby','sengokuPinSheetTitle');
  root.setAttribute('aria-label','史跡詳細');
  const panel=document.createElement('div');panel.className='sps-panel';
  const header=document.createElement('div');header.className='sps-header';
  const textBox=document.createElement('div');textBox.className='sps-title-group';
  const title=document.createElement('h2');title.id='sengokuPinSheetTitle';title.className='sps-title';
  const danger=document.createElement('span');danger.className='sps-risk';danger.hidden=true;
  danger.textContent='危険・立入制限あり';
  textBox.append(title,danger);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='sps-close';
  closeButton.setAttribute('aria-label','史跡詳細を閉じる');
  closeButton.textContent='×';
  header.append(textBox,closeButton);
  const scroll=document.createElement('div');scroll.className='sps-scroll';
  scroll.setAttribute('tabindex','0');scroll.setAttribute('aria-label','史跡の説明・見学上の注意・出典');
  panel.append(header,scroll);root.append(panel);body.append(root);
  let activeId=null,lock=null;
  const isMobile=()=>mq.matches;
  const isOpen=()=>!root.hidden;
  function viewport(){
   const vv=window.visualViewport,h=vv?.height||window.innerHeight;
   const bottom=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;
   root.style.setProperty('--sps-max-height',Math.max(160,Math.floor(h*.74))+'px');
   root.style.setProperty('--sps-bottom-gap',Math.floor(bottom)+'px');
  }
  function preventPageScroll(){
   if(lock)return;
   lock={x:window.scrollX,y:window.scrollY,
    position:body.style.position,top:body.style.top,left:body.style.left,
    right:body.style.right,width:body.style.width,overflow:body.style.overflow,
    htmlOverflow:html.style.overflow};
   html.style.overflow='hidden';
   body.style.overflow='hidden';body.style.position='fixed';
   body.style.top= -lock.y+'px';body.style.left='0';body.style.right='0';body.style.width='100%';
   body.classList.add('sps-page-locked');
  }
  function restorePageScroll(){
   if(!lock)return;
   const old=lock;lock=null;
   html.style.overflow=old.htmlOverflow;
   body.style.position=old.position;body.style.top=old.top;
   body.style.left=old.left;body.style.right=old.right;body.style.width=old.width;
   body.style.overflow=old.overflow;body.classList.remove('sps-page-locked');
   window.scrollTo(old.x,old.y);
  }
  function close(){
   if(root.hidden)return false;
   root.hidden=true;root.classList.remove('is-open');
   activeId=null;scroll.replaceChildren();title.textContent='';
   document.querySelector('.mapwrap')?.classList.remove('map-info-popup-open');
   restorePageScroll();
   return true;
  }
  function open(site){
   if(!site?.siteId)return false;
   // The existing source renderer constructs links and paragraphs from text nodes.
   const popup=renderContent(site);
   const sourceTitle=popup.querySelector('h3');
   title.textContent=sourceTitle?.textContent||site.name;
   sourceTitle?.remove();
   scroll.replaceChildren(popup);
   scroll.scrollTop=0;
   danger.hidden=statusFor(site)!=='red';
   activeId=site.siteId;
   viewport();
   map.closePopup();
   preventPageScroll();
   root.hidden=false;root.classList.remove('is-open');
   root.classList.add('is-open');
   document.querySelector('.mapwrap')?.classList.add('map-info-popup-open');
   closeButton.focus({preventScroll:true});
   return true;
  }
  closeButton.addEventListener('click',close);
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&isOpen()){event.preventDefault();close();}
  });
  // Leaflet receives background-map taps; historic markers suppress map click bubbling.
  map.on('click',()=>{if(isOpen())close()});
  // Viewport breakpoints now change presentation width only, never close the shared sheet.
  function changeMode(){if(isOpen())viewport();}
  if(typeof mq.addEventListener==='function')mq.addEventListener('change',changeMode);
  else mq.addListener?.(changeMode);
  window.addEventListener('resize',()=>{if(isOpen())viewport();});
  window.visualViewport?.addEventListener('resize',()=>{if(isOpen())viewport();});
  window.visualViewport?.addEventListener('scroll',()=>{if(isOpen())viewport();});
  return {isMobile,isOpen,open,close,get activeSiteId(){return activeId},element:root,scrollElement:scroll,
   updateViewport:viewport};
 }
 return {create,MOBILE_QUERY};
});

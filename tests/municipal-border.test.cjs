const {test}=require('node:test');
const assert=require('node:assert/strict');
const {app,raw}=require('./support/app.cjs');

const visits={
 walked_municipal_v2:{
  '13209':{first:'2024-01-01',last:'2024-01-01',source:'手動'},
  'n:13209:1320900101':{first:'2024-01-01',last:'2024-01-01',source:'タイムライン'}
 },
 walked_sengoku_cards_v1:{'kept-card':{at:'2024-01-01'}},
 walked_titles_v1:{awards:{'national-1':{acquiredAt:'2024-01-01'}},selected:'national-1'}
};

test('nationwideDetail draws TopoJSON municipality outlines above town fills, below prefecture boundaries',async()=>{
 const w=await app(visits);
 try{
  assert.equal(w.eval('municipalBoundaryMesh?.type'),'MultiLineString');
  assert.ok(w.eval('municipalBoundaryMesh?.coordinates?.length')>50);
  assert.equal(w.eval('municipalBorderGroup'),null,'municipality outlines should not affect nearby mode');
  const before=raw(w),geoJSON=w.L.geoJSON;
  w.borderFront=[],w.borderOptions=null;
  w.L.geoJSON=(features,options)=>{
   const layer=geoJSON(features,options);
   if(Array.isArray(features)&&features.length===1&&features[0]?.geometry?.type==='MultiLineString'){
    w.borderOptions=options;
    layer.bringToFront=()=>w.borderFront.push('municipal');
   }else if(options?.style?.weight===2.5&&options?.interactive===false){
    layer.bringToFront=()=>w.borderFront.push('prefecture');
   }
   return layer;
  };
  w.eval("state.prefFeatures=[{id:'13',type:'Feature',properties:{name:'東京都'},geometry:{type:'Polygon',coordinates:[]}}];changeMode('nationwideDetail')");
  assert.ok(w.eval('!!municipalBorderGroup'));
  assert.equal(w.borderOptions.interactive,false,'outline must never intercept site pins, dragging or town clicks');
  assert.equal(w.borderOptions.style.fill,false,'municipality outline is not a filled municipality polygon');
  assert.ok(w.borderOptions.style.weight>0.95&&w.borderOptions.style.weight<2.5);
  w.borderFront.length=0;
  await w.eval('updateDetailViewport()');
  assert.deepEqual(w.borderFront.slice(-2),['municipal','prefecture'],'refresh town detail, then repaint municipality, then prefecture');
  assert.deepEqual(raw(w),before,'outlined boundary must not mutate visit/card/title storage');
  w.eval("changeMode('nearby')");
  assert.equal(w.eval('municipalBorderGroup'),null,'outline removed when switching modes');
  w.eval("changeMode('municipal')");
  assert.equal(w.eval('municipalBorderGroup'),null);
 }finally{w.close();}
});

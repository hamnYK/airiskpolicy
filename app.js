'use strict';
(async()=>{
const status=document.getElementById('status');
if(location.protocol==='file:'){status.textContent='Open https://www.aipolicy.world/ to explore the globe.';const link=document.createElement('a');link.href='https://www.aipolicy.world/';link.textContent=' Open website';status.append(link);return;}
const detectedCountry=window.aiRiskVisitorCountry=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),4500);try{const response=await fetch('https://api.country.is/',{signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)return null;const data=await response.json();return typeof data.country==='string'&&/^[A-Z]{2}$/.test(data.country)?data.country:null}catch{return null}finally{clearTimeout(timer)}})();
let userInteracted=false;document.getElementById('globe').addEventListener('pointerdown',()=>{userInteracted=true});document.getElementById('globe').addEventListener('wheel',()=>{userInteracted=true},{passive:true});document.getElementById('reset').addEventListener('click',()=>{userInteracted=true});
try{
const C=window.Cesium;if(!C)throw new Error('CesiumJS를 불러오지 못했습니다.');C.Ion.defaultAccessToken='';
// No ion services or assets are used. Keep data-provider credits available.
C.CreditDisplay.cesiumCredit=undefined;
const viewer=new C.Viewer('globe',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:new C.SkyAtmosphere(),terrainProvider:new C.EllipsoidTerrainProvider(),requestRenderMode:true,maximumRenderTimeChange:Infinity});window.gisViewer=viewer;
const design=getComputedStyle(document.documentElement);
viewer.scene.backgroundColor=C.Color.fromCssColorString(design.getPropertyValue('--ds-background').trim());viewer.scene.globe.baseColor=C.Color.fromCssColorString('#17344d');viewer.scene.globe.enableLighting=false;
viewer.scene.screenSpaceCameraController.minimumZoomDistance=250000;viewer.scene.screenSpaceCameraController.maximumZoomDistance=40000000;
// Let wheel and trackpad scrolling reach the page without Cesium consuming it.
const globe=document.getElementById('globe');
globe.addEventListener('wheel',event=>event.stopPropagation(),{capture:true,passive:true});
viewer.scene.screenSpaceCameraController.zoomEventTypes=[C.CameraEventType.PINCH];
viewer.scene.screenSpaceCameraController.tiltEventTypes=[C.CameraEventType.MIDDLE_DRAG,C.CameraEventType.PINCH,{eventType:C.CameraEventType.LEFT_DRAG,modifier:C.KeyboardEventModifier.CTRL}];
function zoomByFactor(factor){userInteracted=true;const height=viewer.camera.positionCartographic.height;const target=Math.max(250000,Math.min(40000000,height*factor));if(target<height)viewer.camera.zoomIn(height-target);else if(target>height)viewer.camera.zoomOut(target-height);viewer.scene.requestRender();}
// Right-drag changes distance along the camera direction, never its orientation.
let rightDrag=null,suppressContextUntil=0;
const canvas=viewer.canvas;
canvas.addEventListener('pointerdown',event=>{if(event.button!==2)return;rightDrag={id:event.pointerId,x:event.clientX,y:event.clientY,lastY:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);event.stopPropagation();},{capture:true});
canvas.addEventListener('pointermove',event=>{if(!rightDrag||event.pointerId!==rightDrag.id)return;event.stopPropagation();const dy=event.clientY-rightDrag.lastY;rightDrag.lastY=event.clientY;if(Math.hypot(event.clientX-rightDrag.x,event.clientY-rightDrag.y)>4)rightDrag.moved=true;if(dy!==0)zoomByFactor(Math.exp(-dy*0.006));},{capture:true});
function endRightDrag(event){if(!rightDrag||event.pointerId!==rightDrag.id)return;event.stopPropagation();if(rightDrag.moved)suppressContextUntil=performance.now()+600;rightDrag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}
canvas.addEventListener('pointerup',endRightDrag,{capture:true});canvas.addEventListener('pointercancel',endRightDrag,{capture:true});canvas.addEventListener('lostpointercapture',()=>{rightDrag=null});
canvas.addEventListener('contextmenu',event=>{if(rightDrag?.moved||performance.now()<suppressContextUntil)event.preventDefault();});
const zoomControls=document.createElement('div');zoomControls.className='map-zoom-controls';zoomControls.setAttribute('role','group');zoomControls.setAttribute('aria-label','지도 확대·축소');
for(const [direction,label,symbol] of [[1,'지도 확대','+'],[-1,'지도 축소','−']]){const button=document.createElement('button');button.type='button';button.textContent=symbol;button.setAttribute('aria-label',label);button.id=direction===1?'map-zoom-in':'map-zoom-out';button.onclick=()=>zoomByFactor(direction===1?0.75:1.3333333333);zoomControls.append(button)}
document.querySelector('.map-controls').insertBefore(zoomControls,document.getElementById('reset'));

function reset(){viewer.camera.setView({destination:C.Cartesian3.fromDegrees(127,25,19000000),orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0}});viewer.scene.requestRender();}
document.getElementById('reset').addEventListener('click',reset);reset();
const countries=await C.GeoJsonDataSource.load('assets/countries.geojson',{stroke:C.Color.fromCssColorString('#203c50'),strokeWidth:1,fill:C.Color.fromCssColorString('#aec6ce'),clampToGround:false});
const palette=['#9fc7bb','#c8c4a6','#abc5da','#c6b4c9','#aac3a0','#d5ba9f','#a9bbcb','#c7cdb4'];
for(const entity of countries.entities.values){if(!entity.polygon)continue;const props=entity.properties;const group=Number(props?.MAPCOLOR8?.getValue())||1;entity.polygon.material=C.Color.fromCssColorString(palette[(group-1)%palette.length]);entity.polygon.height=0;entity.polygon.outline=true;entity.polygon.outlineColor=C.Color.fromCssColorString('#294458');entity.name=props?.NAME_KO?.getValue()||entity.name;}
await viewer.dataSources.add(countries);window.gisCountries=countries;
const selectedName=document.createElement('output');selectedName.id='selected-country';selectedName.setAttribute('aria-live','polite');selectedName.hidden=true;document.getElementById('observatory').append(selectedName);
const groups=new Map(),originalMaterials=new Map();
for(const entity of countries.entities.values){if(!entity.polygon)continue;const key=entity.properties?.ADM0_A3?.getValue()||entity.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entity);originalMaterials.set(entity.id,entity.polygon.material);}
let selected=[];
function selectCountry(entity){for(const item of selected)item.polygon.material=originalMaterials.get(item.id);selected=[];
if(entity?.polygon&&originalMaterials.has(entity.id)){const key=entity.properties?.ADM0_A3?.getValue()||entity.name;selected=groups.get(key)||[entity];for(const item of selected)item.polygon.material=C.Color.fromCssColorString(design.getPropertyValue('--ds-country-selected').trim());selectedName.textContent=entity.name;selectedName.hidden=false;document.body.dataset.selectedCountry=key;}
else{selectedName.hidden=true;selectedName.textContent='';delete document.body.dataset.selectedCountry;}
document.dispatchEvent(new CustomEvent('gis:country-selected',{detail:selected.length?{code:document.body.dataset.selectedCountry,aimCode:/^[A-Z]{3}$/.test(entity.properties?.ISO_A3?.getValue())?entity.properties.ISO_A3.getValue():document.body.dataset.selectedCountry,name:selectedName.textContent}:null}));
viewer.scene.requestRender();}
viewer.screenSpaceEventHandler.setInputAction(event=>{const picked=viewer.scene.pick(event.position);selectCountry(picked?.id);},C.ScreenSpaceEventType.LEFT_CLICK);
viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
document.getElementById('reset').addEventListener('click',()=>selectCountry(null));
viewer.scene.requestRender();status.hidden=true;document.body.dataset.gisReady='true';
const detected=await detectedCountry;
if(!userInteracted){const entities=countries.entities.values;let target=detected?entities.find(e=>e.polygon&&e.properties?.ISO_A2?.getValue()===detected):null;if(!target&&detected)target=entities.find(e=>e.polygon&&e.properties?.ISO_A2_EH?.getValue()===detected);const matched=Boolean(target);target=target||entities.find(e=>e.polygon&&e.properties?.ADM0_A3?.getValue()==='KOR');selectCountry(target);if(target){const x=Number(target.properties?.LABEL_X?.getValue()),y=Number(target.properties?.LABEL_Y?.getValue());if(Number.isFinite(x)&&Number.isFinite(y))viewer.camera.setView({destination:C.Cartesian3.fromDegrees(x,y,19000000),orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0}});}document.body.dataset.initialCountrySource=matched?'ip':'fallback';viewer.scene.requestRender();}
else if(!selected.length){document.dispatchEvent(new CustomEvent('gis:country-selected',{detail:null}));}
document.body.dataset.countryInitialized='true';
viewer.scene.renderError.addEventListener(()=>{status.hidden=false;status.textContent='3D 렌더링 오류가 발생했습니다. 브라우저의 하드웨어 가속 설정을 확인해 주세요.';});
}catch(e){status.hidden=false;status.textContent='지구를 표시하지 못했습니다. '+e.message;document.body.dataset.gisError='true';}
})();
'use strict';
document.addEventListener('contextmenu',event=>event.preventDefault());
(async()=>{
const status=document.getElementById('status');
if(location.protocol==='file:'){status.textContent='이 폴더의 preview.cmd를 더블클릭하면 GIS 화면이 열립니다. ';const link=document.createElement('a');link.href='http://localhost:4175/';link.textContent='실행 중인 GIS 열기';link.style.cssText='color:#9fcaff;pointer-events:auto;text-decoration:underline';status.append(link);return;}
try{
const C=window.Cesium;if(!C)throw new Error('CesiumJS를 불러오지 못했습니다.');C.Ion.defaultAccessToken='';
const viewer=new C.Viewer('globe',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:new C.SkyAtmosphere(),terrainProvider:new C.EllipsoidTerrainProvider(),requestRenderMode:true,maximumRenderTimeChange:Infinity});window.gisViewer=viewer;
viewer.scene.backgroundColor=C.Color.fromCssColorString('#08131f');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#17344d');viewer.scene.globe.enableLighting=false;
viewer.scene.screenSpaceCameraController.minimumZoomDistance=250000;viewer.scene.screenSpaceCameraController.maximumZoomDistance=40000000;
// Retain left-drag rotation, wheel zoom and touch; exclude right-drag zoom.
viewer.scene.screenSpaceCameraController.zoomEventTypes=[C.CameraEventType.WHEEL,C.CameraEventType.PINCH];
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
if(entity?.polygon&&originalMaterials.has(entity.id)){const key=entity.properties?.ADM0_A3?.getValue()||entity.name;selected=groups.get(key)||[entity];for(const item of selected)item.polygon.material=C.Color.fromCssColorString('#f5cf69');selectedName.textContent=entity.name;selectedName.hidden=false;document.body.dataset.selectedCountry=key;}
else{selectedName.hidden=true;selectedName.textContent='';delete document.body.dataset.selectedCountry;}
document.dispatchEvent(new CustomEvent('gis:country-selected',{detail:selected.length?{code:document.body.dataset.selectedCountry,aimCode:/^[A-Z]{3}$/.test(entity.properties?.ISO_A3?.getValue())?entity.properties.ISO_A3.getValue():document.body.dataset.selectedCountry,name:selectedName.textContent}:null}));
viewer.scene.requestRender();}
viewer.screenSpaceEventHandler.setInputAction(event=>{const picked=viewer.scene.pick(event.position);selectCountry(picked?.id);},C.ScreenSpaceEventType.LEFT_CLICK);
viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
document.getElementById('reset').addEventListener('click',()=>selectCountry(null));
viewer.scene.frameState.creditDisplay.addStaticCredit(new C.Credit('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth · 1:50m · 경계는 원자료 기준</a>',true));
viewer.scene.requestRender();status.hidden=true;document.body.dataset.gisReady='true';selectCountry(countries.entities.values.find(e=>e.properties?.ADM0_A3?.getValue()==='KOR'&&e.polygon));
viewer.scene.renderError.addEventListener(()=>{status.hidden=false;status.textContent='3D 렌더링 오류가 발생했습니다. 브라우저의 하드웨어 가속 설정을 확인해 주세요.';});
}catch(e){status.hidden=false;status.textContent='지구를 표시하지 못했습니다. '+e.message;document.body.dataset.gisError='true';}
})();
'use strict';
(async()=>{
const status=document.getElementById('status');
if(location.protocol==='file:'){status.textContent='이 폴더의 preview.cmd를 더블클릭하면 GIS 화면이 열립니다. ';const link=document.createElement('a');link.href='http://localhost:4175/';link.textContent='실행 중인 GIS 열기';link.style.cssText='color:#9fcaff;pointer-events:auto;text-decoration:underline';status.append(link);return;}
try{
const C=window.Cesium;if(!C)throw new Error('CesiumJS를 불러오지 못했습니다.');C.Ion.defaultAccessToken='';
const viewer=new C.Viewer('globe',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:new C.SkyAtmosphere(),terrainProvider:new C.EllipsoidTerrainProvider(),requestRenderMode:true,maximumRenderTimeChange:Infinity});window.gisViewer=viewer;
viewer.scene.backgroundColor=C.Color.fromCssColorString('#08131f');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#17344d');viewer.scene.globe.enableLighting=false;
viewer.scene.screenSpaceCameraController.minimumZoomDistance=250000;viewer.scene.screenSpaceCameraController.maximumZoomDistance=40000000;
function reset(){viewer.camera.setView({destination:C.Cartesian3.fromDegrees(127,25,19000000),orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0}});viewer.scene.requestRender();}
document.getElementById('reset').addEventListener('click',reset);reset();
const image=await C.SingleTileImageryProvider.fromUrl('assets/earth.jpg',{credit:new C.Credit('<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noopener">NASA Blue Marble (2004) · 지형 음영 영상 / 고도 미적용</a>',true)});
viewer.imageryLayers.addImageryProvider(image);viewer.scene.requestRender();status.hidden=true;document.body.dataset.gisReady='true';
viewer.scene.renderError.addEventListener(()=>{status.hidden=false;status.textContent='3D 렌더링 오류가 발생했습니다. 브라우저의 하드웨어 가속 설정을 확인해 주세요.';});
}catch(e){status.hidden=false;status.textContent='지구를 표시하지 못했습니다. '+e.message;document.body.dataset.gisError='true';}
})();
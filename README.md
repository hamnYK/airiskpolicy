# AI RISK — GIS base

정책 UI 없이 3D 지구만 확인하는 기반 프로토타입입니다.

## 실행

Windows에서는 preview.cmd를 더블클릭하세요. 서버가 이미 실행 중이면 재사용하고 기본 브라우저로 GIS를 엽니다.

이 폴더에서 `npm install` 후 `npm start`를 실행하고 http://localhost:4175 로 접속합니다. file:// 직접 열기는 지원하지 않습니다.

## 구성

- CesiumJS 1.146.0, Apache-2.0
- NASA Blue Marble Next Generation: 2004년 12월 합성 영상
- 영상 원본: https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg
- 출처: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- 엔진과 영상은 로컬에서 제공하며 Cesium ion 토큰이나 유료 API를 사용하지 않습니다.
- WGS84 타원체 위 영상입니다. 실제 지형 고도, 최신 위성영상, 국경 데이터, AI 위험·정책 데이터/API는 아직 없습니다.
- 회전, 확대/축소, 초기 위치 복귀 지원.

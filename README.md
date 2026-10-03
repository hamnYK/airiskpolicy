# AI RISK — GIS base

3D 정치지도와 OECD AIM의 국가별 사건·잠재위험을 탐색하는 프로토타입입니다. 정책 정보는 아직 연결하지 않았습니다.

## 실행

Windows에서는 preview.cmd를 더블클릭하세요. 서버가 이미 실행 중이면 재사용하고 기본 브라우저로 GIS를 엽니다.

이 폴더에서 `npm install` 후 `npm start`를 실행하고 http://localhost:4175 로 접속합니다. file:// 직접 열기는 지원하지 않습니다.

## 구성

- CesiumJS 1.146.0, Apache-2.0
- NASA Blue Marble Next Generation: 2004년 12월 합성 영상
- 영상 원본: https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg
- 출처: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- 엔진과 영상은 로컬에서 제공하며 Cesium ion 토큰이나 유료 API를 사용하지 않습니다.
- WGS84 타원체를 사용합니다. 실제 지형 고도와 최신 위성영상은 제공하지 않습니다.
- 회전, 확대/축소, 초기 위치 복귀 지원.

## 정치지도

현재 기본 지도는 Natural Earth 1:50m Admin-0 Countries(퍼블릭 도메인)입니다. 국가·지역별 단색 면과 경계선을 표시하며 MAPCOLOR8 분류로 인접 영역 색상을 구분합니다. 색상은 AI 위험이나 정책 등급을 뜻하지 않습니다. 경계·분쟁 지역 표현은 원자료 기준이고 미세한 섬·소국은 축척상 생략될 수 있습니다. NASA 영상은 원본 자산으로만 보관하고 화면에서는 불러오지 않습니다.

- 데이터: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- 이용 조건: https://www.naturalearthdata.com/about/terms-of-use/

## AIM 위험 정보 탐색

- 국가를 선택하면 AIM 검색 전체 건수, 사건·잠재위험 건수를 각각 조회합니다. 위험 점수나 실제 발생 사건의 전수 통계가 아닙니다.
- 최신 100개 수신 기록에서 피해 유형, 산업 분야, 피해 대상, AI 원칙, AI 작업별 분류를 집계합니다. 복수 분류는 중복 집계되며 전체 기록의 분류 분포를 뜻하지 않습니다.
- 사건/잠재위험과 분류 막대를 선택하면 관련 기록 및 표본의 월별 분포가 함께 변경됩니다. 기사 수는 수신 기록에 연결된 기사 수 합계이며 중복될 수 있습니다.
- 원문 제목을 누르면 OECD AIM 상세 페이지가 열립니다. 분류명은 한국어로 표시하되 새 분류는 원문을 유지합니다.
- 국가를 선택하면 AIM 국가 목록과 대조하여 조회합니다. ISO_A3 코드가 없으면 지도 ADM0_A3를 사용하며, 지원 목록에 없는 지역은 다른 국가로 합산하지 않습니다. 국가별 세션 캐시는 1시간이며 다시 조회 버튼으로 갱신할 수 있습니다.
- API 실패 시 수치를 0으로 대체하지 않습니다. 동작 줄이기 설정에서는 애니메이션을 생략합니다.
- AIM 분류·요약은 AI로 생성되며 OECD의 사실 확인이나 보증을 뜻하지 않습니다.
- 방법론: https://oecd.ai/en/incidents-methodology
- 공개 웹 서비스 API: https://incidents-server.oecdai.org/api/v1/incidents/fetch-incidents (POST). 고정된 API 제공 계약이나 가용성을 보장하지 않으므로 운영 전 변경·이용 조건을 재확인해야 합니다.

## 단계별 탐색 프로토타입

첫 화면은 전체 집계와 최신 표본의 주요 피해 유형을 표시합니다. 관심 관점 선택 → 분류·사건 탐색 → 사건 요약 및 AIM 출처 → 논의 질문 작성·복사로 이어집니다. 관심 선택은 선택 사항이며 계정이나 서버 저장 없이 동작합니다. 정책 영역은 질문을 제시하는 준비 화면이며 정책 평가 데이터는 없습니다. 커뮤니티 가입·게시 기능은 아직 연결하지 않았습니다. 모든 대화상자는 닫기 버튼으로 닫으며 바깥 클릭과 Escape로 닫히지 않습니다.

국가 목록 미지원, 선택 기간 0건, API 오류를 구분합니다. 국가 전환 시 이전 요청을 취소하고 오래된 응답은 반영하지 않습니다. 자연지리 지도와 AIM의 지역 구분이 달라 지도에서 개별 선택할 수 없는 AIM 항목이 있을 수 있습니다.

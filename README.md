# AI Policy for All Risks — Global AI Risk & Policy

3D 정치지도와 OECD AIM의 국가별 사건·잠재위험을 탐색하는 프로토타입입니다. OECD 정책 현황과 사건에서 정책·근거·조사 질문으로 이어지는 여정을 제공합니다.

## 주간 TOP 10 브리핑

공개 화면의 `주간 TOP 10` 버튼으로 RISK / POLICY 탭을 열 수 있습니다. 관리자 발행본만 공개하며, 각 탭에 최대 10개 이슈와 실제 선정 건수를 표시합니다. 빈 탭에는 선정 이슈 없음 안내를 표시합니다. 발행본이 없으면 팝업을 자동으로 띄우지 않습니다. 새 발행본은 처음 방문할 때 자동으로 열리고, 닫으면 해당 브라우저에 확인 상태를 저장합니다. 버튼으로 다시 열 수 있습니다. 보도량·통계 위험 순위가 아닌 관리자 선정 순서입니다.

관리자 로그인 후 기존 온톨로지 편집 페이지의 **주간 TOP 10** 탭에서 검토합니다. RISK·POLICY별 후보 추가/직접 작성, 순서 조정, 원출처와 선정 이유·변화·위험/정책 연결·다음 주 관찰 신호 편집, 검토 완료 체크, 초안 저장, 발행 확인 순서입니다. 초안 저장은 비공개이며 각 탭 최대 10개, 전체 최소 1개의 이슈를 검토하면 발행됩니다. 한 탭이 비어 있어도 발행할 수 있습니다. 내용 수정 시 검토 완료가 해제됩니다. AI는 저장한 핵심 질문에 따라 수집 후보 중 관련 건만 중요도 순으로 선정하고 내용을 작성합니다. 관리자 AI API 설정은 아래와 같이 별도로 관리합니다.

후보는 매주 월요일 06:00 한국시간에 직전 월요일~일요일 기간으로 수집합니다. Supabase Cron + Vault + `weekly-collect` 함수가 처리하며 브라우저를 열어둘 필요가 없습니다. 관리자도 같은 주를 다시 수집할 수 있고, 이 작업은 초안·발행본을 덮어쓰지 않습니다. 실패 시 기존 후보를 보존합니다.

- RISK: OECD AIM의 해당 기간 최신 100건 표본. 관련 기사 수와 날짜 순으로 후보 정렬. 기사 중복 가능성이 있으며, 전체 위험의 중요도를 나타내지 않습니다.
- POLICY: OECD 정책 목록 전체 페이지를 조회한 뒤 `updatedAt`이 해당 주인 후보 최대 100개. 등록정보 갱신일은 발표일·시행일이 아니므로 관리자가 원문을 확인해야 합니다.
- 다른 정책 발표·공식 문서도 직접 추가할 수 있습니다. 후보에 없다는 이유로 위험이나 정책의 부재로 해석하지 않습니다. 외부 API 구조·가용성은 변경될 수 있습니다.

서버 설치: `202610050002_weekly_briefing.sql`, `weekly-collect` Edge Function, `202610050003_weekly_schedule.sql` 순으로 적용한 뒤 `202610050004_weekly_flexible_counts.sql`을 적용합니다. 함수의 `WEEKLY_COLLECTOR_SECRET`과 Vault의 `airisk_weekly_collector_secret`은 같은 무작위 서버 비밀값을 별도로 설정합니다. 프런트엔드·Git에는 넣지 않습니다. 기본 JWT 게이트웨이 검증은 끄되 함수 안에서 관리자 Auth+권한 또는 예약 작업용 비밀값을 확인합니다. Cron 작업명은 `airisk-weekly-candidates`입니다. AI Risk 프로젝트(`jiyngdwpdmpjiwdnyanb`) 전용이며 Contexton 프로젝트와 별개입니다.

검사: `npm test`, 빌드 후 `node scripts/weekly-ui.cjs`. 실제 수집 후보와 테스트용 발행 데이터는 구분합니다. 테스트용 브리핑은 운영 서버에 발행하지 않습니다.

## 로컬 실행

배포 사이트: https://www.aipolicy.world/ — 방문자는 별도 프로그램이나 CMD 실행 없이 접속합니다.

이 폴더에서 `npm install` 후 `npm start`를 실행하고 http://localhost:4175 로 접속합니다. file:// 직접 열기는 지원하지 않습니다.

## 구성

- CesiumJS 1.146.0, Apache-2.0
- 엔진과 국가 경계 데이터는 사이트에서 제공하며 Cesium ion 토큰이나 유료 API를 사용하지 않습니다.
- WGS84 타원체를 사용합니다. 실제 지형 고도와 최신 위성영상은 제공하지 않습니다.
- 회전, 확대/축소, 초기 위치 복귀 지원.

## 정치지도

현재 기본 지도는 Natural Earth 1:50m Admin-0 Countries(퍼블릭 도메인)입니다. 국가·지역별 단색 면과 경계선을 표시하며 MAPCOLOR8 분류로 인접 영역 색상을 구분합니다. 색상은 AI 위험이나 정책 등급을 뜻하지 않습니다. 경계·분쟁 지역 표현은 원자료 기준이고 미세한 섬·소국은 축척상 생략될 수 있습니다. 사용하지 않는 NASA 위성 이미지는 제거했습니다.

- 데이터: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- 이용 조건: https://www.naturalearthdata.com/about/terms-of-use/

## AIM 위험 정보 탐색

- 국가를 선택하면 AIM 검색 전체 건수, 사건·잠재위험 건수를 각각 조회합니다. 위험 점수나 실제 발생 사건의 전수 통계가 아닙니다.
- 최신 100개 수신 기록에서 피해 유형, 산업 분야, 피해 대상, AI 원칙, AI 작업별 분류를 집계합니다. 복수 분류는 중복 집계되며 전체 기록의 분류 분포를 뜻하지 않습니다.
- 사건/잠재위험과 분류 막대를 선택하면 관련 기록 및 표본의 월별 분포가 함께 변경됩니다. 기사 수는 수신 기록에 연결된 기사 수 합계이며 중복될 수 있습니다.
- 사건 상세 보기 버튼을 누르면 내부 상세 모달이 열리고 대응 정책 확인으로 이어집니다. 분류명은 한국어로 표시하되 새 분류는 원문을 유지합니다.
- 국가를 선택하면 AIM 국가 목록과 대조하여 조회합니다. ISO_A3 코드가 없으면 지도 ADM0_A3를 사용하며, 지원 목록에 없는 지역은 다른 국가로 합산하지 않습니다. 국가별 세션 캐시는 1시간이며 다시 조회 버튼으로 갱신할 수 있습니다.
- API 실패 시 수치를 0으로 대체하지 않습니다. 동작 줄이기 설정에서는 애니메이션을 생략합니다.
- AIM 분류·요약은 AI로 생성되며 OECD의 사실 확인이나 보증을 뜻하지 않습니다.
- 방법론: https://oecd.ai/en/incidents-methodology
- 공개 웹 서비스 API: https://incidents-server.oecdai.org/api/v1/incidents/fetch-incidents (POST). 고정된 API 제공 계약이나 가용성을 보장하지 않으므로 운영 전 변경·이용 조건을 재확인해야 합니다.

## 단계별 탐색 프로토타입

첫 화면은 전체 집계와 최신 표본의 주요 피해 유형을 표시합니다. 관심 관점 선택 → 분류·사건 탐색 → 사건 요약 및 AIM 출처 → 논의 질문 작성·복사로 이어집니다. 관심 선택은 선택 사항이며 계정이나 서버 저장 없이 동작합니다. 정책 영역은 OECD 등록 정책을 표시하며, 정책 효과를 평가한 점수는 제공하지 않습니다. 커뮤니티 가입·게시 기능은 아직 연결하지 않았습니다. 모든 대화상자는 닫기 버튼으로 닫으며 바깥 클릭과 Escape로 닫히지 않습니다.

국가 목록 미지원, 선택 기간 0건, API 오류를 구분합니다. 국가 전환 시 이전 요청을 취소하고 오래된 응답은 반영하지 않습니다. 자연지리 지도와 AIM의 지역 구분이 달라 지도에서 개별 선택할 수 없는 AIM 항목이 있을 수 있습니다.

## 연결된 질문 여정

관심 분야 또는 개별 사건에서 질문을 남기면 국가·사건·출처를 개인 기록에 유지합니다. 같은 기록에서 조사 메모 → 정책 논의안 → 논의 분야 선택 → JSON 내려받기를 이어갑니다. localStorage의 ai-risk-local-inquiries-v1에 최대 100개 개인 기록을 저장하며 삭제는 명시적 두 번 클릭으로 확인합니다. 운영자 접수·실제 조사·단체 전달·공개 게시 기능은 없습니다. 분야 안내는 선택 사건의 분류를 참고하는 역할 안내이며 실제 단체 추천이 아닙니다. 국가 확인의 실시간 외부 호출은 승인 대기 중이고, 이번 사용자 여정 검증에서는 외부 요청을 모두 모의 응답 또는 차단했습니다.

## 국문·영문 SEO

`seo.json`에 각국의 대표 커뮤니티를 통한 글로벌 연대라는 목표에 맞춘 제목, 검색 설명, 소개 문구를 저장했습니다. 기본 영문 화면에 영문 제목·description·Open Graph·Twitter 카드·WebSite 구조화 데이터를 적용했습니다. 한국어·English 토글로 같은 페이지의 인터페이스와 검색·공유 메타데이터를 전환합니다. 별도 영문 URL은 아직 없습니다.

canonical과 og:url은 https://www.aipolicy.world/입니다. 별도 언어 URL이 없어 hreflang은 설정하지 않습니다. 아직 구성되지 않은 글로벌 연대의 회원·파트너·성과를 구조화 데이터에 기재하지 않습니다. `seo.json` 변경 시 index.html의 메타데이터도 함께 갱신해야 합니다.

## 언어 전환

기본 언어는 영어입니다. 기존 접속 국가 조회 결과가 KR인 경우에만 지도 조작 버튼 옆의 한국어·English 버튼을 표시합니다. 국내에서는 이전에 선택한 언어를 localStorage의 `ai-risk-language`에서 복원합니다. 해외 접속이나 국가 확인 실패 시에는 저장된 한국어 선택이 있어도 영어로 표시합니다. 지도에서 선택한 국가와 언어 버튼의 표시 여부는 서로 독립적이며 별도의 IP 조회를 추가하지 않습니다. `i18n-en.json`은 영문 문구 사전이고 `i18n.js`는 동적으로 생성되는 화면과 접근성 레이블을 번역합니다. 필터 판단에는 번역 전 값을 사용합니다. 사용자 입력·저장된 글·AIM 원문 제목과 요약은 자동 번역하지 않습니다. 새 화면 문구를 추가할 때 사전과 양쪽 언어를 함께 점검합니다. 영어 국가명은 현재 지도의 Natural Earth NAME_EN 값을 사용합니다.

## 지도와 페이지 스크롤

지도 위 휠·트랙패드 스크롤은 페이지 이동에 사용합니다. 지도의 + / − 버튼으로 확대·축소하며, 마우스 드래그 회전과 국가 클릭은 유지합니다. Cesium의 휠 기본 동작을 캡처 단계에서 차단하되 브라우저 스크롤은 막지 않습니다.

오른쪽 드래그는 세로 이동량만 확대·축소에 사용하며 가로 이동으로 회전하지 않습니다. 아래로 드래그하면 확대, 위로 드래그하면 축소합니다. 왼쪽 드래그로 회전합니다. 드래그 직후에만 컨텍스트 메뉴를 억제하며 일반 우클릭 메뉴는 유지합니다.

## 디자인 시스템 v1.2

`design-system.html`에서 정의와 실제 구성요소를 확인합니다. `design-system.css`를 앱과 정의 페이지가 함께 사용하며, 색상·타이포그래피·간격·높이·모서리·초점·주요/보조 버튼·이동 링크·칩·폼·모달 규칙의 기준 파일입니다. 기존 CSS는 화면별 배치를 맡고 공통 값은 토큰을 참조합니다. 조작 가이드는 화면 위쪽, 이어하기는 보조 버튼, 돌아가기/출처는 링크로 구분합니다. 로딩/조회 실패/빈 결과는 `data-state`로 구분합니다.

공통 UI 변경 시 design-system.css ▶ 디자인 시스템 페이지와 실제 화면 ▶ 한영/모바일/키보드/모달 확인 순으로 점검합니다. 새 문구는 i18n-en.json 또는 해당 컴포넌트의 KO/EN 문자열을 함께 갱신합니다. 정의 페이지의 예제는 저장하거나 전송하지 않습니다.

주간 TOP 10의 공개 팝업과 관리자 편집 흐름은 `design-system.html#weekly-pattern`에 정의합니다. 탭별 최대 10건·합계 최소 1건, 실제 선정 건수, 빈 탭 안내, 검토·저장·발행 분리를 반영했습니다. 공통 버튼·링크·44px 클릭 영역·간격·초점·확인 대화창 기준을 적용합니다. 빌드 후 `npm run test:design`과 `node scripts/weekly-ui.cjs`로 320/390/1280px, 한영 화면, 키보드, 빈 상태·오류 상태와 편집·발행 흐름을 검사합니다. 화면 검사는 모의 발행본을 사용하며 운영 브리핑을 발행하지 않습니다.

## OECD 정책 현황

policy.js는 OECD 공개 웹사이트의 api.oecdai.org/countries에서 국가 코드를 확인한 뒤 policy-initiatives/public?countryIds=…&page=…를 조회합니다. 모든 페이지의 국가 코드·식별자·전체 건수 일치를 검사하고 30분 메모리 캐시를 사용합니다. 국가 전환은 이전 요청을 취소합니다. 이 주소는 공식 웹사이트가 쓰는 공개 조회 경로이며 외부 개발자용 안정성 계약은 확인되지 않았습니다. 국가 인구·언어 등 불일치가 확인된 부가정보와 편집자 연락처는 사용하지 않습니다.

등록 상태/유형/분야별 탐색과 상세 확인, 선택 정책에서 개인 질문으로 이어지는 동작을 제공합니다. 법적 구속력의 빈 값은 미입력으로 표시하고 Active를 법률 시행으로 해석하지 않습니다. 정책명은 한국어 모드에서 제공된 원문 명칭을 쓰며 요약은 OECD 원문을 보존합니다. 선택한 국가 전체 AI 정책 목록으로, AI 위험 대응 정책만의 집계가 아닙니다.

### Incident-to-policy inquiry flow

`response-journey.js` connects the AIM incident detail action to the selected country’s policy inventory. Candidate discovery uses country membership and exact normalized shared AI principle labels only; it does not infer legal coverage or policy effectiveness. Users select a candidate (or proceed without one), choose evidence questions, and hand both sources to the existing local inquiry workflow. `policyReview` stores the candidate ID/source, shared principles, selected question keys and an explicit `unverified` assessment in the local record and JSON export. No additional AI API or online submission is used. The matching policy snapshot must belong to the incident country.

## GitHub Pages 배포

`main`에 푸시하면 `.github/workflows/pages.yml`이 `npm ci`와 `npm run build`를 실행해 `dist/`만 배포합니다. Cesium 런타임·Workers·Assets·Widgets·ThirdParty와 라이선스를 `vendor/cesium/`에 포함합니다. 로컬 서버·CMD·node_modules 경로에 대한 방문자 의존성은 없습니다. CNAME의 기존 도메인을 유지합니다.

개발 확인: `npm start`. 배포 결과 확인: `npm run build` 후 `npm run preview:dist`. `node_modules/`, `dist/`, `output/`, 원본 조사 응답과 실행 도구는 게시하지 않습니다. API 요청은 브라우저에서 OECD 공개 서비스로 전송됩니다. 서비스 또는 CORS 변경 시 별도 대응이 필요합니다.

### 검색 메타데이터 생성

`seo.json`이 한영 검색 설명의 기준입니다. `npm run build:seo`는 기본 영문 HTML 메타데이터, canonical, URL을 포함한 WebSite 구조화 데이터, robots.txt, sitemap.xml을 생성합니다. `npm run build`에도 자동 포함됩니다. 단일 대표 URL만 사이트맵에 넣으며 디자인 시스템 예시는 기존 noindex를 유지합니다. 검색엔진 등록·색인 여부는 별도 확인이 필요합니다.

## Risk?Policy Gap Analyzer

`gap-engine.js` provides a pure, separately testable candidate-matching layer; `gap-analyzer.js` presents a country-level sample overview, status filters, shared-principle evidence, policy details, inquiry handoff and JSON export. It compares normalized AI principle labels only, not semantic or legal coverage. Missing labels are separated from no candidate found. All policy statuses are included. Refresh invalidates prior analysis and cross-country snapshots are rejected. The latest AIM sample is not a national coverage estimate. UI text is rendered directly in Korean and English under data-no-translate.

The ontology layer now supports reviewed concept aliases and risk → required control ← policy paths with source evidence, country and date constraints. Matches remain unverified candidates rather than legal coverage judgments.

Validation: `node --test scripts/gap-engine.test.cjs` and `npm run build`.

## 관리자 전용 Ontology Studio · Supabase

GitHub Pages의 /admin/ 정적 화면이 Supabase Auth와 데이터베이스 함수에 연결됩니다. 회원가입 화면 없이 지정된 Auth 사용자 UUID만 개념·별칭·통제수단·정책 조항 연결을 편집하고 저장·미리보기·발행·이력 복원을 할 수 있습니다. 별도 관리자 서버는 필요하지 않습니다. 편집기 파일은 공개 정적 파일이며, 초안 접근·수정 권한은 DB에서 강제합니다.

supabase/migrations/202610040001_ontology_admin.sql에 스키마·권한·검증·발행 트랜잭션을 정의했습니다. 운영 DB에 마이그레이션을 적용하고 프로젝트의 실제 Publishable key로 연결을 수정했습니다. 공개 발행본 조회 성공, 비로그인 초안 접근 거부와 회원가입 차단을 확인했으며 provider는 supabase입니다. 관리자 계정 설정과 GitHub Pages 배포 완료 여부는 배포 안내를 참고하세요.

[Supabase 적용 안내](admin/DEPLOYMENT.md)에 마이그레이션, 관리자 지정, 공개 키와 Pages 배포 설정을 정리했습니다. npm test로 로컬 PostgreSQL 권한과 엔진을 검증하고 npm run build로 정적 배포본을 생성합니다.

## 주간 TOP 10 · AI API 세팅

관리자 ▶ 주간 TOP 10 ▶ AI API 세팅에서 Gemini/OpenAI/Claude 제공자, 키, 모델을 설정합니다. Contexton의 제공자·모델 선택 흐름을 참고했으며 저장 방식은 서버 관리입니다. 모델 목록은 페이지 안의 목록에서 선택하거나 ID를 직접 입력합니다. 새 키로 목록을 조회할 때는 아직 저장되지 않으며 설정 저장을 눌러야 서버에 반영됩니다. 저장 시 키 입력란은 비워집니다. 빈 키는 같은 제공자의 기존 키만 유지하며 제공자 변경에는 새 키가 필요합니다. 서버 설정 삭제는 확인을 거쳐 해당 키도 제거합니다. 키 폐기는 제공자 콘솔에서도 별도로 할 수 있습니다.

키는 Supabase Vault에 보관하고 관리자 메타데이터 RPC에는 제공자·모델·등록 여부·수정 시각·리비전만 반환합니다. Edge Function은 Auth 사용자와 관리자 권한을 확인한 뒤 service_role 전용 RPC로 저장·교체·삭제·사용합니다. 브라우저 저장소, 주간 JSON 백업과 발행본에는 포함하지 않습니다. 키를 로그에 출력하는 코드는 없으며 제공자 오류 본문은 반환하지 않습니다. 외부 호출은 고정된 제공자 HTTPS 주소만 허용하고 리디렉션을 거부합니다. 임의 서버 주소·localhost는 지원하지 않습니다.

연결 확인은 저장한 모델 정보 조회이며 생성 성공·잔액·생성 권한을 보장하지 않습니다. AI 선정·내용 작성은 관리자가 버튼을 눌렀을 때만 실행합니다. 예약 자동 생성과 사용량/비용 한도 설정은 제공하지 않습니다. 설정 변경과 모델 조회는 기존 주간 초안·검토 상태·발행본에 영향을 주지 않습니다.

배포: `202610050005_weekly_ai_settings.sql` 적용 후 `weekly-ai-settings` Edge Function을 `--no-verify-jwt`로 배포합니다. 함수 내부에서 사용자 JWT와 관리자 권한을 반드시 검증합니다. 기존 Vault 확장이 필요합니다. 검사: `npm test`, 빌드 후 `node scripts/weekly-ui.cjs`. 로컬 DB 테스트는 Vault API 모형을 사용하며 암호화 구현 자체를 검증하지 않습니다.

API 근거: [Supabase Vault](https://supabase.com/docs/guides/database/vault), [OpenAI Models](https://developers.openai.com/api/reference/resources/models/methods/list), [Gemini Models](https://ai.google.dev/api/models), [Claude Models](https://platform.claude.com/docs/en/api/models/list).

### 핵심 질문 기반 AI 선정

핵심 질문 작성 ▶ 초안 저장 ▶ 핵심 질문으로 AI 선정·내용 작성 ▶ 제안 미리보기 ▶ 편집 초안에 반영 ▶ 원문 검토·저장·발행 순입니다. 전송 대상은 저장한 질문과 수집 후보의 ID·종류·제목·요약(최대 1,000자)·날짜이며 기존 편집 내용이나 API 키를 프롬프트에 넣지 않습니다. 제공자 API 비용이 발생할 수 있습니다. 수집 자료만 분석하며 원문 웹페이지를 자동 조회하지 않습니다.

RISK·POLICY 각각 0~10건을 허용합니다. 관련 건이 1건이면 1건만 제안하며 부족한 건수를 시나리오로 채우지 않도록 지시합니다. 서버는 후보 밖 ID, 중복 ID, 탭당 10건 초과, 자료에 없는 근거 인용과 형식 오류를 거부합니다. 제목·출처는 AI 출력이 아닌 원 후보를 사용합니다. 이것이 AI 해석의 사실성을 보장하지는 않으며 모든 결과는 검토 필요 상태입니다. 다음 주 신호는 확인할 질문으로 작성합니다.

0건 제안·오류·응답 중단 시 기존 초안을 유지합니다. 생성 중 초안/후보가 바뀌면 결과 반영을 거부합니다. 제안 반영은 명시적 확인 후 현재 선정 목록을 교체하며 서버 저장·발행은 별도입니다. 생성당 출력은 최대 8,192 토큰, 대기는 120초이고 자동 재시도하지 않습니다. 실제 모델별 지원·권한에 따라 생성이 실패할 수 있습니다.

생성 규격: [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create).


## 모바일 기준 · 412×914 (2026-10-05)

Samsung Galaxy A51/A71의 **CSS 뷰포트 412×914**를 기준으로 합니다. 기기 이름에 한정하지 않고 좁은 화면에 미디어 쿼리를 적용합니다. 안전 영역은 `env(safe-area-inset-bottom)`을 반영합니다.

지도는 34dvh(최소 260px, 최대 340px), 위험·정책 패널은 기존 세로 흐름을 사용합니다. 출처 펼치기 영역은 최소 44px이며 입력 글자는 16px입니다. 팝업 높이는 동적 뷰포트와 하단 안전 영역을 기준으로 제한합니다. 구현: `design-system.css`. `npm run test:design`과 `node scripts/weekly-ui.cjs`에 412×914를 포함하며 공개 페이지, Gap Analyzer, 로그인, 주간 TOP 10 관리자·공개 팝업을 검사합니다.

검증은 데스크톱 Edge의 모바일·터치 에뮬레이션으로 진행했습니다. 실제 Android 기기의 키보드와 브라우저 주소창 동작은 별도 실기기 확인 대상입니다.

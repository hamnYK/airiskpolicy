# GitHub Pages + Supabase 관리자 편집기

별도 로그인 서버 없이 GitHub Pages의 `/admin/` 화면이 Supabase Auth와 PostgreSQL RPC에 연결됩니다. 회원가입 화면은 없습니다. 지정된 Auth 사용자 UUID만 편집·발행할 수 있습니다.

## 현재 연결 상태

- 프로젝트: jiyngdwpdmpjiwdnyanb (aipolicy).
- CLI 인증으로 프로젝트의 실제 Publishable key를 확인해 supabase-config.json을 수정했습니다. 기존 Invalid API key 문제는 해결됐습니다.
- 온톨로지 전용 스키마와 RPC를 운영 DB에 적용했습니다. 공개 발행본 조회는 HTTP 200, 비로그인 초안 조회는 HTTP 401 / 42501로 확인했습니다.
- auth.enable_signup=false를 적용하고 공개 설정 API에서도 disable_signup=true를 확인했습니다. 다른 Auth 설정은 변경하지 않았습니다.
- ontology-config.json의 provider는 supabase입니다. 다음 Pages 배포부터 실제 발행본을 읽습니다. 초기 발행본 seed-1은 빈 온톨로지입니다.
- 관리자 계정 생성·권한 지정·로그인 검증을 완료했습니다. 일회성 계정 설정 스크립트와 결과 파일은 정리했습니다. 비밀번호나 서버 키는 저장소·공개 빌드에 포함하지 않습니다.
- main 브랜치에 푸시하면 GitHub Actions가 테스트와 빌드 후 GitHub Pages에 배포합니다. 배포 상태는 저장소 Actions에서 확인합니다.

## 새 환경에 적용할 때

1. Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/202610040001_ontology_admin.sql`을 한 번 실행합니다. 기존 앱 테이블은 수정하지 않고 `airisk_private` 테이블과 `airisk_ontology_*` RPC만 생성합니다. 마이그레이션 버전 관리를 쓰는 경우 동일 SQL을 기존 배포 절차에 포함합니다. GitHub 연동만으로 이 SQL이 실행되지는 않습니다.
2. Authentication → Users에서 기존 관리자 계정을 확인하거나 관리자 계정을 직접 생성합니다. 비밀번호를 코드·GitHub 변수·채팅에 넣지 않습니다. 회원가입 API는 앱에서 호출하지 않습니다. Auth의 Allow new users to sign up 설정도 확인하세요. 이 프로젝트를 다른 앱과 공유한다면 프로젝트 전체 가입 설정이 그 앱에 미치는 영향을 먼저 확인합니다.
3. `supabase/admin-access.sql`의 `admin_email`을 해당 계정 이메일로 바꿔 SQL Editor에서 실행합니다. 사용자 생성이나 초대 메일 전송은 하지 않습니다. `auth.users.id`를 비공개 허용 목록에 넣습니다. 브라우저는 이 목록을 읽거나 수정할 수 없습니다.
4. 프로젝트의 올바른 Publishable key를 `supabase-config.json`에 넣거나 GitHub Actions의 `SUPABASE_PUBLISHABLE_KEY` 변수로 지정합니다. `service_role`, `sb_secret_*`, DB 비밀번호는 정적 파일이나 빌드 변수에 사용하지 않습니다. 빌드는 Publishable key 형식만 허용합니다.
5. `npm ci`, `npm test`, `npm run build` 후 GitHub Pages를 배포합니다. 관리자 URL은 `https://www.aipolicy.world/admin/`입니다. GitHub 프로젝트 하위 경로에서도 상대 URL로 동작합니다.
6. 지정 관리자만 로그인되는지, 비관리자 계정이 초안을 읽거나 수정할 수 없는지 운영 환경에서 확인합니다. 개념·별칭, 필요한 통제수단, 정책 조항 연결을 작성하고 초안 저장 → 매칭 미리보기 → 발행 검토를 진행합니다.
7. Supabase 발행본 조회까지 확인한 뒤 `ontology-config.json`의 provider를 `supabase`로 바꾸거나 GitHub Actions 변수 `ONTOLOGY_PROVIDER=supabase`를 설정하고 사이트를 한 번 배포합니다. 이후 온톨로지 발행은 DB에서 즉시 이루어지며 새 방문·페이지 새로고침·최신 온톨로지 반영 버튼으로 공개 분석에 적용됩니다.

GitHub Actions 변수 `SUPABASE_URL`은 프로젝트 변경 때만 필요합니다. 공개 키가 이미 Actions Secret에 있다면 동일 이름도 지원하지만 공개용 키만 사용해야 합니다. 관리자 이메일이나 비밀번호는 빌드에 포함되지 않습니다.

## 권한과 저장

- 정적 사이트이므로 로그인 페이지와 편집기 HTML/JS 파일은 공개적으로 다운로드할 수 있습니다. 화면은 DB의 관리자 권한 확인 전 숨겨져 있습니다. 실제 보안 경계는 Supabase Auth와 데이터베이스입니다.
- 비공개 스키마의 관리자·초안·이력 테이블에는 RLS를 켜고 브라우저 역할의 모든 테이블 권한을 제거했습니다. 노출된 RPC는 고정 search_path를 사용하며 매 호출마다 `auth.uid()`를 허용 목록과 비교합니다. 사용자 metadata나 클라이언트의 관리자 표시를 신뢰하지 않습니다.
- 익명 방문자는 `airisk_ontology_published()`만 실행해 발행된 문서를 읽습니다. 초기 문서는 비어 있으며 출처 검토가 끝난 데이터부터 채워야 합니다.
- 저장·발행의 구조와 관계 검증은 DB에서도 수행합니다. 발행 시 검토 완료 항목의 알려진 필드만 추출하고 이전 발행본을 최대 50개 보관합니다. 모든 변경은 트랜잭션이며 revision 충돌 시 저장을 거절합니다.
- 공식 Supabase SDK가 세션 갱신을 담당합니다. 세션은 관리자 탭의 sessionStorage에 보관합니다. 페이지 소스에 관리자 자격은 없으며 관리자 지정 취소는 다음 RPC부터 반영됩니다. 로그아웃은 현재 브라우저 세션에서 이루어집니다.
- 개념 관계는 검토 후보의 근거입니다. 법적 적용·집행·효과 확정이 아닙니다. 정책 연결 기간은 위험 조회 종료일 기준이며 사건 당시 적용 여부는 별도 조사합니다.
- 이전 Node 관리자 서버, 자체 비밀번호 해시, Docker 배포는 제거했습니다. 공개 빌드에는 관리자 정적 UI와 Supabase SDK만 추가됩니다.

## 검증

`npm test`는 PostgreSQL에서 익명·일반 계정·관리자 접근, 권한 취소, 초안 비공개, 발행, 잘못된 관계, 동시 수정 충돌을 검증합니다. 운영 Supabase 자체를 테스트한 것은 아닙니다. `npm run build`는 관리자 상대 URL과 배포 파일의 존재, SQL·초안 자료의 제외 여부를 검사합니다.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Publishable keys](https://supabase.com/docs/guides/api/api-keys).
## 공통 AI 원칙 매칭 초안

공통 AI 원칙 매칭이라는 이름으로 기존 원칙 분류 10개를 운영 초안에 등록했습니다. 원본은 supabase/seeds/common-ai-principles.json입니다. 원칙명 정규화 후 동일 명칭끼리 연결하는 기존 규칙을 개념으로 표현하며, 임의의 별칭·통제수단·정책 조항 관계는 추가하지 않았습니다. 근거 출처는 해당 분류를 사용하던 저장소 코드입니다. 검토 완료 표시는 분류명과 매칭 규칙의 확인을 뜻하며 법적 대응 검증을 뜻하지 않습니다.

이름·별칭·검토 상태·근거 메모를 수정하고 초안 저장 후 발행할 수 있습니다. 이름 유지에는 두 번째 마이그레이션 202610040002_ontology_name.sql이 필요합니다. 초기 초안 등록은 공개 발행을 수행하지 않습니다. 공통 원칙 탐색은 발행된 온톨로지 개념·별칭으로 일원화했습니다. 별도의 원칙명 직접 매칭은 없습니다. 검토 상태를 초안으로 바꾸거나 별칭을 제거한 뒤 저장·발행하면 해당 근거가 제외됩니다. 다른 발행된 경로가 있으면 후보는 유지될 수 있습니다. 발행된 개념이 없으면 공개 분석은 시작하지 않습니다. 분석 JSON의 method는 ontology-only-v2이며 sharedPrinciples에는 매칭된 대표 개념명이 담깁니다.

초안 저장은 서버 보관이며 공개 적용이 아닙니다. 발행 검토 후 확인하면 공개본이 바뀌고, 방문자는 새로고침 또는 최신 온톨로지 반영으로 불러옵니다. 이름은 편집할 수 있으며 버전 ID는 시스템이 발행 때 자동 생성합니다. 초기 seed-1은 화면에 온톨로지 미등록으로 표시합니다.

## 실데이터 원칙 대응

2026-10-05 OECD 한국 정책 API 29건과 위험 표본 100건의 분류를 대조했습니다. `supabase/seeds/oecd-principle-crosswalk.json`은 동일 원칙 별칭 2개와 세부 AI 원칙에서 통합 원칙으로 향하는 `broader` 관계 8개를 제공합니다. 편집기의 원칙 대응·통제수단 탭에서 관계 종류와 출처·메모·검토 상태를 편집합니다. `broader`는 단방향 1단계 후보 근거이며 역방향·다단계·법적 대응 추론을 하지 않습니다. OECD 2.x 정책 권고는 근거 없이 위험 원칙에 연결하지 않습니다. DB에는 `202610050001_principle_crosswalk.sql`이 필요합니다. 재현 자료 `scripts/fixtures/kor-principles-20261005.json`에는 분류·ID만 있으며 실제 뉴스 본문은 없습니다. 결과는 79 후보 / 0 미발견 / 21 분류 부족이며 정책 효력 검증 수치가 아닙니다.

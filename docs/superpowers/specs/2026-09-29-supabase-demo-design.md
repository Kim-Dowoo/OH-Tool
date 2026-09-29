# Supabase 기반 Vercel 데모 설계

## 목적

Vercel에서 OH 관리 도구의 화면과 집계 흐름을 시연할 수 있게 한다. Supabase 프로젝트 `dtcybsobkoifapfxxomq`에는 코드가 생성한 합성 데이터만 저장한다. 실제 OH 요청, SN, 매출, 이메일, Excel 원본은 계속 로컬 SQLite와 사용자 PC에만 둔다.

## 경계와 보안

- 로컬 모드는 기존 SQLite 저장소와 실제 Excel 가져오기·배정·출고 흐름을 유지한다.
- Vercel `APP_MODE=demo`는 Supabase의 합성 데이터만 읽는다.
- Production과 Preview에서는 업로드, 데이터 생성·수정·삭제, 배정·출고, 메일 초안, 내보내기 API를 모두 `403`으로 차단한다.
- 브라우저에는 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 제공한다. `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 시드 작업에서만 사용하며 GitHub·브라우저·로그에 기록하지 않는다.
- 데모 테이블은 Row Level Security를 켜고 `demo_reader` 정책으로 `SELECT`만 허용한다. anon 역할에는 INSERT/UPDATE/DELETE를 허용하지 않는다.
- 실제 데이터 파일·SQLite·백업은 기존 `.gitignore` 규칙을 유지한다.

## 데이터 모델

Supabase의 `public` 스키마에는 데모 전용 접두사 `demo_` 테이블만 만든다.

- `demo_organizations`: 부, 팀, 영업사원, 파트너사
- `demo_requests`: 요청 기종·수량·상태·예상 매출
- `demo_inventory`: 기종·Family·총수량·잔여수량
- `demo_allocations`: 요청·기종·가상 SN·배정 상태
- `demo_shipments`: 출고일·확정 매출

외래키는 요청/조직, 배정/요청·재고, 출고/배정을 연결한다. 가상 SN은 `DEMO-` 접두사를 쓰며 실제 SN 형식이나 실제 파트너·직원 이름을 모방하지 않는다.

## 합성 데이터

시드 SQL은 결정론적이며 반복 실행해도 동일한 데모 데이터만 유지한다. 3개 부, 5개 팀, 6개 파트너사, 4개 기종, 20개 요청, 일부 배정/출고 건을 만든다. 데이터에는 실제 회사명, ITSS 코드, 이메일, 실매출, 실제 SN을 포함하지 않는다.

## 앱 동작

- `APP_MODE=local`: 기존 Repository·SQLite 경로를 사용한다.
- `APP_MODE=demo`: 서버 측 Supabase 조회 클라이언트를 사용하고, 대시보드·요청·재고·출고 페이지에 가상 데이터를 표시한다.
- 모드별 저장소 선택은 하나의 repository factory에서 처리한다. UI는 공통 read-model을 사용해 로컬/데모에서 같은 형태의 화면을 렌더링한다.
- 화면 상단에 `DEMO — 가상 데이터이며 실제 데이터를 입력하지 마세요` 경고를 고정 표시한다.

## 배포

1. Supabase SQL Editor에서 데모 스키마·RLS·시드 마이그레이션을 실행한다.
2. Vercel 프로젝트 `fbkr-ai-project/oh-tool`의 Root Directory를 `app`으로 설정한다.
3. Preview와 Production에 `APP_MODE=demo`, Supabase URL, anon key를 설정한다.
4. `main` 배포 후 데모 조회, 쓰기 API 차단, 실제 파일 부재를 검증한다.
5. Preview/Production Vercel Authentication을 유지한다.

## 검증

- SQL: 각 테이블의 합성 행 수, 관계, RLS SELECT 허용/쓰기 거부를 확인한다.
- 앱: `APP_MODE=demo` 빌드와 대시보드 조회를 확인한다.
- 보안: 실제 Excel/SQLite/백업이 Git 추적·Supabase 시드·Vercel 배포물에 없는지 검사한다.
- 통합: Vercel Preview에서 합성 집계가 보이고 업로드·변경 요청은 403이어야 한다.

## 범위 밖

- 실제 업무 데이터의 Supabase 저장
- Supabase Auth를 통한 다중 사용자 권한
- SharePoint/Outlook 자동화
- 실제 이메일 전송

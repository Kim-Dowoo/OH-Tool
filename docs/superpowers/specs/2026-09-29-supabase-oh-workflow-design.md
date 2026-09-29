# Supabase 기반 OH 요청·배정·출고 워크플로우 설계

## 목적

여러 사용자와 관리자가 서로 다른 브라우저·PC에서도 하나의 OH 운영 데이터를 공유하도록 전환한다. 사용자는 사번과 비밀번호로 가입해 OH 요청을 등록하고, 관리자는 승인된 사용자 요청에 가용 SN을 배정·출고 처리한다. 사용자는 자기 요청의 배정 결과와 출고 현황만 본다.

## 범위와 성공 기준

- 로그인 ID는 이메일이 아닌 숫자 10자리 사번이다.
- 가입 계정은 기본적으로 승인 대기 상태이며, 관리자가 승인해야 업무 데이터를 사용한다.
- 관리자는 전체 요청, SN 재고, 배정, 출고, 가입 승인 대상을 처리한다.
- 사용자는 자기 요청, 배정 결과, 출고 현황만 조회한다.
- 요청 수량 초과 배정, 중복 SN 배정, 가용하지 않은 SN 배정, 미배정 SN 출고는 데이터베이스에서 거부한다.
- 사용자와 관리자가 새로고침 또는 탭 이동 시 최신 공용 데이터를 확인한다.

## 인증과 계정 승인

### 사번 로그인

화면은 `employeeId`와 `password`만 받는다. 사번은 숫자 10자리로 검증한다. Supabase Auth의 이메일/비밀번호 인터페이스를 이용하되, 앱 서버가 사번을 `employeeId@auth.oh-tool.invalid` 형태의 내부 식별자로 변환한다. 이 식별자는 화면, 로그, 안내 문구에 표시하지 않으며 실제 이메일 발송도 사용하지 않는다.

가입 시 사용자 메타데이터에 사번을 전달한다. Auth 사용자 생성 트리거가 `profiles` 행을 만들고, 역할은 `USER`, 상태는 `PENDING`으로 강제한다. 클라이언트가 보낸 역할이나 승인 상태는 무시한다.

### 최초 관리자

사용자가 별도로 제공한 초기 관리자 사번 사용자가 먼저 가입한 뒤, Supabase SQL Editor에서 제공되는 초기화 SQL을 한 번 실행해 `ADMIN`과 `ACTIVE`로 승격한다. 이 사번은 저장소·클라이언트 번들·환경 변수에 넣지 않는다. 이후 활성 관리자가 가입 대기 목록에서 계정을 활성화하거나 보류/정지한다.

## 데이터 모델

Supabase PostgreSQL 마이그레이션은 다음 테이블을 만든다.

| 테이블 | 핵심 필드 | 용도 |
| --- | --- | --- |
| `profiles` | `id`, `employee_id`, `role`, `status` | Auth 사용자와 사번·권한·승인 상태 연결 |
| `requests` | `id`, `created_by`, `period`, `partner_code`, `requested_model`, `quantity`, `note`, `status` | 사용자가 등록한 OH 요청 |
| `inventory_serials` | `serial_number`, `model_code`, `storage_location`, `status` | 가용·배정·출고 SN 재고 |
| `allocations` | `id`, `request_id`, `serial_number`, `allocated_by`, `allocated_at`, `status` | 요청별 SN 배정 |
| `shipments` | `id`, `allocation_id`, `shipped_by`, `shipped_at`, `revenue`, `note` | 배정 SN의 출고 기록 |
| `audit_events` | `actor_id`, `action`, `entity_type`, `entity_id`, `changed_fields`, `occurred_at` | 관리자 변경 이력 |

`requests.created_by`는 `profiles.id`를 참조한다. `allocations`는 하나의 SN에 하나만 연결되고, `shipments`는 하나의 배정에 하나만 연결된다. SN 상태는 `AVAILABLE`, `ALLOCATED`, `SHIPPED`로 관리한다. 요청 상태는 `RECEIVED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`, `SHIPPED`, `CANCELLED`로 관리한다.

## 권한과 무결성

모든 업무 테이블에 Row Level Security를 활성화한다.

- 활성 사용자는 자기 `profiles` 행을 읽고, 자기 요청만 만들고 읽는다.
- 활성 사용자는 자기 요청에 연결된 배정·출고 내역만 읽는다.
- 승인 대기 또는 정지 사용자는 업무 테이블을 읽거나 변경할 수 없다.
- 활성 관리자는 전체 운영 데이터를 읽고, 계정 승인·SN 재고 등록·배정·출고를 수행한다.
- 역할과 승인 상태를 사용자가 직접 변경할 수 없다.

배정과 출고는 일반 테이블 쓰기가 아닌 보안 정의 PostgreSQL RPC 함수로 처리한다. 함수는 호출자의 활성 관리자 권한을 검사하고, 요청 기종 일치, 요청 잔여 수량, SN 가용 상태, 중복 배정, 출고 전 배정 상태를 하나의 트랜잭션에서 검증한다. 성공 시 요청/SN 상태와 감사 이력을 함께 갱신한다.

## 화면과 흐름

### 사용자 화면

1. 사번·비밀번호 가입 또는 로그인
2. 승인 대기면 승인 대기 화면만 표시
3. 활성화되면 첫 탭부터 `OH 등록`, `OH 요청 현황`, `배정 및 출고 현황` 메뉴 표시
4. 요청 등록 후 상태와 배정/출고 진행을 확인

### 관리자 화면

1. `가입 승인`에서 대기 사번을 활성화 또는 정지
2. `요청 관리`에서 전체 요청을 보고 해당 요청의 잔여 수량 확인
3. `SN 재고`에서 기종·SN·보관 장소를 등록하고 가용 SN 확인
4. `OH 배정`에서 요청 기종과 일치하는 가용 SN을 선택해 배정
5. `출고 관리`에서 배정된 SN을 출고일·매출·메모와 함께 출고 처리

다른 사용자가 변경한 내용은 탭 전환이나 새로고침 때 Supabase에서 다시 읽는다. 실시간 구독은 이번 범위에 포함하지 않는다.

## Next.js와 Vercel 전환

- `@supabase/ssr`, `@supabase/supabase-js`를 사용해 브라우저·서버 클라이언트를 분리한다.
- 관리자 선택 버튼은 즉시 역할을 설정하지 않고, 사용자와 동일한 사번·비밀번호 로그인 화면으로 이동한다.
- 로그인, 가입, 로그아웃은 안전한 서버 액션 또는 Route Handler에서 수행하고 세션은 HttpOnly 쿠키로 관리한다.
- Supabase 공개 URL과 publishable/anon 키만 클라이언트에 제공한다. service-role 키는 사용하지 않는다.
- 현재 `APP_MODE=demo` 정적 export와 Vercel 제한을 제거하고, Vercel에서 동적 Next.js 앱으로 배포한다.
- Vercel에는 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정한다. 비밀키나 실제 비밀번호는 Git에 저장하지 않는다.

## 오류 처리

- 잘못된 사번 형식, 약한 비밀번호, 중복 가입, 로그인 실패는 계정 존재 여부를 과도하게 노출하지 않는 안내로 처리한다.
- 승인 대기 계정은 업무 화면 접근 대신 승인 대기 메시지를 받는다.
- RPC 제약 위반은 사용자 친화적 메시지로 변환한다: 재고 없음, 중복 SN, 요청 수량 초과, 기종 불일치, 배정 전 출고 불가.
- 네트워크 오류에는 재시도 안내와 현재 입력 내용 보존을 제공한다.

## 검증

- 사번 10자리 검증과 내부 Auth 식별자 변환
- 가입 시 `PENDING/USER`만 생성되고 관리자는 승인 후에만 활성화됨
- RLS 기준 사용자 간 요청·배정·출고 데이터 격리
- 관리자의 SN 재고 등록, 요청 수량 내 배정, 중복/초과 배정 차단
- 배정된 SN만 출고 가능하며 출고 후 사용자 출고 현황에 표시됨
- 관리자 감사 이력 기록
- Supabase 환경 변수 누락 시 안전한 실패와 Vercel 동적 빌드

# OH 관리 Tool — 지금부터 시작하기

## 확정된 운영 원칙

- 실제 파트너명, 영업사원 정보, OH 기종, SN, 매출 데이터는 이 PC 안에만 저장합니다.
- GitHub에는 프로그램 코드와 가상 샘플만 올립니다.
- Vercel에는 실제 Excel 업로드 기능을 차단한 데모 버전만 배포합니다.
- Power Automate, Power BI, Microsoft Graph API는 1차 버전에서 사용하지 않습니다.
- SharePoint Excel은 사용자가 내려받아 로컬 프로그램에 직접 업로드합니다.
- Outlook 메일은 자동 발송하지 않고, 복사할 수 있는 메일 문구 또는 Outlook 초안을 만듭니다.

## 사용자가 지금 준비할 것

아래 세 파일을 실제 정보가 보이지 않도록 익명화하여 `input-samples` 폴더에 넣어 주세요.

1. `sales-request-anonymized.xlsx`
   - 현재 영업사원들이 사용하는 신청 시트의 구조를 유지합니다.
   - 회사명, 사람 이름, 이메일, 전화번호, SN, 금액은 가상 값으로 바꿉니다.
   - 헤더 행과 시트 이름은 실제 파일과 동일하게 유지합니다.

2. `inventory-anonymized.xlsx`
   - 현재 보유 또는 생산 완료된 OH기의 기종과 SN 목록입니다.
   - 실제 SN 대신 `DEMO-SN-0001` 같은 가상 값을 사용합니다.
   - 현재 사용 중인 상태 구분이 있다면 함께 남깁니다.

3. `organization-anonymized.xlsx`
   - 부, 팀, 영업사원, 이메일, 파트너사 구분 기준입니다.
   - 실제 이름과 이메일은 가상 값으로 교체합니다.

샘플 작성 기준은 [사용자 준비 체크리스트](docs/USER_PREPARATION_CHECKLIST.md)에 자세히 적혀 있습니다.

## 지금 하지 않아도 되는 것

- Vercel 유료 플랜 결제
- 데이터베이스 서비스 가입
- Microsoft API 권한 신청
- Outlook API 설정
- Power Automate 또는 Power BI 권한 신청
- 실제 업무 데이터를 GitHub나 Vercel에 올리는 작업

## 다음 진행 순서

1. 사용자가 이 문서와 [설계 명세](docs/superpowers/specs/2026-09-17-oh-management-tool-design.md)를 확인합니다.
2. 샘플 3개를 확인하고 실제 정보가 남은 파일은 로컬 분석 전용으로 분류합니다. 완료되었습니다.
3. 확인한 열 이름과 업무 규칙을 기준으로 상세 구현 계획을 작성합니다.
4. Git 저장소와 Next.js 프로젝트를 생성합니다.
5. 로컬 전용 SQLite 데이터베이스와 Excel 가져오기 기능을 만듭니다.
6. 요청 → 배정 → 출고 → 매출 → 통계 흐름을 구현합니다.
7. 테스트가 끝난 뒤 GitHub 비공개 저장소와 Vercel 데모를 연결합니다.

## 역할 구분

### 사용자가 해야 하는 일

- 익명화 샘플 3개 준비
- 설계 문서에서 실제 업무 흐름과 다른 부분 확인
- 추후 GitHub/Vercel 로그인 및 연결 승인
- 완성된 로컬 프로그램으로 실제 데이터 시험

### Codex가 진행할 수 있는 일

- 프로젝트와 Git 저장소 구성
- 데이터 구조와 화면 구현
- Excel 검증 및 가져오기 구현
- 로컬 실행·백업 스크립트 작성
- 테스트 작성 및 실행
- GitHub/Vercel 연결 절차 지원
- 사용자 설명서 작성

## 가장 먼저 확인할 것

설계는 승인되었습니다. 제공된 파일의 실제 열 구조는 [Excel 원본 구조 분석](docs/EXCEL_SOURCE_ANALYSIS.md)에 정리했습니다. 현재 샘플에는 실제 정보로 보이는 값이 남아 있으므로 GitHub와 Vercel에 올리지 않습니다.

# OH 관리 Tool

이 앱은 OH 요청, 배정, 출고, 매출 업무를 이 PC의 로컬 데이터로 관리하기 위한 Next.js 기반 도구입니다.

## 안전 원칙

- 실제 Excel 파일, SQLite 데이터, 백업, 내보내기 파일, 비밀 환경 변수는 Git에 포함하지 않습니다.
- Vercel에서는 `APP_MODE=demo`만 허용합니다.
- 로컬 실행은 `.env.example`을 참고해 별도의 `.env` 파일을 구성합니다.

## 시작하기

```powershell
Set-Location app
npm run dev
```

## 읽기 전용 데모

```powershell
Set-Location app
$env:APP_MODE='demo'
npm run build
npm run start
```

Vercel 프로젝트의 Root Directory는 `app`, 환경 변수는 `APP_MODE=demo`로 설정합니다.
모드는 정적 페이지를 생성하는 빌드 시점에 적용되므로 모드를 바꾼 후에는 다시 빌드합니다.
데모는 코드에 정의한 고정 가상 데이터만 사용하며, 외부 데이터베이스나 비밀 키가 필요하지 않습니다.
모든 시리얼은 `DEMO-`로 시작하고 입력·업로드·내보내기 화면은 제공하지 않습니다.
로컬 모드의 첫 화면은 현재 안내 화면입니다.

아직 API Route Handler는 없습니다. 이후 변경 API를 추가할 때는 본문을 읽기 전에
`getMutationDenial()`의 응답을 반환해야 하며, 데모 저장소 자체도 모든 변경을 거부합니다.

민감 파일 추적 여부는 저장소 루트에서 아래 명령으로 점검합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-no-sensitive-files.ps1
```

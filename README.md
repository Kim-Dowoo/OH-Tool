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

민감 파일 추적 여부는 저장소 루트에서 아래 명령으로 점검합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-no-sensitive-files.ps1
```

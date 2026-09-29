# OH-Tool

OH 장비 요청·배정·출고·매출 현황을 관리하기 위한 도구입니다. 공용 운영 데이터는 Supabase에 보관합니다.

## 안전 원칙

- 실제 Excel 파일, SQLite 데이터, 백업, 내보내기 파일, 비밀 환경 변수는 Git에 포함하지 않습니다.
- Supabase secret/service-role 키와 실제 비밀번호는 Git에 포함하지 않습니다.

## 시작하기

```powershell
Set-Location app
npm run dev
```

## Supabase 환경 설정

```powershell
Set-Location app
Copy-Item .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL 및 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 입력합니다.
npm run dev
```

Vercel 프로젝트의 Root Directory는 `app`입니다. `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Vercel 환경 변수로 설정합니다. secret/service-role 키는 설정하거나 배포하지 않습니다.

현재 설계와 준비 문서는 [START_HERE.md](START_HERE.md)에서 확인할 수 있습니다.

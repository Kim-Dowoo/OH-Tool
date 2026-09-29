# OH 관리 Tool

공유 Supabase 데이터베이스를 사용하는 OH 요청·승인·SN 배정·출고 관리 도구입니다.

## 로컬 실행

1. `.env.example`을 복사해 `.env.local`을 만들고, Supabase의 **Project URL**과 **publishable key**만 입력합니다.
2. `npm ci`
3. `npm run dev`

## 운영 설정

- Supabase SQL Editor에서 `supabase/migrations/202609290001_oh_workflow.sql`을 실행합니다.
- Auth Email 설정의 이메일 확인을 비활성화합니다. 화면에는 사번만 보이며, 내부에서만 이메일 별칭을 사용합니다.
- 첫 관리자 가입 후 `supabase/seed/initial-admin.sql`의 자리표시자를 해당 사번으로 바꿔 한 번 실행합니다.
- Vercel에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 환경 변수로 등록합니다.

Supabase secret/service-role key, 실제 사번, 비밀번호는 코드·Git·Vercel의 public 환경 변수에 절대 넣지 않습니다.

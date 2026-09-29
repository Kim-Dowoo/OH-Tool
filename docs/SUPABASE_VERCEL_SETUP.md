# Supabase · Vercel 운영 설정

1. Supabase SQL Editor에서 `app/supabase/migrations/202609290001_oh_workflow.sql`을 실행합니다.
2. Auth의 Email 설정에서 이메일 확인을 비활성화합니다.
3. 초기 관리자가 사번과 비밀번호로 가입한 뒤, `app/supabase/seed/initial-admin.sql`의 자리표시자만 실제 사번으로 바꾸어 실행합니다.
4. Vercel 프로젝트 Root Directory를 `app`으로 설정하고 다음 public 환경 변수만 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

secret/service-role key는 브라우저, Git, public 환경 변수에 넣지 않습니다.

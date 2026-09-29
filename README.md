# OH-Tool

OH 장비 요청·배정·출고·매출 현황을 관리하기 위한 도구입니다. 실제 업무 데이터는 이 PC의 로컬 SQLite에만 보관합니다.

## 안전 원칙

- 실제 Excel 파일, SQLite 데이터, 백업, 내보내기 파일, 비밀 환경 변수는 Git에 포함하지 않습니다.
- Vercel에서는 `APP_MODE=demo`만 허용합니다.
- Vercel 데모는 코드에 정의된 가상 데이터만 표시하며 외부 데이터베이스나 비밀 키를 사용하지 않습니다.

## 시작하기

```powershell
Set-Location app
npm run dev
```

## 브라우저 저장형 데모

```powershell
Set-Location app
$env:APP_MODE='demo'
npm run build
npm run start
```

Vercel 프로젝트의 Root Directory는 `app`, 환경 변수는 `APP_MODE=demo`로 설정합니다. OH기 요청 시트에서 등록한 내용은 서버로 전송하지 않고 해당 브라우저의 저장소에만 보관됩니다. 실제 데이터를 업로드·내보내기하는 기능은 데모에서 제공하지 않습니다.

현재 설계와 준비 문서는 [START_HERE.md](START_HERE.md)에서 확인할 수 있습니다.

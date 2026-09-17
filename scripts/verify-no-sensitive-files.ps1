$blocked = @(
  'input-samples/*.xlsx',
  'data/**',
  'backups/**',
  'exports/**',
  '.env',
  '.env.*',
  '*/.env',
  '*/.env.*'
)
$allowed = @(
  '.env.example',
  'data/.gitkeep',
  'backups/.gitkeep',
  'exports/.gitkeep'
)
$repositoryRoot = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Git 저장소 루트를 확인할 수 없습니다."
}
$tracked = git -C $repositoryRoot ls-files | Where-Object { $_ -notin $allowed }
foreach ($pattern in $blocked) {
  if ($tracked | Where-Object { $_ -like $pattern }) {
    throw "민감 파일이 Git에 포함됨: $pattern"
  }
}

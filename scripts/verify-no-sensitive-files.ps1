$blocked = @(
  'input-samples/*.xlsx',
  'data/**',
  'backups/**',
  'exports/**',
  '.env',
  '.env.*'
)
$tracked = git ls-files | Where-Object { $_ -ne '.env.example' }
foreach ($pattern in $blocked) {
  if ($tracked | Where-Object { $_ -like $pattern }) {
    throw "민감 파일이 Git에 포함됨: $pattern"
  }
}

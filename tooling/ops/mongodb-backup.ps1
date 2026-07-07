param(
  [string]$Uri = $env:MONGODB_URI,
  [string]$DbName = $env:MONGODB_DB_NAME,
  [string]$OutDir = "./backups"
)

$ErrorActionPreference = "Stop"

if (-not $Uri) {
  Write-Error "Set MONGODB_URI or pass -Uri"
}

if (-not $DbName) {
  $DbName = "healthora"
}

$mongodump = Get-Command mongodump -ErrorAction SilentlyContinue
if (-not $mongodump) {
  Write-Error "mongodump not found. Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutDir "healthora-$stamp"

New-Item -ItemType Directory -Force -Path $target | Out-Null

Write-Host "Dumping $DbName to $target"
& mongodump --uri="$Uri" --db="$DbName" --out="$target"

Write-Host "Done: $target"

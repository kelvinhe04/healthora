param(
  [string]$Owner = "kelvinhe04",
  [int]$ProjectNumber = 1,
  [int[]]$IssueNumbers = @(77, 78, 79, 80, 81, 82, 86, 87, 89, 90, 91)
)

$ErrorActionPreference = "Stop"

Write-Host "Project $Owner #$ProjectNumber -> Status Done"
Write-Host "Issues: $($IssueNumbers -join ', ')"

$projectJson = gh project view $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
$projectId = $projectJson.id
Write-Host "Project id: $projectId"

$fieldsJson = gh project field-list $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
$statusField = $fieldsJson.fields | Where-Object { $_.name -eq "Status" }
if (-not $statusField) { throw "Status field not found" }

$doneOption = $statusField.options | Where-Object { $_.name -eq "Done" }
if (-not $doneOption) { throw "Done option not found" }

Write-Host "Status field: $($statusField.id) | Done: $($doneOption.id)"

$itemsJson = gh project item-list $ProjectNumber --owner $Owner --format json -L 300 | ConvertFrom-Json
$moved = 0
$missing = @()

foreach ($num in $IssueNumbers) {
  $item = $itemsJson.items | Where-Object { $_.content.number -eq $num } | Select-Object -First 1
  if (-not $item) {
    $missing += $num
    continue
  }
  gh project item-edit `
    --id $item.id `
    --project-id $projectId `
    --field-id $statusField.id `
    --single-select-option-id $doneOption.id | Out-Null
  Write-Host "[OK] Issue #$num -> Done"
  $moved++
}

Write-Host ""
Write-Host "Moved: $moved"
if ($missing.Count -gt 0) {
  Write-Host "Not in project: $($missing -join ', ')"
}

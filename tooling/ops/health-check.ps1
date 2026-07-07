param(
  [string]$ApiBase = $env:HEALTHORA_API_URL,
  [string]$FrontendBase = $env:HEALTHORA_FRONTEND_URL
)

if (-not $ApiBase) {
  $ApiBase = "http://localhost:3002"
}

$failed = 0

function Test-Endpoint {
  param([string]$Name, [string]$Url, [int[]]$OkStatus = @(200))
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    if ($OkStatus -contains $response.StatusCode) {
      Write-Host "[OK] $Name ($($response.StatusCode)) $Url"
    } else {
      Write-Host "[FAIL] $Name status $($response.StatusCode) expected $($OkStatus -join ',') $Url"
      $script:failed++
    }
  } catch {
    Write-Host "[FAIL] $Name $Url — $($_.Exception.Message)"
    $script:failed++
  }
}

Write-Host "Healthora health check"
Write-Host "API: $ApiBase"
if ($FrontendBase) { Write-Host "Frontend: $FrontendBase" }
Write-Host ""

Test-Endpoint -Name "API /health" -Url "$ApiBase/health"
Test-Endpoint -Name "API /openapi.json" -Url "$ApiBase/openapi.json"

if ($FrontendBase) {
  Test-Endpoint -Name "Frontend /" -Url $FrontendBase
}

Write-Host ""
if ($failed -eq 0) {
  Write-Host "All checks passed."
  exit 0
}

Write-Host "$failed check(s) failed."
exit 1

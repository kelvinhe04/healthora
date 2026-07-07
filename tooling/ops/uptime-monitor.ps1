param(
  [string]$ApiBase = $env:HEALTHORA_API_URL,
  [string]$FrontendBase = $env:HEALTHORA_FRONTEND_URL,
  [string]$AlertWebhookUrl = $env:UPTIME_ALERT_WEBHOOK_URL,
  [string]$AlertChannel = $env:UPTIME_ALERT_CHANNEL,
  [string]$HistoryPath = "uptime-history.jsonl",
  [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Stop"

if (-not $ApiBase) {
  $ApiBase = "http://localhost:3002"
}

$checks = @(
  @{ name = "api-health"; url = "$ApiBase/health"; okStatus = @(200) },
  @{ name = "api-openapi"; url = "$ApiBase/openapi.json"; okStatus = @(200) }
)

if ($FrontendBase) {
  $checks += @{ name = "frontend-home"; url = $FrontendBase; okStatus = @(200) }
}

function Invoke-UptimeCheck {
  param(
    [string]$Name,
    [string]$Url,
    [int[]]$OkStatus
  )

  $startedAt = Get-Date
  $watch = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    $watch.Stop()
    $isUp = $OkStatus -contains $response.StatusCode
    return [ordered]@{
      name = $Name
      url = $Url
      up = $isUp
      statusCode = [int]$response.StatusCode
      latencyMs = [math]::Round($watch.Elapsed.TotalMilliseconds, 2)
      checkedAt = $startedAt.ToUniversalTime().ToString("o")
      error = $null
    }
  } catch {
    $watch.Stop()
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return [ordered]@{
      name = $Name
      url = $Url
      up = $false
      statusCode = $statusCode
      latencyMs = [math]::Round($watch.Elapsed.TotalMilliseconds, 2)
      checkedAt = $startedAt.ToUniversalTime().ToString("o")
      error = $_.Exception.Message
    }
  }
}

function Send-UptimeAlert {
  param([array]$Failures)

  if (-not $AlertWebhookUrl -or $Failures.Count -eq 0) {
    return
  }

  $summary = ($Failures | ForEach-Object {
    $status = if ($null -ne $_.statusCode) { $_.statusCode } else { "no-response" }
    "- $($_.name) $status $($_.url)"
  }) -join "`n"

  $payload = @{
    text = "Healthora uptime alert"
    channel = $AlertChannel
    status = "down"
    failedChecks = $Failures.Count
    summary = $summary
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Depth 5

  try {
    Invoke-RestMethod -Uri $AlertWebhookUrl -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 10 | Out-Null
    Write-Host "[ALERT] Sent uptime alert."
  } catch {
    Write-Host "[ALERT] Failed to send uptime alert: $($_.Exception.Message)"
  }
}

$results = foreach ($check in $checks) {
  Invoke-UptimeCheck -Name $check.name -Url $check.url -OkStatus $check.okStatus
}

$history = [ordered]@{
  checkedAt = (Get-Date).ToUniversalTime().ToString("o")
  apiBase = $ApiBase
  frontendBase = $FrontendBase
  totalChecks = $results.Count
  failedChecks = @($results | Where-Object { -not $_.up }).Count
  results = $results
}

$historyLine = $history | ConvertTo-Json -Depth 8 -Compress
Add-Content -LiteralPath $HistoryPath -Value $historyLine

foreach ($result in $results) {
  $status = if ($result.up) { "OK" } else { "FAIL" }
  Write-Host "[$status] $($result.name) $($result.statusCode) $($result.latencyMs)ms $($result.url)"
  if ($result.error) {
    Write-Host "       $($result.error)"
  }
}

$failures = @($results | Where-Object { -not $_.up })
Send-UptimeAlert -Failures $failures

if ($failures.Count -gt 0) {
  Write-Host "$($failures.Count) uptime check(s) failed."
  exit 1
}

Write-Host "All uptime checks passed."
exit 0

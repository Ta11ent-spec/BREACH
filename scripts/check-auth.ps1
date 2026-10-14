param([int]$Port = 5093)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskOutput = Join-Path $taskRepo '.tmp/auth-smoke-api'
dotnet build (Join-Path $taskRepo 'backend/Breach.Intel.Api') -p:UseAppHost=false -o $taskOutput --nologo
if ($LASTEXITCODE -ne 0) { throw 'API build failed' }
$taskStart = [System.Diagnostics.ProcessStartInfo]::new('dotnet')
$taskStart.WorkingDirectory = Join-Path $taskRepo 'backend/Breach.Intel.Api'
$taskStart.ArgumentList.Add((Join-Path $taskOutput 'Breach.Intel.Api.dll'))
$taskStart.ArgumentList.Add('--urls')
$taskStart.ArgumentList.Add("http://127.0.0.1:$Port")
$taskStart.UseShellExecute = $false
$taskStart.CreateNoWindow = $true
$taskStart.RedirectStandardOutput = $true
$taskStart.RedirectStandardError = $true
$taskStart.Environment['ASPNETCORE_ENVIRONMENT'] = 'Development'
$taskStart.Environment['Auth0__Domain'] = 'example.us.auth0.com'
$taskStart.Environment['Auth0__Audience'] = 'https://breach-intel-api'
$taskProcess = [System.Diagnostics.Process]::Start($taskStart)
$taskStdout = $taskProcess.StandardOutput.ReadToEndAsync()
$taskStderr = $taskProcess.StandardError.ReadToEndAsync()
try {
  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    if ($taskProcess.HasExited) { throw 'Isolated API failed to start' }
    try {
      $taskResponse = Invoke-WebRequest "http://127.0.0.1:$Port/api/matches" -SkipHttpErrorCheck -TimeoutSec 2
      if ($taskResponse.StatusCode -eq 401) { $taskReady = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 200
  }
  if (!$taskReady) { throw 'Unauthenticated match request was not rejected' }
  foreach ($taskRoute in @('/api/account', '/api/workflows/status', '/api/squads')) {
    $taskResponse = Invoke-WebRequest "http://127.0.0.1:$Port$taskRoute" -SkipHttpErrorCheck -TimeoutSec 3
    if ($taskResponse.StatusCode -ne 401) { throw "Unexpected unauthenticated response at $taskRoute" }
  }
  # No real credential or personal record is used by this test.
  $taskResponse = Invoke-WebRequest "http://127.0.0.1:$Port/api/matches" -Headers @{Authorization='Bearer deliberately-invalid'} -SkipHttpErrorCheck -TimeoutSec 20
  if ($taskResponse.StatusCode -ne 401) { throw 'Invalid token was accepted' }
  Write-Output 'PASS: protected reads reject missing and invalid tokens.'
} finally {
  # This is the exact isolated process created above; existing servers are untouched.
  if (!$taskProcess.HasExited) { $taskProcess.Kill(); $taskProcess.WaitForExit() }
  $taskProcess.Dispose()
}

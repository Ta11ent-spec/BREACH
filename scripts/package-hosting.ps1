param(
    [Parameter(Mandatory=$true)][string]$Hostname
)
$ErrorActionPreference = 'Stop'
if ($Hostname -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$') { throw 'Supply the hostname only, without a scheme or path.' }
$repo = Split-Path $PSScriptRoot -Parent
$publish = Join-Path $repo ('releases/hosting-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Push-Location $repo
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    & dotnet publish backend/Breach.Intel.Api/Breach.Intel.Api.csproj -c Release -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'API publish failed.' }
    # Never distribute developer configuration or the local database connection.
    Get-ChildItem -LiteralPath $publish -Filter 'appsettings*.json' | Remove-Item
    @{ AllowedHosts = $Hostname } | ConvertTo-Json | Set-Content (Join-Path $publish 'appsettings.json') -Encoding utf8
    Copy-Item -LiteralPath (Join-Path $repo 'dist') -Destination (Join-Path $publish 'wwwroot') -Recurse
    # Distribute only the reviewed installer, never the build directory or local queue/config.
    $collectorRelease = Get-Content (Join-Path $repo 'public/downloads/collector-release.json') -Raw | ConvertFrom-Json
    if ($collectorRelease.version -notmatch '^\d+\.\d+\.\d+$' -or $collectorRelease.file -ne ('BREACH-Collector-Setup-' + $collectorRelease.version + '.exe')) { throw 'Invalid collector release metadata.' }
    $collectorInstaller = Join-Path $repo ('releases/collector/' + $collectorRelease.version + '-hosted/' + $collectorRelease.file)
    if ((Get-FileHash -LiteralPath $collectorInstaller -Algorithm SHA256).Hash -ne $collectorRelease.sha256 -or (Get-Item -LiteralPath $collectorInstaller).Length -ne $collectorRelease.bytes) { throw 'Collector installer does not match reviewed release metadata.' }
    Copy-Item -LiteralPath $collectorInstaller -Destination (Join-Path $publish ('wwwroot/downloads/' + $collectorRelease.file))
    Compress-Archive -Path (Join-Path $publish '*') -DestinationPath ($publish + '.zip')
    Write-Output "Hosting package: $publish"
    Write-Output 'Configure Auth0 and ConnectionStrings__BreachDatabase in the host before startup.'
} finally { Pop-Location }

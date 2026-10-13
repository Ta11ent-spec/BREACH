# Usage from PowerShell:
#   .\scripts\connect-github.ps1 -RepoUrl "https://github.com/YOU/breach-intel-website.git"
# GitHub repo should be empty (do not initialize it with a README).
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl
)
$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $projectRoot
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed. Install Git for Windows and restart VS Code.'
  }
  git rev-parse --is-inside-work-tree | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Git repository not found. Extract the ZIP with its hidden .git folder included.' }
  $existing = git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0) {
    if ($existing -ne $RepoUrl) {
      throw "An 'origin' remote already exists: $existing. Run git remote set-url origin <new-url> if you intend to replace it."
    }
    Write-Host "Using existing origin: $existing"
  } else {
    git remote add origin $RepoUrl
    if ($LASTEXITCODE -ne 0) { throw 'Failed to add GitHub remote.' }
    Write-Host "Added origin: $RepoUrl"
  }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed. Sign in through Git Credential Manager or check the repository URL and permissions.' }
  Write-Host 'Connected and pushed to GitHub. Future pushes work from VS Code Source Control.' -ForegroundColor Green
} finally {
  Pop-Location
}

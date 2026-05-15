# Automation readiness check (run from project root)
$ErrorActionPreference = "Continue"

function Ok([string]$msg) {
  Write-Host "[OK] $msg" -ForegroundColor Green
}
function Warn([string]$msg) {
  Write-Host "[--] $msg" -ForegroundColor Yellow
}
function Bad([string]$msg) {
  Write-Host "[!!] $msg" -ForegroundColor Red
}

$exitCode = 0

$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($machinePath -and $userPath) {
  $env:Path = "$machinePath;$userPath"
}

$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
  Bad "gh not found in PATH. Install GitHub CLI and restart the terminal."
  $exitCode = 1
}
else {
  Ok ("GitHub CLI: " + $ghCmd.Source)
  $authOutput = & gh auth status 2>&1
  if ($LASTEXITCODE -ne 0) {
    Bad "Not logged in to GitHub. Run: gh auth login"
    $exitCode = 1
  }
  else {
    Ok "GitHub CLI session active"
    $authOutput | ForEach-Object { Write-Host ("     " + $_) }
  }
}

if (Test-Path ".git") {
  Ok "Git repository detected"
  $remote = ""
  try {
    $remote = git remote get-url origin 2>$null
  }
  catch {
    $remote = ""
  }
  if ($remote) {
    Ok ("remote origin: " + $remote)
  }
  else {
    Warn "No git remote 'origin'. Add one or run: gh repo create ..."
    $exitCode = 1
  }
}
else {
  Warn "No .git folder here (run from project root)"
  $exitCode = 1
}

if ($env:GH_TOKEN) {
  Ok "GH_TOKEN is set"
}
else {
  Warn "GH_TOKEN not set (optional if gh auth login already done)"
}

if ($env:PUBLIC_SITE_URL) {
  Ok ("PUBLIC_SITE_URL=" + $env:PUBLIC_SITE_URL)
}
else {
  Warn "PUBLIC_SITE_URL not set (set GitHub Actions Variable for canonical URLs)"
}

exit $exitCode

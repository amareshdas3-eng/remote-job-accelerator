# ==============================================================================
# Remote Job Automator (RJA) v4.3 - Automated GitHub & Netlify Deploy Helper
# ==============================================================================

param(
    [string]$RepoName = "remote-job-accelerator",
    [switch]$Public = $false
)

$ErrorActionPreference = "Stop"

# Refresh environment PATH in current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RJA v4.3: Automated GitHub & Netlify Deployment Setup" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Check Git state
Write-Host "`n[1/4] Verifying Git Status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Local changes detected. Staging and committing..." -ForegroundColor DarkYellow
    git add -A
    git commit -m "Auto-commit before remote push"
}
Write-Host "✓ Local git tree is clean on branch main." -ForegroundColor Green

# 2. Verify GitHub CLI Authentication
Write-Host "`n[2/4] Checking GitHub CLI Authentication..." -ForegroundColor Yellow
$ghAuthCheck = & 'C:\Program Files\GitHub CLI\gh.exe' auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "! Not logged into GitHub. Launching interactive web login..." -ForegroundColor Yellow
    & 'C:\Program Files\GitHub CLI\gh.exe' auth login --web --git-protocol https
} else {
    Write-Host "✓ GitHub CLI is authenticated." -ForegroundColor Green
}

# 3. Create Remote GitHub Repository and Push
Write-Host "`n[3/4] Setting Up GitHub Remote Repository ($RepoName)..." -ForegroundColor Yellow
$visibility = if ($Public) { "--public" } else { "--private" }

$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "Remote 'origin' already exists: $(git remote get-url origin)" -ForegroundColor DarkGray
    Write-Host "Pushing main branch to origin..." -ForegroundColor Yellow
    git push -u origin main
} else {
    Write-Host "Creating GitHub repository '$RepoName' ($visibility) and pushing code..." -ForegroundColor Yellow
    & 'C:\Program Files\GitHub CLI\gh.exe' repo create $RepoName $visibility --source=. --remote=origin --push
}
Write-Host "✓ Successfully pushed code to GitHub!" -ForegroundColor Green

# 4. Verify Netlify CLI Authentication and Linking
Write-Host "`n[4/4] Configuring Netlify Site..." -ForegroundColor Yellow
$netlifyStatus = netlify status 2>&1
if ($netlifyStatus -match "Not logged in") {
    Write-Host "! Netlify is not authenticated. Opening browser to log into Netlify..." -ForegroundColor Yellow
    netlify login
} else {
    Write-Host "✓ Netlify CLI is authenticated." -ForegroundColor Green
}

Write-Host "`nInitializing and linking site with Netlify..." -ForegroundColor Yellow
netlify init

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  🎉 Setup Complete! Your app is now connected to GitHub and Netlify." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "`nNext Step: Run 'netlify env:import .env.local' to import your Supabase and AI keys to Netlify." -ForegroundColor Cyan

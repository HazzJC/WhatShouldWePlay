param(
  [string]$DatabaseName = "lets_play_games",
  [string]$DatabaseUser = "postgres",
  [string]$DatabasePassword = "postgres",
  [string]$DatabaseHost = "localhost",
  [int]$DatabasePort = 5432
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$psql = Get-Command "psql" -ErrorAction SilentlyContinue

if (!$psql) {
  $postgresPsql = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

  if (!$postgresPsql) {
    throw "psql was not found. Run scripts/check-dependencies.ps1 -InstallMissing first."
  }

  $psqlPath = $postgresPsql
} else {
  $psqlPath = $psql.Source
}

$env:PGPASSWORD = $DatabasePassword
$createdbPath = Join-Path (Split-Path $psqlPath -Parent) "createdb.exe"
if (!(Test-Path $createdbPath)) {
  throw "createdb was not found next to $psqlPath."
}

$existingDatabases = & $psqlPath -U $DatabaseUser -h $DatabaseHost -p $DatabasePort -d postgres -tAc "SELECT datname FROM pg_database;"
if ($LASTEXITCODE -ne 0) {
  throw "Could not connect to PostgreSQL as $DatabaseUser."
}

if ($existingDatabases -notcontains $DatabaseName) {
  & $createdbPath -U $DatabaseUser -h $DatabaseHost -p $DatabasePort $DatabaseName
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create database $DatabaseName."
  }
} else {
  Write-Host "Database $DatabaseName already exists."
}

$envPath = Join-Path $root ".env"
$databaseUrl = "postgresql://${DatabaseUser}:${DatabasePassword}@${DatabaseHost}:${DatabasePort}/${DatabaseName}?schema=public"
$envContent = @(
  "DATABASE_URL=`"$databaseUrl`"",
  "NEXT_PUBLIC_APP_URL=`"http://localhost:3000`""
)

Set-Content -Path $envPath -Value $envContent -Encoding utf8
Write-Host "Wrote $envPath"

Push-Location $root
try {
  npm run prisma:migrate
} finally {
  Pop-Location
}

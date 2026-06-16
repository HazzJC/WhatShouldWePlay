param(
  [switch]$InstallMissing,
  [switch]$IncludeOptional
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dependenciesFile = Join-Path $root "dependencies.txt"

if (!(Test-Path $dependenciesFile)) {
  throw "Could not find dependencies.txt at $dependenciesFile"
}

function Resolve-Command($Name) {
  if ($Name -eq "npm") {
    $npmCmd = Join-Path (Split-Path (Get-Command "node" -ErrorAction SilentlyContinue).Source -Parent) "npm.cmd"
    if (Test-Path $npmCmd) {
      return $npmCmd
    }
  }

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  if ($Name -eq "psql") {
    $postgresBin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1

    if ($postgresBin) {
      return $postgresBin
    }
  }

  return $null
}

function Test-Command($Name) {
  return [bool](Resolve-Command $Name)
}

function Invoke-Checked {
  param(
    [string]$Executable,
    [string[]]$ArgList
  )

  $resolvedExecutable = Resolve-Command $Executable
  if (!$resolvedExecutable) {
    $resolvedExecutable = $Executable
  }

  $process = Start-Process -FilePath $resolvedExecutable -ArgumentList $ArgList -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw "$Executable $($ArgList -join ' ') failed with exit code $($process.ExitCode)"
  }
}

function Install-WingetPackage($Id, $Name) {
  if (!(Test-Command "winget")) {
    throw "winget is required to install $Name automatically."
  }

  Write-Host "Installing $Name via winget package $Id..."
  Invoke-Checked -Executable "winget" -ArgList @("install", "--id", $Id, "--exact", "--accept-source-agreements", "--accept-package-agreements", "--silent")
}

$rows = Get-Content $dependenciesFile |
  Where-Object { $_.Trim() -and !$_.Trim().StartsWith("#") } |
  ForEach-Object {
    $parts = $_ -split "\|", 6
    [PSCustomObject]@{
      Kind     = $parts[0]
      Name     = $parts[1]
      Command  = $parts[2]
      WingetId = $parts[3]
      Required = $parts[4] -eq "yes"
      Notes    = $parts[5]
    }
  }

$missingRequired = @()
$missingOptional = @()

foreach ($dependency in $rows) {
  if ($dependency.Kind -eq "npm") {
    Write-Host "Installing project npm packages..."
    Push-Location $root
    try {
      if ((Test-Path (Join-Path $root "package-lock.json")) -and !(Test-Path (Join-Path $root "node_modules"))) {
        Invoke-Checked -Executable "npm" -ArgList @("ci")
      } else {
        Invoke-Checked -Executable "npm" -ArgList @("install")
      }
    } finally {
      Pop-Location
    }
    continue
  }

  if ($dependency.Kind -ne "tool") {
    Write-Warning "Unknown dependency kind '$($dependency.Kind)' for $($dependency.Name)."
    continue
  }

  if (Test-Command $dependency.Command) {
    $source = Resolve-Command $dependency.Command
    Write-Host "OK: $($dependency.Name) found at $source"
    continue
  }

  if ($dependency.Required) {
    $missingRequired += $dependency
  } else {
    $missingOptional += $dependency
  }

  if ($InstallMissing -and ($dependency.Required -or $IncludeOptional) -and $dependency.WingetId) {
    Install-WingetPackage $dependency.WingetId $dependency.Name
  }
}

if ($InstallMissing) {
  Write-Host ""
  Write-Host "Rechecking tools after install attempts..."
  foreach ($dependency in $rows | Where-Object { $_.Kind -eq "tool" }) {
    if (Test-Command $dependency.Command) {
      Write-Host "OK: $($dependency.Name)"
    } elseif ($dependency.Required) {
      Write-Warning "Still missing required tool: $($dependency.Name). You may need to restart the terminal or finish the installer."
    } else {
      Write-Host "Optional tool missing: $($dependency.Name)"
    }
  }
} else {
  if ($missingRequired.Count -gt 0) {
    Write-Warning "Missing required tools: $($missingRequired.Name -join ', ')"
    Write-Host "Run: powershell -ExecutionPolicy Bypass -File scripts/check-dependencies.ps1 -InstallMissing"
  }

  if ($missingOptional.Count -gt 0) {
    Write-Host "Optional tools missing: $($missingOptional.Name -join ', ')"
  }
}

Write-Host ""
Write-Host "Dependency check complete."

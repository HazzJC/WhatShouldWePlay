$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
  param(
    [string]$Executable,
    [string[]]$ArgList
  )

  $resolvedExecutable = $Executable
  if ($Executable -eq "npm") {
    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if ($node) {
      $npmCmd = Join-Path (Split-Path $node.Source -Parent) "npm.cmd"
      if (Test-Path $npmCmd) {
        $resolvedExecutable = $npmCmd
      }
    }
  }

  $process = Start-Process -FilePath $resolvedExecutable -ArgumentList $ArgList -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw "$Executable $($ArgList -join ' ') failed with exit code $($process.ExitCode)"
  }
}

Push-Location $root

try {
  $envPath = Join-Path $root ".env"
  if (Test-Path $envPath) {
    Get-Content $envPath |
      Where-Object { $_.Trim() -and !$_.Trim().StartsWith("#") -and $_.Contains("=") } |
      ForEach-Object {
        $key, $value = $_ -split "=", 2
        [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim().Trim('"'), "Process")
      }
  }

  if (!(Test-Path "node_modules")) {
    Invoke-Checked -Executable "npm" -ArgList @("ci")
  }

  Invoke-Checked -Executable "npm" -ArgList @("run", "lint")
  Invoke-Checked -Executable "npm" -ArgList @("test")

  if ($env:DATABASE_URL) {
    Invoke-Checked -Executable "npm" -ArgList @("run", "prisma:migrate")
  } else {
    Write-Warning "DATABASE_URL is not set. Skipping Prisma migration check."
  }

  Invoke-Checked -Executable "npm" -ArgList @("run", "build")
} finally {
  Pop-Location
}

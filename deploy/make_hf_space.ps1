<#
  Assemble a clean Hugging Face Docker Space folder for the IGNITE-AI backend, and zip it.

  Usage (PowerShell 5+, from anywhere):
    powershell -ExecutionPolicy Bypass -File deploy\make_hf_space.ps1
    powershell -ExecutionPolicy Bypass -File deploy\make_hf_space.ps1 -OutDir C:\Users\User\ignite-hf-space -Zip C:\Users\User\ignite-hf-space.zip

  Result (Space repo root):
    README.md      (HF front matter: sdk docker, app_port 7860)
    Dockerfile     (python:3.11.9-slim, uid 1000, uvicorn on 7860)
    .dockerignore
    backend\       (app, src, data without artifacts/parquet, scripts, tests, requirements.txt)

  Model artifacts are NOT copied: the Docker build retrains them (python -m src.compute.model),
  which also keeps the Space free of binary files (the HF Hub only accepts binaries via Xet/LFS).
#>
param(
  [string]$OutDir = (Join-Path $env:USERPROFILE "ignite-hf-space"),
  [string]$Zip    = (Join-Path $env:USERPROFILE "ignite-hf-space.zip")
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $repo "backend"
$tpl  = Join-Path $PSScriptRoot "hf-space"

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

Copy-Item (Join-Path $tpl "Dockerfile")    $OutDir
Copy-Item (Join-Path $tpl "README.md")     $OutDir
Copy-Item (Join-Path $tpl ".dockerignore") $OutDir

# Copy backend\ without caches, virtualenvs, raw downloads, generated artifacts or binary data.
$excludeDirs  = @("__pycache__", ".pytest_cache", ".venv", "venv", "pdfs", "raw", "artifacts")
$excludeFiles = @("*.pyc", "*.log", "*.parquet", "*.joblib")
$dest = Join-Path $OutDir "backend"
robocopy $src $dest /E /NFL /NDL /NJH /NJS /NP /XD $excludeDirs /XF $excludeFiles | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
$global:LASTEXITCODE = 0

# Zip with forward-slash entry names (Compress-Archive on PowerShell 5 writes backslashes,
# which break on Linux). Files sit at the zip root, ready to upload as the Space repo.
if ($Zip) {
  if (Test-Path $Zip) { Remove-Item -Force $Zip }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $root = (Resolve-Path $OutDir).Path.TrimEnd('\') + '\'
  $archive = [System.IO.Compression.ZipFile]::Open($Zip, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -Recurse -File -Force $OutDir | ForEach-Object {
      $rel = $_.FullName.Substring($root.Length).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $archive.Dispose() }
}

$files = Get-ChildItem -Recurse -File -Force $OutDir
$size  = ($files | Measure-Object Length -Sum).Sum
Write-Host ("Space folder: {0}  ({1} files, {2:N0} KB)" -f $OutDir, $files.Count, ($size / 1KB))
if ($Zip) { Write-Host ("Zip:          {0}  ({1:N0} KB)" -f $Zip, ((Get-Item $Zip).Length / 1KB)) }

# Compress existing fallback/logs/*.xes.yaml to *.xes.yaml.gz and remove uncompressed files.
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/compress-fallback-logs.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$fallbackLogsDir = "fallback\logs"

function Save-BytesAsGzipFile {
    param(
        [Parameter(Mandatory)][string]$DestGzPath,
        [Parameter(Mandatory)][byte[]]$Utf8Bytes
    )
    $ms = New-Object System.IO.MemoryStream
    try {
        $gzip = New-Object System.IO.Compression.GZipStream(
            $ms,
            [System.IO.Compression.CompressionMode]::Compress
        )
        try {
            $gzip.Write($Utf8Bytes, 0, $Utf8Bytes.Length)
        } finally {
            $gzip.Dispose()
        }
        [System.IO.File]::WriteAllBytes($DestGzPath, $ms.ToArray())
    } finally {
        $ms.Dispose()
    }
}

if (-not (Test-Path $fallbackLogsDir)) {
    Write-Host "No fallback\logs directory found." -ForegroundColor Yellow
    exit 0
}

$yamlFiles = Get-ChildItem -Path $fallbackLogsDir -Filter "*.xes.yaml" -File
if ($yamlFiles.Count -eq 0) {
    Write-Host "No uncompressed .xes.yaml files to compress." -ForegroundColor Yellow
    exit 0
}

$beforeBytes = ($yamlFiles | Measure-Object -Property Length -Sum).Sum
$compressed = 0
$skipped = 0

Write-Host "Compressing $($yamlFiles.Count) log files..." -ForegroundColor Cyan

foreach ($file in $yamlFiles) {
    $gzPath = Join-Path $fallbackLogsDir ($file.Name + ".gz")

    if ((Test-Path $gzPath) -and ((Get-Item $gzPath).LastWriteTimeUtc -ge $file.LastWriteTimeUtc)) {
        Remove-Item $file.FullName -Force
        $skipped++
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    Save-BytesAsGzipFile -DestGzPath $gzPath -Utf8Bytes $bytes
    Remove-Item $file.FullName -Force
    $compressed++
}

$afterBytes = (Get-ChildItem -Path $fallbackLogsDir -Filter "*.xes.yaml.gz" -File |
    Measure-Object -Property Length -Sum).Sum

$beforeMB = [math]::Round($beforeBytes / 1MB, 2)
$afterMB = [math]::Round($afterBytes / 1MB, 2)
$savedPct = if ($beforeBytes -gt 0) { [math]::Round((1 - ($afterBytes / $beforeBytes)) * 100, 1) } else { 0 }

Write-Host "Compressed: $compressed | Skipped (already gz): $skipped" -ForegroundColor Green
Write-Host "Size: ${beforeMB} MB -> ${afterMB} MB (~${savedPct}% smaller)" -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Green

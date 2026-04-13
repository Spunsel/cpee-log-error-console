# PowerShell script to fetch logs that contain the questionnaire link
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-questionnaire-logs.ps1
#
# Encoding: use DownloadData + UTF-8 decode (not WebClient.DownloadString) so YAML
# with non-ASCII text is not corrupted on Windows (.NET Framework default encoding).

# Process numbers to scan
$processNumbers = @(8654..9000)

$questionnaireLink = "https://spunsel.github.io/cpee-log-error-console/"

# Skip logs whose first event date is strictly before this day (DD.MM.YYYY: 13.04.2026)
$minimumLogDate = [DateTime]::new(2026, 4, 13)

# Initialize SSL bypass
Write-Host "Initializing..." -ForegroundColor Cyan
add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) {
        return true;
    }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::DefaultConnectionLimit = 50

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Create directories
$outputDir = "questionnaire-logs"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# ========== STEP 1: Get UUIDs ==========
Write-Host "`nFetching UUIDs for $($processNumbers.Count) process numbers..." -ForegroundColor Cyan

$uuidMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()

$runspacePool = [runspacefactory]::CreateRunspacePool(1, 20)
$runspacePool.Open()

$uuidScript = {
    param($processNumber)
    try {
        $wc = New-Object System.Net.WebClient
        try {
            $bytes = $wc.DownloadData("https://cpee.org/flow/engine/$processNumber/properties/attributes/uuid/")
            $uuid = [System.Text.Encoding]::UTF8.GetString($bytes).Trim()
        } finally {
            $wc.Dispose()
        }
        if ($uuid -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
            return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true }
        }
    } catch {}
    return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false }
}

$jobs = $processNumbers | ForEach-Object {
    $ps = [powershell]::Create().AddScript($uuidScript).AddArgument($_)
    $ps.RunspacePool = $runspacePool
    @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

$completed = 0
$found = 0
foreach ($job in $jobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    if ($result.Success) {
        $uuidMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
        $found++
    }
    $completed++
    if ($completed % 50 -eq 0 -or $completed -eq $processNumbers.Count) {
        Write-Host "`rProgress: $completed/$($processNumbers.Count) checked, $found UUIDs found" -NoNewline
    }
}
$runspacePool.Close()
$runspacePool.Dispose()
Write-Host "`nFound $($uuidMapping.Count) UUIDs total" -ForegroundColor Green

# ========== STEP 2: Fetch Logs and Filter by Questionnaire Link ==========
Write-Host "`nFetching logs and filtering for questionnaire link..." -ForegroundColor Cyan

$logScript = {
    param($processNumber, $uuid, $link)
    try {
        $wc = New-Object System.Net.WebClient
        try {
            $bytes = $wc.DownloadData("https://cpee.org/logs/$uuid.xes.yaml")
            $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        } finally {
            $wc.Dispose()
        }
        if ($content -match [regex]::Escape($link)) {
            return @{ ProcessNumber = $processNumber; UUID = $uuid; Content = $content; Success = $true; Selected = $true }
        }
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Content = $null; Success = $true; Selected = $false }
    } catch {
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Content = $null; Success = $false; Selected = $false }
    }
}

$logRunspacePool = [runspacefactory]::CreateRunspacePool(1, 10)
$logRunspacePool.Open()

$logJobs = @()
foreach ($kvp in $uuidMapping.GetEnumerator()) {
    $ps = [powershell]::Create().AddScript($logScript).AddArgument($kvp.Key).AddArgument($kvp.Value).AddArgument($questionnaireLink)
    $ps.RunspacePool = $logRunspacePool
    $logJobs += @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

$logCompleted = 0
$savedCount = 0
$skippedOldCount = 0
foreach ($job in $logJobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()

    if ($result.Selected -and $result.Content) {
        # Parse the first timestamp from the log
        # XES YAML timestamps look like: "time:timestamp: '2026-03-31T20:34:00.000+01:00'"
        $timestampMatch = [regex]::Match($result.Content, "time:timestamp:\s*['""]?(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})")
        $excludeByDate = $false
        if ($timestampMatch.Success) {
            $year  = [int]$timestampMatch.Groups[1].Value
            $month = [int]$timestampMatch.Groups[2].Value
            $day   = [int]$timestampMatch.Groups[3].Value
            try {
                $firstEventDate = [DateTime]::new($year, $month, $day).Date
                if ($firstEventDate -lt $minimumLogDate.Date) {
                    $excludeByDate = $true
                }
            } catch {
                $excludeByDate = $false
            }
        }

        if (-not $excludeByDate) {
            if ($timestampMatch.Success) {
                $yearS  = $timestampMatch.Groups[1].Value
                $monthS = $timestampMatch.Groups[2].Value
                $dayS   = $timestampMatch.Groups[3].Value
                $hour   = $timestampMatch.Groups[4].Value
                $min    = $timestampMatch.Groups[5].Value
                $fileName = "date_${yearS}_${monthS}_${dayS}_time_${hour}_${min}.xes.yaml"
            } else {
                # Fallback: use UUID if no timestamp found
                $fileName = "$($result.UUID).xes.yaml"
            }

            $filePath = Join-Path $outputDir $fileName
            [System.IO.File]::WriteAllText($filePath, $result.Content, $utf8NoBom)
            $savedCount++
            Write-Host "`n  Saved: $fileName (instance $($result.ProcessNumber))" -ForegroundColor Green
        } else {
            $skippedOldCount++
            Write-Host "`n  Skipped (before $($minimumLogDate.ToString('yyyy-MM-dd'))): instance $($result.ProcessNumber)" -ForegroundColor DarkYellow
        }
    }

    $logCompleted++
    if ($logCompleted % 50 -eq 0 -or $logCompleted -eq $uuidMapping.Count) {
        Write-Host "`rProgress: $logCompleted/$($uuidMapping.Count) logs checked, $savedCount saved" -NoNewline
    }
}
$logRunspacePool.Close()
$logRunspacePool.Dispose()

Write-Host "`n`nDone! Saved $savedCount questionnaire log(s) to $outputDir (skipped $skippedOldCount older than $($minimumLogDate.ToString('yyyy-MM-dd')))" -ForegroundColor Green

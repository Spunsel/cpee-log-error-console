# PowerShell script to fetch UUIDs and logs from CPEE
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-and-update.ps1

# Process numbers to fetch
$processNumbers = @(1..6000)

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

# Create directories
$tempUuidDir = "scripts\temp\uuids"
$tempLogDir = "scripts\temp\logs"
$fallbackDir = "fallback"
$fallbackLogsDir = "fallback\logs"

@($tempUuidDir, $tempLogDir, $fallbackDir, $fallbackLogsDir) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

# ========== STEP 0: Load existing mappings ==========
$fallbackMappingFile = "fallback\uuid-mapping.json"
$existingMappings = @{}
if (Test-Path $fallbackMappingFile) {
    $existingContent = Get-Content $fallbackMappingFile -Raw
    $existingJson = ConvertFrom-Json $existingContent
    $existingJson.PSObject.Properties | ForEach-Object {
        $existingMappings[$_.Name] = $_.Value
    }
    Write-Host "Loaded $($existingMappings.Count) existing mappings from uuid-mapping.json" -ForegroundColor Yellow
}

# ========== STEP 1: Get UUIDs (from existing mappings first, then flow engine) ==========
Write-Host "`nGetting UUIDs for $($processNumbers.Count) process numbers..." -ForegroundColor Cyan

$uuidMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()

# First, check existing mappings for these process numbers
$fromExisting = 0
$needFetch = @()
foreach ($num in $processNumbers) {
    $numStr = "$num"
    if ($existingMappings.ContainsKey($numStr)) {
        $uuidMapping.TryAdd($numStr, $existingMappings[$numStr]) | Out-Null
        $fromExisting++
    } else {
        $needFetch += $num
    }
}
Write-Host "Found $fromExisting UUIDs from existing mappings" -ForegroundColor Green

# Fetch remaining from flow engine
if ($needFetch.Count -gt 0) {
    Write-Host "Fetching $($needFetch.Count) UUIDs from flow engine..." -ForegroundColor Cyan
    
    $runspacePool = [runspacefactory]::CreateRunspacePool(1, 20)
    $runspacePool.Open()

    $uuidScript = {
        param($processNumber)
        try {
            $uuid = (New-Object System.Net.WebClient).DownloadString("https://cpee.org/flow/engine/$processNumber/properties/attributes/uuid/").Trim()
            if ($uuid -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
                return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true }
            }
        } catch {}
        return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false }
    }

    $jobs = $needFetch | ForEach-Object {
        $ps = [powershell]::Create().AddScript($uuidScript).AddArgument($_)
        $ps.RunspacePool = $runspacePool
        @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
    }

    $completed = 0
    $fromEngine = 0
    foreach ($job in $jobs) {
        $result = $job.PowerShell.EndInvoke($job.Handle)
        $job.PowerShell.Dispose()
        if ($result.Success) {
            $uuidMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
            $fromEngine++
        }
        $completed++
        if ($completed % 50 -eq 0 -or $completed -eq $needFetch.Count) {
            Write-Host "`rProgress: $completed/$($needFetch.Count) checked, $fromEngine found" -NoNewline
        }
    }
    $runspacePool.Close()
    $runspacePool.Dispose()
    Write-Host "`nFound $fromEngine additional UUIDs from flow engine" -ForegroundColor Green
}

Write-Host "Total UUIDs to process: $($uuidMapping.Count)" -ForegroundColor Green

# ========== STEP 2: Fetch Logs ==========
Write-Host "`nFetching logs (filtering for 'exposition')..." -ForegroundColor Cyan

$selectedMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
Remove-Item -Path "$tempLogDir\*" -Force -ErrorAction SilentlyContinue

$logScript = {
    param($processNumber, $uuid, $outputDir)
    try {
        $content = (New-Object System.Net.WebClient).DownloadString("https://cpee.org/logs/$uuid.xes.yaml")
        if ($content.Substring(0, [Math]::Min($content.Length, 1000000)) -match "exposition") {
            [System.IO.File]::WriteAllText((Join-Path $outputDir "${uuid}_v2.xes.yaml"), $content)
            return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true; Selected = $true }
        }
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true; Selected = $false }
    } catch {
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $false }
    }
}

$logRunspacePool = [runspacefactory]::CreateRunspacePool(1, 10)
$logRunspacePool.Open()

$logJobs = @()
foreach ($kvp in $uuidMapping.GetEnumerator()) {
    $ps = [powershell]::Create().AddScript($logScript).AddArgument($kvp.Key).AddArgument($kvp.Value).AddArgument($tempLogDir)
    $ps.RunspacePool = $logRunspacePool
    $logJobs += @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

$logCompleted = 0
foreach ($job in $logJobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    if ($result.Success -and $result.Selected) {
        $selectedMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
    }
    $logCompleted++
    if ($logCompleted % 50 -eq 0 -or $logCompleted -eq $uuidMapping.Count) {
        Write-Host "`rProgress: $logCompleted/$($uuidMapping.Count) logs checked, $($selectedMapping.Count) selected" -NoNewline
    }
}
$logRunspacePool.Close()
$logRunspacePool.Dispose()
Write-Host "`nSelected $($selectedMapping.Count) logs with exposition" -ForegroundColor Green

# ========== STEP 3: Save to Fallback ==========
Write-Host "`nSaving to fallback..." -ForegroundColor Cyan

# Use the existing mappings we already loaded
$combinedHash = @{}
$existingMappings.GetEnumerator() | ForEach-Object {
    $combinedHash[$_.Key] = $_.Value
}
Write-Host "Using $($combinedHash.Count) existing mappings as base" -ForegroundColor Yellow

$addedInstances = @()
# Add new mappings with prefixed process numbers
# 3-digit numbers get "200" prefix, 4-digit numbers get "20" prefix
# UUID gets "_v2" suffix so fallback uses the _v2 log files
$newCount = 0
$selectedMapping.GetEnumerator() | ForEach-Object {
    $originalNum = $_.Key
    $numLength = $originalNum.Length
    $uuid = $_.Value
    
    # Apply prefix based on digit count
    if ($numLength -eq 1) {
        $prefixedKey = "20000$originalNum"
    }
    elseif ($numLength -eq 2) {
        $prefixedKey = "2000$originalNum"
    }
    elseif ($numLength -eq 3) {
        $prefixedKey = "200$originalNum"
    } elseif ($numLength -eq 4) {
        $prefixedKey = "20$originalNum"
    } else {
        $prefixedKey = $originalNum
    }
    
    # Append _v2 to UUID for prefixed keys so fallback finds the _v2 log files
    $uuidWithSuffix = "${uuid}_v2"
    
    if (-not $combinedHash.ContainsKey($prefixedKey)) {
        $newCount++
        $addedInstances += $prefixedKey
    }
    $combinedHash[$prefixedKey] = $uuidWithSuffix
}


# Save combined mapping
$sortedKeys = $combinedHash.Keys | Sort-Object { [int]$_ }
$json = "{" + "`n" + (($sortedKeys | ForEach-Object { "  `"$_`": `"$($combinedHash[$_])`"" }) -join ",`n") + "`n}"
[System.IO.File]::WriteAllText($fallbackMappingFile, $json)
Write-Host "UUID mapping saved to fallback\uuid-mapping.json ($newCount new, $($combinedHash.Count) total)" -ForegroundColor Green

# Copy logs (with _v2 suffix)
$logFiles = Get-ChildItem -Path $tempLogDir -Filter "*_v2.xes.yaml" -File
if ($logFiles.Count -gt 0) {
    $logFiles | ForEach-Object { Copy-Item $_.FullName -Destination $fallbackLogsDir -Force }
    Write-Host "Copied $($logFiles.Count) log files to fallback\logs (with _v2 suffix)" -ForegroundColor Green
}

if ($addedInstances.Count -gt 0) {
    $addedInstances =
        $addedInstances |
        Sort-Object { [int]$_ } -Descending

    $output = $addedInstances -join ", "
    Write-Host "`nNew instances added (with prefix): $output" -ForegroundColor Cyan
} else {
    Write-Host "`nNo new instances were added." -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green

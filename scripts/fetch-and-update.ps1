# PowerShell script to fetch UUIDs and logs from CPEE
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-and-update.ps1

# Process numbers to fetch
$processNumbers = @(142587..160000)

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

# ========== STEP 1: Fetch UUIDs ==========
Write-Host "`nFetching UUIDs for $($processNumbers.Count) process numbers..." -ForegroundColor Cyan

$uuidMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
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

$jobs = $processNumbers | ForEach-Object {
    $ps = [powershell]::Create().AddScript($uuidScript).AddArgument($_)
    $ps.RunspacePool = $runspacePool
    @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

$completed = 0
foreach ($job in $jobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    if ($result.Success) {
        $uuidMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
    }
    $completed++
    if ($completed % 50 -eq 0 -or $completed -eq $processNumbers.Count) {
        Write-Host "`rProgress: $completed/$($processNumbers.Count) UUIDs fetched" -NoNewline
    }
}
$runspacePool.Close()
$runspacePool.Dispose()
Write-Host "`nFound $($uuidMapping.Count) valid UUIDs" -ForegroundColor Green

# ========== STEP 2: Fetch Logs ==========
Write-Host "`nFetching logs (filtering for 'exposition')..." -ForegroundColor Cyan

$selectedMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
Remove-Item -Path "$tempLogDir\*" -Force -ErrorAction SilentlyContinue

$logScript = {
    param($processNumber, $uuid, $outputDir)
    try {
        $content = (New-Object System.Net.WebClient).DownloadString("https://cpee.org/logs/$uuid.xes.yaml")
        if ($content.Substring(0, [Math]::Min($content.Length, 1000000)) -match "exposition") {
            [System.IO.File]::WriteAllText((Join-Path $outputDir "$uuid.xes.yaml"), $content)
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

# Load existing UUID mapping and merge with new ones
$fallbackMappingFile = "fallback\uuid-mapping.json"
$combinedHash = @{}

# Read existing mappings if file exists
if (Test-Path $fallbackMappingFile) {
    Write-Host "Loading existing UUID mappings..." -ForegroundColor Yellow
    $existingContent = Get-Content $fallbackMappingFile -Raw
    $existingMapping = ConvertFrom-Json $existingContent
    $existingMapping.PSObject.Properties | ForEach-Object {
        $combinedHash[$_.Name] = $_.Value
    }
    Write-Host "Found $($combinedHash.Count) existing mappings" -ForegroundColor Yellow
}

$addedInstances = @()
# Add new mappings (will overwrite duplicates with new values)
$newCount = 0
$selectedMapping.GetEnumerator() | ForEach-Object {
    if (-not $combinedHash.ContainsKey($_.Key)) {
        $newCount++
        $addedInstances += [int]$_.Key
    }
    $combinedHash[$_.Key] = $_.Value
}


# Save combined mapping
$sortedKeys = $combinedHash.Keys | Sort-Object { [int]$_ }
$json = "{" + "`n" + (($sortedKeys | ForEach-Object { "  `"$_`": `"$($combinedHash[$_])`"" }) -join ",`n") + "`n}"
[System.IO.File]::WriteAllText($fallbackMappingFile, $json)
Write-Host "UUID mapping saved to fallback\uuid-mapping.json ($newCount new, $($combinedHash.Count) total)" -ForegroundColor Green

# Copy logs
$logFiles = Get-ChildItem -Path $tempLogDir -Filter "*.xes.yaml" -File
if ($logFiles.Count -gt 0) {
    $logFiles | ForEach-Object { Copy-Item $_.FullName -Destination $fallbackLogsDir -Force }
    Write-Host "Copied $($logFiles.Count) log files to fallback\logs" -ForegroundColor Green
}

if ($addedInstances.Count -gt 0) {
    $addedInstances =
        $addedInstances |
        Sort-Object -Descending

    $output = $addedInstances -join ", "
    Write-Host "`nNew instances added: $output" -ForegroundColor Cyan
} else {
    Write-Host "`nNo new instances were added." -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green

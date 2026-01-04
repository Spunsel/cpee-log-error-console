# PowerShell script to fetch UUIDs from process numbers, bypassing SSL certificate errors
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-uuids.ps1

# Bypass SSL certificate validation
add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint, X509Certificate certificate,
        WebRequest request, int certificateProblem) {
        return true;
    }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Increase connection limit for parallel requests
[System.Net.ServicePointManager]::DefaultConnectionLimit = 50

# Process numbers to fetch UUIDs for (from ConfigManager.js)
# previous: 8618..99344
# previous: 73190..99428
# previous: 99328..101454
$processNumbers = @(101454..101464) # | Where-Object { $_ -ne 98647 }

# Output file
$outputFile = "scripts\temp\uuids\uuid-mapping.json"

# Create output directory if needed
$outputDir = Split-Path $outputFile -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$total = $processNumbers.Count

# Thread-safe collections for parallel processing
$uuidMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
$failed = [System.Collections.Concurrent.ConcurrentBag[int]]::new()
$completed = [ref]0

# Number of parallel threads (adjust based on server tolerance)
$throttleLimit = 20

Write-Host "Fetching UUIDs for $total process numbers (parallel, $throttleLimit threads)..." -ForegroundColor Blue

# Create runspace pool for parallel execution
$runspacePool = [runspacefactory]::CreateRunspacePool(1, $throttleLimit)
$runspacePool.Open()

$scriptBlock = {
    param($processNumber)
    
    $url = "https://cpee.org/flow/engine/$processNumber/properties/attributes/uuid/"
    
    try {
        $webClient = New-Object System.Net.WebClient
        $uuid = $webClient.DownloadString($url).Trim()
        
        # Validate UUID format
        if ($uuid -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
            return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true }
        } else {
            return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false; Error = "Invalid UUID: $uuid" }
        }
    }
    catch {
        return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false; Error = $_.Exception.Message }
    }
}

# Start all jobs
$jobs = @()
foreach ($processNumber in $processNumbers) {
    $powershell = [powershell]::Create().AddScript($scriptBlock).AddArgument($processNumber)
    $powershell.RunspacePool = $runspacePool
    $jobs += @{
        PowerShell = $powershell
        Handle = $powershell.BeginInvoke()
        ProcessNumber = $processNumber
    }
}

# Collect results with progress
$successCount = 0
$failCount = 0
foreach ($job in $jobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    
    $completed.Value++
    
    if ($result.Success) {
        $uuidMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
        $successCount++
    } else {
        $failed.Add($result.ProcessNumber) | Out-Null
        $failCount++
    }
    
    # Progress update every 100 items
    if ($completed.Value % 100 -eq 0 -or $completed.Value -eq $total) {
        Write-Host "`r[$($completed.Value)/$total] Success: $successCount, Failed: $failCount" -NoNewline
    }
}

$runspacePool.Close()
$runspacePool.Dispose()

Write-Host ""
Write-Host ""
Write-Host "Successfully fetched: $successCount/$total" -ForegroundColor Green

$failedArray = $failed.ToArray()
if ($failedArray.Count -gt 0) {
    Write-Host "Failed: $($failedArray.Count)" -ForegroundColor Red
    if ($failedArray.Count -le 20) {
        Write-Host "Failed process numbers: $($failedArray -join ', ')"
    }
}

# Convert to JSON with numerically sorted keys
$mappingHash = @{}
foreach ($kvp in $uuidMapping.GetEnumerator()) {
    $mappingHash[$kvp.Key] = $kvp.Value
}

$sortedKeys = $mappingHash.Keys | Sort-Object { [int]$_ }
$jsonLines = @("{")
$lastKey = $sortedKeys[-1]
foreach ($key in $sortedKeys) {
    $comma = if ($key -eq $lastKey) { "" } else { "," }
    $jsonLines += "  `"$key`": `"$($mappingHash[$key])`"$comma"
}
$jsonLines += "}"
$json = $jsonLines -join "`n"
[System.IO.File]::WriteAllText($outputFile, $json)

Write-Host ""
Write-Host "UUID mapping saved to: $outputFile" -ForegroundColor Cyan


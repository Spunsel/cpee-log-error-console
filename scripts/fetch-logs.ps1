# PowerShell script to fetch CPEE logs, bypassing SSL certificate errors
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-logs.ps1
#
# Reads UUID mapping from scripts/temp/uuids/uuid-mapping.json
# Only saves logs that contain "exposition" (indicating steps with graph data)
# Outputs:
#   - scripts/temp/logs/*.xes.yaml (filtered log files)
#   - scripts/temp/uuids/uuid-mapping-selected.json (mapping for selected logs)

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

# Input file (UUID mapping from fetch-uuids.ps1)
$inputFile = "scripts\temp\uuids\uuid-mapping.json"

# Check if input file exists
if (-not (Test-Path $inputFile)) {
    Write-Host "Error: UUID mapping file not found: $inputFile" -ForegroundColor Red
    Write-Host "Run fetch-uuids.ps1 first to generate the UUID mapping." -ForegroundColor Yellow
    exit 1
}

# Read UUID mapping from JSON
$jsonContent = Get-Content $inputFile -Raw
$uuidMapping = ConvertFrom-Json $jsonContent

# Convert PSCustomObject to hashtable for easier iteration
$mappingHashtable = @{}
$uuidMapping.PSObject.Properties | ForEach-Object {
    $mappingHashtable[$_.Name] = $_.Value
}

# Create output directory and clear existing contents
$outputDir = "scripts\temp\logs"
if (Test-Path $outputDir) {
    Remove-Item -Path "$outputDir\*" -Force -Recurse
} else {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$total = $mappingHashtable.Count

# Thread-safe collections for parallel processing
$selectedMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
$failed = [System.Collections.Concurrent.ConcurrentBag[string]]::new()
$fetchedCount = [ref]0
$selectedCount = [ref]0
$completed = [ref]0

# Number of parallel threads (lower than UUID fetch since log files can be large)
$throttleLimit = 10

Write-Host "Fetching $total log files (parallel, $throttleLimit threads, filtering for 'exposition')..." -ForegroundColor Blue

# Create runspace pool for parallel execution
$runspacePool = [runspacefactory]::CreateRunspacePool(1, $throttleLimit)
$runspacePool.Open()

$scriptBlock = {
    param($processNumber, $uuid, $outputDir)
    
    $url = "https://cpee.org/logs/$uuid.xes.yaml"
    $outputFile = Join-Path $outputDir "$uuid.xes.yaml"
    
    try {
        $webClient = New-Object System.Net.WebClient
        $content = $webClient.DownloadString($url)
        
        # Check if first 1000000 characters contain "exposition" (indicates steps with graph data)
        $checkLength = [Math]::Min($content.Length, 1000000)
        $contentToCheck = $content.Substring(0, $checkLength)
        
        if ($contentToCheck -match "exposition") {
            # Save to file
            [System.IO.File]::WriteAllText($outputFile, $content)
            $sizeKB = [math]::Round($content.Length / 1024, 1)
            return @{ 
                ProcessNumber = $processNumber
                UUID = $uuid
                Success = $true
                Selected = $true
                SizeKB = $sizeKB
            }
        } else {
            return @{ 
                ProcessNumber = $processNumber
                UUID = $uuid
                Success = $true
                Selected = $false
            }
        }
    }
    catch {
        return @{ 
            ProcessNumber = $processNumber
            UUID = $uuid
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Start all jobs
$jobs = @()
foreach ($entry in $mappingHashtable.GetEnumerator()) {
    $processNumber = $entry.Key
    $uuid = $entry.Value
    
    $powershell = [powershell]::Create().AddScript($scriptBlock).AddArgument($processNumber).AddArgument($uuid).AddArgument($outputDir)
    $powershell.RunspacePool = $runspacePool
    $jobs += @{
        PowerShell = $powershell
        Handle = $powershell.BeginInvoke()
        ProcessNumber = $processNumber
        UUID = $uuid
    }
}

# Collect results with progress
$successCount = 0
$selectedTotal = 0
$failCount = 0

foreach ($job in $jobs) {
    $result = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    
    $completed.Value++
    
    if ($result.Success) {
        $successCount++
        if ($result.Selected) {
            $selectedMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
            $selectedTotal++
        }
    } else {
        $failed.Add($result.ProcessNumber) | Out-Null
        $failCount++
    }
    
    # Progress update every 50 items
    if ($completed.Value % 50 -eq 0 -or $completed.Value -eq $total) {
        Write-Host "`r[$($completed.Value)/$total] Fetched: $successCount, Selected: $selectedTotal, Failed: $failCount" -NoNewline
    }
}

$runspacePool.Close()
$runspacePool.Dispose()

# Save selected UUID mapping
$selectedOutputFile = "scripts\temp\uuids\uuid-mapping-selected.json"

# Convert ConcurrentDictionary to regular hashtable for sorting
$selectedHash = @{}
foreach ($kvp in $selectedMapping.GetEnumerator()) {
    $selectedHash[$kvp.Key] = $kvp.Value
}

$sortedKeys = $selectedHash.Keys | Sort-Object { [int]$_ }
$jsonLines = @("{")
if ($sortedKeys.Count -gt 0) {
    $lastKey = $sortedKeys[-1]
    foreach ($key in $sortedKeys) {
        $comma = if ($key -eq $lastKey) { "" } else { "," }
        $jsonLines += "  `"$key`": `"$($selectedHash[$key])`"$comma"
    }
}
$jsonLines += "}"
$json = $jsonLines -join "`n"
[System.IO.File]::WriteAllText($selectedOutputFile, $json)

Write-Host ""
Write-Host ""
Write-Host "========== Summary ==========" -ForegroundColor Cyan
Write-Host "Total processed: $total"
Write-Host "Successfully fetched: $successCount" -ForegroundColor Green
Write-Host "Selected (with exposition): $selectedTotal" -ForegroundColor Green

$failedArray = $failed.ToArray()
if ($failedArray.Count -gt 0) {
    Write-Host "Failed: $($failedArray.Count)" -ForegroundColor Red
    if ($failedArray.Count -le 20) {
        Write-Host "Failed process numbers: $($failedArray -join ', ')"
    }
}

Write-Host ""
Write-Host "Log files saved to: $outputDir" -ForegroundColor Cyan
Write-Host "Selected mapping saved to: $selectedOutputFile" -ForegroundColor Cyan

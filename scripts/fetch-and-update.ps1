# PowerShell script to fetch UUIDs and logs from CPEE
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-and-update.ps1
#
# Encoding: WebClient.DownloadString() uses the system default code page on Windows
# (.NET Framework), which corrupts UTF-8 YAML (e.g. ü -> Ã¼). Logs are fetched as
# raw bytes and decoded as UTF-8; files are written as UTF-8 without BOM.

# Process numbers to fetch
$processNumbers = @(45000..45117)

# Current generation — new entries are written into this generation's section.
# Change to "generation3" (or any name) to start a new generation bucket.
$currentGeneration = "generation2"

# Resolve project root (parent of scripts/)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

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

# $allGenerations holds the full nested structure: { generation1: {...}, generation2: {...}, ... }
# $existingMappings holds only the current generation's flat entries: { processNumber: uuid }
$allGenerations   = [ordered]@{}
$existingMappings = @{}

if (Test-Path $fallbackMappingFile) {
    $existingContent = Get-Content $fallbackMappingFile -Raw
    $existingJson    = ConvertFrom-Json $existingContent

    # Detect nested vs. flat format
    $isNested = $existingJson.PSObject.Properties | Where-Object { $_.Value -is [pscustomobject] }
    if ($isNested) {
        # Nested format: copy each generation into $allGenerations
        $existingJson.PSObject.Properties | ForEach-Object {
            $genEntries = [ordered]@{}
            $_.Value.PSObject.Properties | ForEach-Object { $genEntries[$_.Name] = $_.Value }
            $allGenerations[$_.Name] = $genEntries
        }
        # Extract the current generation's entries as the working mapping
        if ($allGenerations.Contains($currentGeneration)) {
            $allGenerations[$currentGeneration].GetEnumerator() | ForEach-Object {
                $existingMappings[$_.Key] = $_.Value
            }
        }
    } else {
        # Legacy flat format: treat everything as belonging to the current generation
        $existingJson.PSObject.Properties | ForEach-Object {
            $existingMappings[$_.Name] = $_.Value
        }
    }
    Write-Host "Loaded $($existingMappings.Count) existing mappings for generation '$currentGeneration'" -ForegroundColor Yellow
}

# ========== STEP 1: Get UUIDs (always query the flow engine for the current range) ==========
Write-Host "`nGetting UUIDs for $($processNumbers.Count) process numbers..." -ForegroundColor Cyan

$uuidMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()

# Always fetch fresh UUIDs from the flow engine — never use cached values.
# Instance numbers can be reused across runs; a cached UUID may point to an archived
# instance instead of the current one.
$needFetch = $processNumbers

if ($needFetch.Count -gt 0) {
    Write-Host "Fetching $($needFetch.Count) UUIDs from flow engine..." -ForegroundColor Cyan
    
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

    $jobs = $needFetch | ForEach-Object {
        $ps = [powershell]::Create().AddScript($uuidScript).AddArgument($_)
        $ps.RunspacePool = $runspacePool
        @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
    }

    $completed = 0
    $fromEngine = 0
    foreach ($job in $jobs) {
        $resultCollection = $job.PowerShell.EndInvoke($job.Handle)
        $job.PowerShell.Dispose()
        $result = $resultCollection | Select-Object -Last 1
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
        $wc = New-Object System.Net.WebClient
        try {
            $bytes = $wc.DownloadData("https://cpee.org/logs/$uuid.xes.yaml")
            $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        } finally {
            $wc.Dispose()
        }
        if ($content.Substring(0, [Math]::Min($content.Length, 1000000)) -match "exposition") {
            $outPath = Join-Path $outputDir "${uuid}.xes.yaml"
            [System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding $false))
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
$absLogDir = (Resolve-Path $tempLogDir).Path
foreach ($kvp in $uuidMapping.GetEnumerator()) {
    $ps = [powershell]::Create().AddScript($logScript).AddArgument($kvp.Key).AddArgument($kvp.Value).AddArgument($absLogDir)
    $ps.RunspacePool = $logRunspacePool
    $logJobs += @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

$logCompleted = 0
foreach ($job in $logJobs) {
    $resultCollection = $job.PowerShell.EndInvoke($job.Handle)
    $job.PowerShell.Dispose()
    $result = $resultCollection | Select-Object -Last 1
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

# Build the updated entries for the current generation.
# Remove any legacy unprefixed keys whose numeric value falls within the current fetch
# range so stale single-run entries never shadow a fresh server result.
$processNumberSet = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]($processNumbers | ForEach-Object { "$_" })
)
$currentGenEntries = [ordered]@{}
$skippedLegacy = 0
$existingMappings.GetEnumerator() | ForEach-Object {
    if ($processNumberSet.Contains($_.Key)) {
        $skippedLegacy++
    } else {
        $currentGenEntries[$_.Key] = $_.Value
    }
}
if ($skippedLegacy -gt 0) {
    Write-Host "Removed $skippedLegacy legacy entries that overlap with current fetch range" -ForegroundColor Yellow
}

$addedInstances = @()
$newCount = 0
$selectedMapping.GetEnumerator() | ForEach-Object {
    $originalNum = $_.Key
    $uuid        = $_.Value

    # In generation2 the key stored in the JSON is the plain instance number.
    # Other generations (1, future) also use the plain number directly.
    $entryKey = $originalNum

    if (-not $currentGenEntries.ContainsKey($entryKey)) {
        $newCount++
        $addedInstances += $entryKey
    }
    $currentGenEntries[$entryKey] = $uuid
}

# Merge back into the full nested structure
$allGenerations[$currentGeneration] = $currentGenEntries

# Sort keys within each generation numerically
$sortedGenerations = [ordered]@{}
foreach ($genName in $allGenerations.Keys) {
    $sorted = [ordered]@{}
    $allGenerations[$genName].Keys | Sort-Object { [int]$_ } | ForEach-Object {
        $sorted[$_] = $allGenerations[$genName][$_]
    }
    $sortedGenerations[$genName] = $sorted
}

# Serialise nested JSON manually for readability
$genBlocks = @()
foreach ($genName in $sortedGenerations.Keys) {
    $lines = $sortedGenerations[$genName].Keys | ForEach-Object {
        "    `"$_`": `"$($sortedGenerations[$genName][$_])`""
    }
    $genBlocks += "  `"$genName`": {`n" + ($lines -join ",`n") + "`n  }"
}
$json = "{`n" + ($genBlocks -join ",`n") + "`n}"

$absFallbackMapping = Join-Path (Resolve-Path $fallbackDir).Path "uuid-mapping.json"
[System.IO.File]::WriteAllText($absFallbackMapping, $json, $utf8NoBom)

$totalEntries = ($sortedGenerations.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
Write-Host "UUID mapping saved ($newCount new in '$currentGeneration', $totalEntries total across all generations)" -ForegroundColor Green

# Copy logs
$logFiles = Get-ChildItem -Path $tempLogDir -Filter "*.xes.yaml" -File
if ($logFiles.Count -gt 0) {
    $logFiles | ForEach-Object { Copy-Item $_.FullName -Destination $fallbackLogsDir -Force }
    Write-Host "Copied $($logFiles.Count) log files to fallback\logs" -ForegroundColor Green
}

if ($addedInstances.Count -gt 0) {
    $addedInstances =
        $addedInstances |
        Sort-Object { [int]$_ } -Descending

    $output = $addedInstances -join ", "
    Write-Host "`nNew instances added to '$currentGeneration': $output" -ForegroundColor Cyan
} else {
    Write-Host "`nNo new instances were added." -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green

# PowerShell script to fetch UUIDs and logs from CPEE
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-and-update.ps1
#
# Encoding: WebClient.DownloadString() uses the system default code page on Windows
# (.NET Framework), which corrupts UTF-8 YAML (e.g. ü -> Ã¼). Logs are fetched as
# raw bytes and decoded as UTF-8; files are written as UTF-8 without BOM.

# Process numbers to fetch
$processNumbers = @(57267..73693)

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
[System.Net.ServicePointManager]::DefaultConnectionLimit = 500

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

# ========== STEPS 1+2: Fetch UUIDs and logs in a single pipeline ==========
# Each worker fetches the UUID for a process number then immediately fetches and
# filters the log — eliminating the forced serialisation between the two phases.
# Results are collected out-of-order as jobs finish rather than waiting for each
# job in submission order.
Write-Host "`nFetching UUIDs and logs for $($processNumbers.Count) process numbers..." -ForegroundColor Cyan

Remove-Item -Path "$tempLogDir\*" -Force -ErrorAction SilentlyContinue
$absLogDir = (Resolve-Path $tempLogDir).Path

$uuidMapping     = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()
$selectedMapping = [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()

$combinedScript = {
    param($processNumber, $outputDir)
    # Fetch UUID — always fresh; instance numbers can be reused across runs.
    try {
        $wc = New-Object System.Net.WebClient
        try {
            $bytes = $wc.DownloadData("https://cpee.org/flow/engine/$processNumber/properties/attributes/uuid/")
            $uuid = [System.Text.Encoding]::UTF8.GetString($bytes).Trim()
        } finally {
            $wc.Dispose()
        }
    } catch {
        return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false; Selected = $false }
    }
    if ($uuid -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
        return @{ ProcessNumber = $processNumber; UUID = $null; Success = $false; Selected = $false }
    }

    # UUID valid — immediately fetch and filter the log.
    try {
        $wc2 = New-Object System.Net.WebClient
        try {
            $logBytes = $wc2.DownloadData("https://cpee.org/logs/$uuid.xes.yaml")
            $content  = [System.Text.Encoding]::UTF8.GetString($logBytes)
        } finally {
            $wc2.Dispose()
        }
        if ($content.Substring(0, [Math]::Min($content.Length, 1000000)) -match "exposition") {
            $outPath = Join-Path $outputDir "${uuid}.xes.yaml"
            [System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding $false))
            return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true; Selected = $true }
        }
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true; Selected = $false }
    } catch {
        return @{ ProcessNumber = $processNumber; UUID = $uuid; Success = $true; Selected = $false }
    }
}

$runspacePool = [runspacefactory]::CreateRunspacePool(1, 100)
$runspacePool.Open()

$jobs = $processNumbers | ForEach-Object {
    $ps = [powershell]::Create().AddScript($combinedScript).AddArgument($_).AddArgument($absLogDir)
    $ps.RunspacePool = $runspacePool
    @{ PowerShell = $ps; Handle = $ps.BeginInvoke() }
}

# Drain completed jobs out-of-order so a slow request never blocks faster ones.
$pending      = [System.Collections.Generic.List[object]]::new()
$pending.AddRange($jobs)
$completed    = 0
$uuidFound    = 0
$selected     = 0
$lastReported = 0
$total        = $processNumbers.Count

while ($pending.Count -gt 0) {
    $doneIdx = [System.Collections.Generic.List[int]]::new()
    for ($i = 0; $i -lt $pending.Count; $i++) {
        if (-not $pending[$i].Handle.IsCompleted) { continue }
        $result = $pending[$i].PowerShell.EndInvoke($pending[$i].Handle) | Select-Object -Last 1
        $pending[$i].PowerShell.Dispose()
        if ($result.Success) {
            $uuidMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
            $uuidFound++
            if ($result.Selected) {
                $selectedMapping.TryAdd("$($result.ProcessNumber)", $result.UUID) | Out-Null
                $selected++
            }
        }
        $completed++
        $doneIdx.Add($i)
    }
    if ($doneIdx.Count -eq 0) {
        Start-Sleep -Milliseconds 50
    } else {
        # Remove in reverse order to preserve list indices.
        $doneIdx.Reverse()
        foreach ($idx in $doneIdx) { $pending.RemoveAt($idx) }
        if (($completed - $lastReported) -ge 50 -or $pending.Count -eq 0) {
            Write-Host "`rProgress: $completed/$total checked | $uuidFound UUIDs found | $selected selected" -NoNewline
            $lastReported = $completed
        }
    }
}

$runspacePool.Close()
$runspacePool.Dispose()
Write-Host "`nFound $uuidFound UUIDs; $selected logs match 'exposition'" -ForegroundColor Green

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

    if (-not $currentGenEntries.Contains($entryKey)) {
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

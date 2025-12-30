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

# Process numbers to fetch UUIDs for (from ConfigManager.js)
$processNumbers = @(
    98618

    # 98615, 88803, 88782, 88781, 88753, 88741, 88740, 88719, 88503, 85514, 85513,
    # 84963, 84957, 84954, 84953, 84950, 84949, 84946, 84945, 84882, 84747, 84687, 83316, 83313,
    # 83268, 83265, 83264, 83260, 83258, 83256, 83254, 83252, 83242, 83241, 83213, 83199,
    # 83193, 83170, 83162, 83131, 83129, 83125, 83124, 82868, 82862, 82268, 82267, 82264,
    # 82263, 82226, 82187, 82151, 82143, 82141, 82120, 82118, 82117, 82116, 82115, 82114, 82072,
    # 82060, 82050, 82025, 82019, 81951, 77655, 77526, 77275, 77237, 77235, 77228, 77050, 77013,
    # 76934, 76762, 76600, 76461, 76403, 76400, 76397, 76385, 75608, 75605, 75050, 75048, 75015,
    # 75001, 75000, 74996, 74992, 74976, 74974, 74971, 74966, 73589, 73557, 73373, 73227, 73190
)

# Output file
$outputFile = "fallback\uuid-mapping.json"

# Create fallback directory if needed
$outputDir = Split-Path $outputFile -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$total = $processNumbers.Count
$uuidMapping = @{}
$failed = @()
$i = 0

Write-Host "Fetching UUIDs for $total process numbers..." -ForegroundColor Blue

foreach ($processNumber in $processNumbers) {
    $i++
    $url = "https://cpee.org/flow/engine/$processNumber/properties/attributes/uuid/"
    
    Write-Host "[$i/$total] Fetching UUID for process $processNumber..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        $uuid = $response.Content.Trim()
        
        # Validate UUID format
        if ($uuid -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
            $uuidMapping["$processNumber"] = $uuid
            Write-Host " $uuid" -ForegroundColor Green
        } else {
            Write-Host " Invalid UUID: $uuid" -ForegroundColor Yellow
            $failed += $processNumber
        }
    }
    catch {
        Write-Host " FAILED" -ForegroundColor Red
        $failed += $processNumber
    }
    
    # Small delay
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "Successfully fetched: $($uuidMapping.Count)/$total" -ForegroundColor Green

if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count)" -ForegroundColor Red
    Write-Host "Failed process numbers: $($failed -join ', ')"
}

# Convert to JSON with numerically sorted keys
$sortedKeys = $uuidMapping.Keys | Sort-Object { [int]$_ }
$jsonLines = @("{")
$lastKey = $sortedKeys[-1]
foreach ($key in $sortedKeys) {
    $comma = if ($key -eq $lastKey) { "" } else { "," }
    $jsonLines += "  `"$key`": `"$($uuidMapping[$key])`"$comma"
}
$jsonLines += "}"
$json = $jsonLines -join "`n"
[System.IO.File]::WriteAllText($outputFile, $json)

Write-Host ""
Write-Host "UUID mapping saved to: $outputFile" -ForegroundColor Cyan


# PowerShell script to fetch CPEE logs, bypassing SSL certificate errors
# Run from the cpee-log-error-console directory:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-logs.ps1

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

# UUID mapping
$uuidMapping = @{
    "73190" = "6d6e4139-8d99-4657-abe8-2e0b16bc828e"
    "73227" = "3856549a-2b6a-4420-bb83-e6542805feae"
    "73373" = "2321853f-7e1d-4d18-a316-7353895d7e03"
    "73557" = "9c645f9d-06b4-42c9-8d3c-1e5f27a712a2"
    "73589" = "d49db69e-2042-46b6-bcb4-da8de847cc43"
    "74966" = "ba362ef4-fbac-4d27-9002-4714b5ac43be"
    "74971" = "609d1c6c-e9df-4336-832d-47e8eed1b459"
    "74974" = "f2563c5e-8840-4c0d-b641-a5aa8422a6c3"
    "74976" = "5d62f7d9-b5f9-4a82-bf28-72c0755e8c28"
    "74992" = "1d860aeb-d018-4770-8619-9c3252f07398"
    "74996" = "1e7dfb2b-67ff-4b76-ab78-f182dcd9d14b"
    "75000" = "52d86c1c-c304-4e10-81f7-34b6de7f0b47"
    "75001" = "2a7de27a-6c13-4471-b7e3-d958a995e0fb"
    "75015" = "03fe516d-e424-4321-bc92-9880e1adca24"
    "75048" = "ede0dff5-2e52-4bea-8e64-42714694c5e8"
    "75050" = "ddbf9243-a428-4f0a-9bec-896e8204bb5c"
    "75605" = "a1f624f1-b64d-45c1-be97-e4ec34733176"
    "75608" = "1db0cfc7-c934-4d5a-81b3-96a427bf9371"
    "76385" = "f9e60f44-8c29-484a-9660-9fa761c3d102"
    "76397" = "7ea4d238-0cf4-447d-b0a5-a9fa5828e9fd"
    "76400" = "baefa66c-241c-45b9-8917-8934c5c4b250"
    "76403" = "121f641a-7963-4789-80c4-e441b7060e27"
    "76461" = "8bb67cbf-db5d-439e-aacd-b8efe02e4609"
    "76600" = "95252495-af40-48ca-86a9-e202f9fa5e28"
    "76762" = "5784fada-4110-495f-bf45-fa7df459f331"
    "76934" = "c608e67c-5334-4981-aca1-f835925292f3"
    "77013" = "b25c99e6-8434-4231-869b-8aebc5fd0db9"
    "77050" = "f2b4a478-57b0-4360-a1ae-b77fa23b381f"
    "77228" = "e37beea2-cf8a-4cb0-a3b3-93f04d4286bd"
    "77235" = "8c4b9bc1-c1a1-4a34-a3af-243661583a72"
    "77237" = "63dad1eb-71e2-4d8c-9739-56b5eeb43f6f"
    "77275" = "e1d02e41-7b26-4c4c-bb37-06ee2449053a"
    "77526" = "869ad6cf-d719-4e7d-8d68-d5dfb5ec0869"
    "77655" = "b33e395f-8f8a-441c-83e6-ca1e066bc193"
    "81951" = "9b5b409a-8027-475f-89c5-4e7b919cb0b5"
    "82019" = "d7ea46e1-37cd-4560-a40a-374c30553d0a"
    "82025" = "cbd5f66e-334e-4b92-9d1b-1a92ae033ca7"
    "82050" = "2466ac47-8dcc-4b8d-9f6b-bc8addf7a287"
    "82060" = "82099a88-5627-41c9-9998-0ab250fe4934"
    "82072" = "18d6ddf5-abb5-4b2a-985d-d89faffe79ae"
    "82114" = "aaf5763e-b6ca-44f6-ab60-efc37371b2e2"
    "82115" = "0afbf2c0-4d98-4180-aec0-87e970ac7f14"
    "82116" = "680b10be-e3fc-4a16-a60b-129de1de3d94"
    "82117" = "ae8b00c3-ef0e-4239-9fb4-5e237dc626f9"
    "82118" = "061b782e-05de-4070-b3df-492f71af9a8b"
    "82120" = "0c84c8e5-b9ff-4884-befc-28c5e6cd8df0"
    "82141" = "d5d44cb6-c236-4851-b136-f0c1f417604a"
    "82143" = "4734c9a4-326f-4a4b-a2a8-8ac39ec3b72a"
    "82151" = "58353131-f648-483e-8cfa-604e2dfd823e"
    "82187" = "32686756-ac12-4f5d-b5c8-62e00e4d8331"
    "82226" = "d0d346be-e6ee-41b7-aa10-5af33752df9f"
    "82263" = "20211dd3-3ed9-4185-8759-4e22852baae4"
    "82264" = "05a93f45-20ca-4b5a-81dd-34dc34b0d03c"
    "82267" = "f846bf22-e448-4125-ace0-d8d6903455c1"
    "82268" = "4123c109-4f2b-4156-9f7d-13f72458ae11"
    "82862" = "3c68b0e8-5774-4023-9285-8b3cc20997c8"
    "82868" = "8836c44b-4c7c-46eb-ac41-578bd3e226ef"
    "83124" = "ca43e9e7-62c5-498b-9069-93fc82c50e9d"
    "83125" = "9afe5a03-f033-4236-8770-828892c883af"
    "83129" = "57b4df3b-7942-460d-93d9-4c6b859e6d76"
    "83131" = "40a8f9fc-d66d-4955-ba5c-203dd783e5df"
    "83162" = "9696aac2-3f08-4101-b96d-8f63c9aeea49"
    "83170" = "9d881240-6636-4d74-b7c1-65690e64744e"
    "83193" = "c47e1fdf-2961-4bb3-9249-81fdb25c9d34"
    "83199" = "aa2b892b-c9db-4112-a577-b56f13a9fd13"
    "83213" = "b3fae0a6-7b15-4778-9cb6-5eaa53601fb7"
    "83241" = "8c013e08-d59f-43a3-ac9d-ed5bce397eda"
    "83242" = "dbe78460-17c4-426e-b401-7eb0f9804924"
    "83252" = "5db051d4-7336-4440-9f1f-eda660b205ae"
    "83254" = "ec4d661e-b5aa-4660-8b0f-56374c03535f"
    "83256" = "0b5ffdb9-e2c9-491b-af04-15ab37ce5f38"
    "83258" = "05f877ab-8196-48d4-8e40-0d48ca53bbfa"
    "83260" = "2f9dc463-52a9-484a-babf-f897dd576013"
    "83264" = "1a5c30c2-34bc-45da-b305-3408387bb0ae"
    "83265" = "997c82cf-adb5-40bb-ad59-1bc0207768bd"
    "83268" = "fff67038-bc8b-460c-a2d9-eabe559b2136"
    "83313" = "5d2fd2a8-ef2d-4562-bec3-84febf87bf22"
    "83316" = "99cc9b15-3095-4a54-890b-145576ff3f96"
    "84687" = "3777e8c7-34a6-4d30-9543-8fa8fb4eaa95"
    "84747" = "8a22c296-daa5-4acf-b167-4286c998e54e"
    "84882" = "f00d10dd-1479-41be-a94d-009575ae1481"
    "84945" = "079f0182-6fba-43d5-9857-dd8f0a479c67"
    "84946" = "6d8936d1-dc6d-438a-9808-2dffea4c6825"
    "84949" = "8204e193-f884-463a-be6d-c66dfa300d36"
    "84950" = "1a79dd6c-7340-4ffb-b577-246ea3bd0444"
    "84953" = "fc3ec6c9-6df0-4ab7-883c-9052c44f7e1d"
    "84954" = "518a382e-7819-4392-8466-10eef048a2ac"
    "84957" = "fe7f496c-b1bc-4eb1-b1b9-e8e1d1807952"
    "84963" = "7728555c-b94a-48c9-9acd-47dec69e61e8"
    "85513" = "f2eb8493-0c6c-45e8-ba5e-79e172e61b40"
    "85514" = "09b29533-a72e-46f8-afbb-b33ab730fcf9"
    "88503" = "01343eb0-0766-4ddc-bb0f-3288c17dd6f1"
    "88719" = "f1213a1a-5afb-49a0-a336-254808b4bf23"
    "88740" = "66688969-5874-4866-aa33-58cf810140a2"
    "88741" = "21c8a5bf-08b4-46e5-a41c-ef98d43f38d7"
    "88753" = "3837ba43-0bcd-4f24-a592-cf32e2439f51"
    "88781" = "9d313cb7-880c-468f-9e8b-0d85263280a5"
    "88782" = "ba175a56-8459-4c57-aeec-1affbd01ca23"
    "88803" = "a6f59c21-c26e-4082-b2d7-9dcf7d060580"
    "98615" = "cb8751fa-bac0-44ad-9b57-7db46d62a9cd"
}

# Create output directory
$outputDir = "public\fallback\logs"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$total = $uuidMapping.Count
$success = 0
$failed = @()
$i = 0

Write-Host "Fetching $total log files..." -ForegroundColor Blue

foreach ($entry in $uuidMapping.GetEnumerator()) {
    $processNumber = $entry.Key
    $uuid = $entry.Value
    $i++
    
    $url = "https://cpee.org/logs/$uuid.xes.yaml"
    $outputFile = Join-Path $outputDir "$uuid.xes.yaml"
    
    Write-Host "[$i/$total] Fetching $uuid (process $processNumber)..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        $content = $response.Content
        
        # Save to file
        [System.IO.File]::WriteAllText($outputFile, $content)
        
        $sizeKB = [math]::Round($content.Length / 1024, 1)
        Write-Host " OK ($sizeKB KB)" -ForegroundColor Green
        $success++
    }
    catch {
        Write-Host " FAILED" -ForegroundColor Red
        $failed += $processNumber
    }
    
    # Small delay
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "Successfully fetched: $success/$total" -ForegroundColor Green

if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count)" -ForegroundColor Red
    Write-Host "Failed process numbers: $($failed -join ', ')"
}

Write-Host ""
Write-Host "Log files saved to: $outputDir" -ForegroundColor Cyan


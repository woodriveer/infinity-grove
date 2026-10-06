# Exports the API's OpenAPI document to shared/openapi/openapi.json (refactor AD-10).
# Tooling only: builds the Api project and runs the Swashbuckle CLI against it.
# The host is resolved but never started, so no database is needed.
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $backend
$out = Join-Path $repo 'shared/openapi/openapi.json'
Push-Location $backend
try {
    dotnet tool restore | Out-Null
    dotnet build src/InfinityGrove.Backend.Api/InfinityGrove.Backend.Api.csproj -c Release --nologo -v q
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    New-Item -ItemType Directory -Force (Split-Path -Parent $out) | Out-Null
    dotnet swagger tofile --output $out src/InfinityGrove.Backend.Api/bin/Release/net8.0/InfinityGrove.Backend.Api.dll v1
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    # Normalize to LF so the CI diff check is platform-independent.
    $text = [IO.File]::ReadAllText($out) -replace "`r`n", "`n"
    [IO.File]::WriteAllText($out, $text, (New-Object Text.UTF8Encoding $false))
}
finally { Pop-Location }

# Regenerates shared/test-vectors/*.json from VectorGen (refactor RFR-19, AD-18).
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$out = Join-Path (Split-Path -Parent $backend) 'shared/test-vectors'
dotnet run -c Release --project (Join-Path $backend 'tools/InfinityGrove.VectorGen') -- --out $out
exit $LASTEXITCODE

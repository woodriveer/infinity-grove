$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$reader = New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
$payload = $reader.ReadToEnd()
if ($payload -like '*.terminal_hook_5109dd12-f80e-4f2d-9dc3-5f0084b54b85*') { [Console]::Out.Write('{"decision":"block","reason":"Não é permitido sobrescrever o próprio script de guardrail da descoberta"}'); exit 0 }
if ($payload -match '\.antstack[\\/]') { [Console]::Out.Write('{"decision":"approve"}'); exit 0 }
[Console]::Out.Write('{"decision":"block","reason":"Só é permitido escrever dentro de .antstack/ durante a descoberta"}')

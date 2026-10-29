$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$editorUrl = 'http://127.0.0.1:4177'
try { $null = Invoke-RestMethod "$editorUrl/api/state" -TimeoutSec 2 }
catch {
    $nodePath = (Get-Command node.exe).Source
    $scriptPath = Join-Path $projectRoot 'editor/server.mjs'
    $logFolder = Join-Path $projectRoot 'editor/data'
    New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $scriptPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logFolder 'server.log') -RedirectStandardError (Join-Path $logFolder 'server-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        try { $null = Invoke-RestMethod "$editorUrl/api/state" -TimeoutSec 2; $ready = $true; break } catch { }
    }
    if (-not $ready) { throw 'Editor could not start. Check editor/data/server-error.log.' }
}
Start-Process $editorUrl

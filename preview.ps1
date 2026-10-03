$ErrorActionPreference='Stop'
try {
 Set-Location -LiteralPath $env:TEMP
 $address='http://localhost:4175/'
 function Test-Preview {try {$response=Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2;return ($response.Content -match 'GIS' -and $response.Content -match 'id="globe"')} catch {return $false}}
 if(-not (Test-Preview)) {
  $node=(Get-Command node -ErrorAction Stop).Source
  if(-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\cesium\Build\Cesium\Cesium.js'))){throw 'Run npm install in the ai-risk folder first.'}
  Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $PSScriptRoot 'server.cjs')+'"') -WindowStyle Hidden
  $ready=$false
  for($attempt=0;$attempt -lt 20;$attempt++){if(Test-Preview){$ready=$true;break};Start-Sleep -Milliseconds 300}
  if(-not $ready){throw 'Could not start GIS preview on port 4175.'}
 }
 Start-Process $address
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}

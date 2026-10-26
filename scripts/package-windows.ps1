param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '1.1.2')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (!(Test-Path -LiteralPath 'dist/models/pose_landmarker_lite.task')) { throw 'Run node scripts/launch.mjs --prepare-only first.' }
$buildRoot = Join-Path $projectRoot '.packaging'
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
$nodeArchive = Join-Path $buildRoot 'node-v24.19.0-win-x64.zip'
if (!(Test-Path -LiteralPath $nodeArchive)) {
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip' -OutFile $nodeArchive
}
$nodeHash = (Get-FileHash -LiteralPath $nodeArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($nodeHash -ne '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73') { throw 'Official Node.js archive checksum mismatch.' }
$nodeRoot = Join-Path $buildRoot 'node-v24.19.0-win-x64'
if (!(Test-Path -LiteralPath $nodeRoot)) { Expand-Archive -LiteralPath $nodeArchive -DestinationPath $buildRoot }
$stage = Join-Path $buildRoot ('flag-windows-' + $Version + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($folder in @('runtime','scripts','licenses')) { New-Item -ItemType Directory -Path (Join-Path $stage $folder) | Out-Null }
Copy-Item -LiteralPath 'dist' -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $nodeRoot 'node.exe') -Destination (Join-Path $stage 'runtime/node.exe')
Copy-Item -LiteralPath (Join-Path $nodeRoot 'LICENSE') -Destination (Join-Path $stage 'licenses/NODE-LICENSE.txt')
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE' -OutFile (Join-Path $stage 'licenses/MEDIAPIPE-LICENSE.txt')
Copy-Item -LiteralPath 'node_modules/@mediapipe/tasks-vision/README.md' -Destination (Join-Path $stage 'licenses/MEDIAPIPE-README.md')
foreach ($name in @('serve.mjs','leaderboard.mjs','export-gifticon.mjs')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $stage 'scripts') }
foreach ($name in @('START-WINDOWS.bat','EXPORT-GIFTICON.bat','WINDOWS-시작안내.txt')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stage }
foreach ($packageName in @('@mediapipe/tasks-vision','vite')) {
    $packageRoot = Join-Path $projectRoot ('node_modules/' + $packageName)
    Get-ChildItem -LiteralPath $packageRoot -File | Where-Object { $_.Name -match '^(LICENSE|NOTICE|COPYING)' } | ForEach-Object {
        $licenseName = ($packageName -replace '[@/]','-') + '-' + $_.Name
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stage ('licenses/' + $licenseName))
    }
}
if ((Test-Path -LiteralPath (Join-Path $stage 'data')) -or (Test-Path -LiteralPath (Join-Path $stage 'exports'))) { throw 'Private records must not be packaged.' }
Get-ChildItem -LiteralPath $stage -Filter '*.bat' | ForEach-Object {
    $batchText = [IO.File]::ReadAllText($_.FullName) -replace '\r?\n', "`r`n"
    [IO.File]::WriteAllText($_.FullName, $batchText, [Text.ASCIIEncoding]::new())
}
$outputRoot = Join-Path $projectRoot ('release/' + $Version)
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$zip = Join-Path $outputRoot 'flag-windows-x64.zip'
if (Test-Path -LiteralPath $zip) { throw 'Release ZIP already exists. Move it before packaging a new release.' }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Get-FileHash -LiteralPath $zip -Algorithm SHA256 | Format-List
Write-Output ('STAGING_DIRECTORY=' + $stage)
Write-Output ('RELEASE_ZIP=' + $zip)

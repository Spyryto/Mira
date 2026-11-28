$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repo 'dist\studio'
$package = Join-Path $repo 'dist\windows-portable'
if (!(Test-Path (Join-Path $source 'ide-bundle.js'))) { throw 'Build Studio IDE first' }
if (!(Test-Path (Join-Path $source 'ide-third-party-licenses.txt'))) { throw 'Missing editor licenses' }
$version = (& node --version).Trim()
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v22\.\d+\.\d+$') { throw 'Node 22 runtime required' }
$archive = "node-$version-win-x64.zip"
$download = Join-Path ([System.IO.Path]::GetTempPath()) ("mira-node-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $download | Out-Null
try {
    $base = "https://nodejs.org/dist/$version"
    $zip = Join-Path $download $archive
    Invoke-WebRequest -Uri "$base/$archive" -OutFile $zip
    $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt").Content
    $line = ($sums -split "\r?\n" | Where-Object { $_ -match ('^[0-9a-f]{64}\s+' + [regex]::Escape($archive) + '$') } | Select-Object -First 1)
    if (!$line) { throw 'Official checksum missing' }
    $expected = ($line -split '\s+')[0]
    if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Runtime checksum mismatch' }
    Expand-Archive -LiteralPath $zip -DestinationPath $download
    $node = Join-Path $download "node-$version-win-x64"
    if (Test-Path $package) { Remove-Item $package -Recurse -Force }
    New-Item -ItemType Directory -Path "$package\runtime","$package\dist\studio" | Out-Null
    Copy-Item "$node\node.exe","$node\LICENSE" -Destination "$package\runtime"
    Copy-Item "$source\*" -Destination "$package\dist\studio" -Recurse
    Copy-Item (Join-Path $repo 'scripts\studio-desktop.mjs') $package
    Copy-Item (Join-Path $repo 'desktop\windows\*') $package
    New-Item -ItemType Directory -Path "$package\reference-sources" | Out-Null
    Copy-Item (Join-Path $repo 'lib'),(Join-Path $repo 'examples'),(Join-Path $repo 'catalog') -Destination "$package\reference-sources" -Recurse
    $metadata = @{ runtime = $version; architecture = 'win-x64'; archiveSHA256 = $expected; revision = $env:GITHUB_SHA }
    $metadata | ConvertTo-Json | Set-Content (Join-Path $package 'build-info.json') -Encoding utf8
    & "$package\runtime\node.exe" --version
    if ($LASTEXITCODE -ne 0) { throw 'Portable runtime failed' }
    $bytes = (Get-ChildItem $package -Recurse -File | Measure-Object Length -Sum).Sum
    Write-Host "Portable Studio unpacked bytes: $bytes"
} finally {
    Remove-Item $download -Recurse -Force
}

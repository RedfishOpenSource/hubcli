param(
    [string]$Version,
    [string]$NodeVersion = "20.19.0",
    [string]$StageRoot = "release/stage/windows-x64",
    [string]$DistRoot = "release/dist",
    [string]$PyInstallerExe = "pyinstaller",
    [string]$IsccExe = "iscc"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw -Path $packageJsonPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = $packageJson.version
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Unable to determine release version from $packageJsonPath"
}
$stageRootPath = Join-Path $projectRoot $StageRoot
$distRootPath = Join-Path $projectRoot $DistRoot
$workerDistPath = Join-Path $projectRoot "dist/hubcli-worker"
$workerSpecPath = Join-Path $projectRoot "packaging/python/hubcli-worker.spec"
$nodeZipPath = Join-Path $distRootPath "node-v$NodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$portableName = "hubcli-windows-x64-portable.zip"
$playwrightPath = Join-Path $projectRoot "ms-playwright"

New-Item -ItemType Directory -Force -Path $distRootPath | Out-Null
Remove-Item -Recurse -Force $stageRootPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $workerDistPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $projectRoot "build/hubcli-worker") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $playwrightPath -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stageRootPath | Out-Null
New-Item -ItemType Directory -Force -Path $playwrightPath | Out-Null

Push-Location $projectRoot
try {
    $env:PLAYWRIGHT_BROWSERS_PATH = $playwrightPath
    $env:HUBCLI_BUILD_PROJECT_ROOT = $projectRoot

    npm ci
    npx playwright install chromium

    python -m pip install --upgrade pip
    python -m pip install pyinstaller -e ./python

    & $PyInstallerExe --noconfirm $workerSpecPath

    if (-not (Test-Path $nodeZipPath)) {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZipPath
    }

    Expand-Archive -Path $nodeZipPath -DestinationPath $distRootPath -Force
    $nodeExpandedRoot = Join-Path $distRootPath "node-v$NodeVersion-win-x64"

    Copy-Item (Join-Path $projectRoot "bin") (Join-Path $stageRootPath "bin") -Recurse
    Copy-Item (Join-Path $projectRoot "src") (Join-Path $stageRootPath "src") -Recurse
    Copy-Item (Join-Path $projectRoot "node_modules") (Join-Path $stageRootPath "node_modules") -Recurse
    Copy-Item (Join-Path $projectRoot "examples") (Join-Path $stageRootPath "examples") -Recurse
    New-Item -ItemType Directory -Force -Path (Join-Path $stageRootPath "python/hubcli_worker") | Out-Null
    Copy-Item (Join-Path $projectRoot "python/hubcli_worker/vendor") (Join-Path $stageRootPath "python/hubcli_worker/vendor") -Recurse -Force
    Copy-Item (Join-Path $projectRoot "README.md") (Join-Path $stageRootPath "README.md")
    Copy-Item (Join-Path $projectRoot "README.zh-CN.md") (Join-Path $stageRootPath "README.zh-CN.md")
    Copy-Item (Join-Path $projectRoot "package.json") (Join-Path $stageRootPath "package.json")
    Copy-Item (Join-Path $projectRoot "packaging/windows/hubcli.cmd") (Join-Path $stageRootPath "hubcli.cmd")

    New-Item -ItemType Directory -Force -Path (Join-Path $stageRootPath "runtime/node") | Out-Null
    Copy-Item (Join-Path $nodeExpandedRoot "*") (Join-Path $stageRootPath "runtime/node") -Recurse

    New-Item -ItemType Directory -Force -Path (Join-Path $stageRootPath "runtime/python-worker") | Out-Null
    Copy-Item (Join-Path $workerDistPath "*") (Join-Path $stageRootPath "runtime/python-worker") -Recurse

    if (-not (Test-Path $playwrightPath)) {
        throw "Playwright browsers were not downloaded into $playwrightPath"
    }
    Copy-Item $playwrightPath (Join-Path $stageRootPath "ms-playwright") -Recurse

    Compress-Archive -Path (Join-Path $stageRootPath "*") -DestinationPath (Join-Path $distRootPath $portableName) -Force

    & $IsccExe "/DAppVersion=$Version" "/DStageRoot=$stageRootPath" "/DOutputDir=$distRootPath" (Join-Path $projectRoot "packaging/windows/hubcli.iss")
}
finally {
    Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:HUBCLI_BUILD_PROJECT_ROOT -ErrorAction SilentlyContinue
    Pop-Location
}

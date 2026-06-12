$ErrorActionPreference = 'Continue'

Push-Location (Join-Path $PSScriptRoot '..')
try {
    npm test -- --watch=false --browsers=ChromeHeadless --reporters=progress,junit
    $testExitCode = $LASTEXITCODE

    powershell -ExecutionPolicy Bypass -File .\test-reporting\summarize-junit.ps1
    $summaryExitCode = $LASTEXITCODE

    if ($summaryExitCode -ne 0) {
        exit $summaryExitCode
    }

    exit $testExitCode
}
finally {
    Pop-Location
}

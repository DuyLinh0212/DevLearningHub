$ErrorActionPreference = 'Stop'

$reportPath = Join-Path $PSScriptRoot '..\test-reports\jasmine-karma\junit-results.xml'
$summaryPath = Join-Path $PSScriptRoot '..\test-reports\jasmine-karma\summary.md'

if (-not (Test-Path $reportPath)) {
    throw "JUnit report not found: $reportPath"
}

[xml]$report = Get-Content $reportPath

$suiteNodes = @()
if ($report.testsuites.testsuite) {
    $suiteNodes = @($report.testsuites.testsuite)
}
elseif ($report.testsuite) {
    $suiteNodes = @($report.testsuite)
}

$totalTests = 0
$totalFailures = 0
$totalErrors = 0
$totalSkipped = 0
$failedCases = New-Object System.Collections.Generic.List[object]

foreach ($suite in $suiteNodes) {
    $totalTests += [int]$suite.tests
    $totalFailures += [int]$suite.failures
    $totalErrors += [int]$suite.errors
    $totalSkipped += [int]$suite.skipped

    foreach ($case in @($suite.testcase)) {
        if ($case.failure -or $case.error) {
            $failureNode = if ($case.failure) { $case.failure } else { $case.error }
            $message = ($failureNode.message -replace "`r?`n", ' ').Trim()
            if ([string]::IsNullOrWhiteSpace($message)) {
                $message = (($failureNode.InnerText -split "`r?`n")[0]).Trim()
            }

            $failedCases.Add([pscustomobject]@{
                Feature = $case.classname
                Test = $case.name
                Message = $message
            })
        }
    }
}

$passed = $totalTests - $totalFailures - $totalErrors - $totalSkipped
$lines = New-Object System.Collections.Generic.List[string]

$lines.Add('# Jasmine/Karma Test Summary')
$lines.Add('')
$lines.Add("| Metric | Count |")
$lines.Add("| --- | ---: |")
$lines.Add("| Total | $totalTests |")
$lines.Add("| Passed | $passed |")
$lines.Add("| Failed | $totalFailures |")
$lines.Add("| Errors | $totalErrors |")
$lines.Add("| Skipped | $totalSkipped |")
$lines.Add('')

if ($failedCases.Count -eq 0) {
    $lines.Add('No failed test cases.')
}
else {
    $lines.Add('## Failed Features')
    $lines.Add('')
    $lines.Add('| Feature/Suite | Test Case | Error |')
    $lines.Add('| --- | --- | --- |')

    foreach ($failed in $failedCases) {
        $feature = ($failed.Feature -replace '\|', '\|')
        $test = ($failed.Test -replace '\|', '\|')
        $message = ($failed.Message -replace '\|', '\|')
        $lines.Add("| $feature | $test | $message |")
    }
}

$summaryDir = Split-Path $summaryPath -Parent
if (-not (Test-Path $summaryDir)) {
    New-Item -ItemType Directory -Path $summaryDir | Out-Null
}

$lines | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Summary written to $summaryPath"

#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent
$script:workspace = Join-Path $PSScriptRoot ('.budget-behavior-' + [guid]::NewGuid().ToString('N'))

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Label
    )

    if ($Condition) {
        $script:pass++
        Write-Host "[PASS] $Label"
    } else {
        $script:fail++
        Write-Host "[FAIL] $Label"
    }
}

function Assert-Equal {
    param(
        $Actual,
        $Expected,
        [string]$Label
    )

    Assert-True ($Actual -ceq $Expected) "$Label (expected '$Expected', actual '$Actual')"
}

function Assert-Null {
    param(
        $Actual,
        [string]$Label
    )

    Assert-True ($null -eq $Actual) "$Label (expected null)"
}

function Assert-NumberEqual {
    param(
        [double]$Actual,
        [double]$Expected,
        [string]$Label
    )

    $delta = [math]::Abs($Actual - $Expected)
    Assert-True ($delta -lt 1e-12) "$Label (expected $Expected, actual $Actual)"
}

function Assert-Contains {
    param(
        [object[]]$Actual,
        $Expected,
        [string]$Label
    )

    Assert-True ($Expected -in $Actual) "$Label (expected item '$Expected')"
}

function Assert-Match {
    param(
        [string]$Actual,
        [string]$Pattern,
        [string]$Label
    )

    Assert-True ($Actual -match $Pattern) "$Label (pattern '$Pattern')"
}

function Write-RawFixture {
    param(
        [string]$Name,
        [string]$Content
    )

    $path = Join-Path $script:workspace $Name
    [System.IO.File]::WriteAllText($path, $Content, [System.Text.UTF8Encoding]::new($false))
    return $path
}

function Write-ObjectFixture {
    param(
        [string]$Name,
        $Object
    )

    return (Write-RawFixture -Name $Name -Content ($Object | ConvertTo-Json -Depth 20))
}

function Invoke-Budget {
    param(
        [string]$FixturePath
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $script:repoRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-NonInteractive')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $script:repoRoot 'scripts\budget.ps1'))
    if (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
        $startInfo.ArgumentList.Add('-File')
        $startInfo.ArgumentList.Add($FixturePath)
    }
    $startInfo.ArgumentList.Add('-Json')

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($stdout)) {
        $json = $stdout | ConvertFrom-Json -Depth 30
    }

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        StdOut = $stdout
        StdErr = $stderr
        Json = $json
    }
}

Write-Host ''
Write-Host 'Budget behavior tests'
Write-Host '====================='

New-Item -ItemType Directory -Path $script:workspace -Force | Out-Null

try {
    $missingFile = Invoke-Budget
    Assert-Equal $missingFile.ExitCode 2 'Missing request file returns invalid without an interactive prompt'
    Assert-Equal $missingFile.Json.status 'invalid' 'Missing request file has structured error output'
    $mixedOrders = @(
        '{"version":1,"calls":[{"id":"unknown","model":"m"},{"id":"known","model":"m","hostCreditsUsed":5}]}',
        '{"version":1,"calls":[{"id":"known","model":"m","hostCreditsUsed":5},{"id":"unknown","model":"m"}]}'
    )
    $order = 0
    foreach ($request in $mixedOrders) {
        $mixed = Invoke-Budget (Write-RawFixture -Name "mixed-credits-$order.json" -Content $request)
        Assert-Null $mixed.Json.totals.hostCreditsUsed "Mixed known/unknown credits remain unknown in order $order"
        Assert-NumberEqual $mixed.Json.totals.knownHostCreditsSubtotal 5 "Known credit subtotal is preserved in order $order"
        Assert-Contains @($mixed.Json.unknown.hostCreditsCallIds) 'unknown' "Missing credit call is reported in order $order"
        $order++
    }
    $invalidRequests = [ordered]@{
        'negative-token' = '{"version":1,"calls":[{"id":"a","model":"m","inputTokens":-1}]}'
        'fractional-token' = '{"version":1,"calls":[{"id":"a","model":"m","inputTokens":1.5}]}'
        'boolean-token' = '{"version":1,"calls":[{"id":"a","model":"m","inputTokens":true}]}'
        'overflow-token' = '{"version":1,"calls":[{"id":"a","model":"m","inputTokens":9223372036854775808}]}'
        'duplicate-field' = '{"version":1,"version":1,"calls":[]}'
        'duplicate-call' = '{"version":1,"calls":[{"id":"a","model":"m"},{"id":"a","model":"m"}]}'
        'invalid-calls-shape' = '{"version":1,"calls":{}}'
        'cache-exceeds-input' = '{"version":1,"calls":[{"id":"a","model":"m","inputTokens":10,"cacheReadTokens":8,"cacheWriteTokens":5}]}'
        'context-sum-overflow' = '{"version":1,"calls":[{"id":"a","model":"m","promptTokens":9223372036854775807,"reservedOutputTokens":1,"safetyMarginTokens":0}]}'
        'nonfinite-cap' = '{"version":1,"calls":[],"caps":{"costUSD":1e999}}'
    }
    foreach ($case in $invalidRequests.GetEnumerator()) {
        $fixture = Write-RawFixture -Name "$($case.Key).json" -Content $case.Value
        $response = Invoke-Budget $fixture
        Assert-Equal $response.ExitCode 2 "$($case.Key) fails closed"
    }
    $contextOverflow = Invoke-Budget (Write-RawFixture 'context-overflow.json' '{"version":1,"calls":[{"id":"a","model":"m","contextWindowTokens":10,"promptTokens":9,"reservedOutputTokens":2,"safetyMarginTokens":0}]}')
    Assert-Equal $contextOverflow.ExitCode 1 'Known context overflow blocks without optional enforcement flags'
    $missingContext = Invoke-Budget (Write-RawFixture 'context-unknown.json' '{"version":1,"enforce":{"contextWindow":true},"calls":[{"id":"a","model":"m"}]}')
    Assert-Equal $missingContext.ExitCode 1 'Required context evidence cannot be omitted'
    $boundaryFixture = Write-ObjectFixture -Name 'boundary-cache-math.json' -Object @{
        version = 1
        suppliedCapabilities = @('tool-calls')
        enforce = @{
            contextWindow = $true
            outputCap = $true
            pricing = $true
            capabilities = $true
            hostCredits = $false
        }
        caps = @{
            costUSD = 0.00175
        }
        rates = @(
            @{
                id = 'synthetic-fast'
                model = 'example/fast'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05T08:07:47Z'
                perMillion = @{
                    input = 2.0
                    cacheRead = 0.5
                    cacheWrite = 3.0
                    output = 5.0
                }
            }
        )
        calls = @(
            @{
                id = 'primary'
                model = 'example/fast'
                rateId = 'synthetic-fast'
                contextWindowTokens = 1000
                outputCapTokens = 50
                promptTokens = 900
                reservedOutputTokens = 50
                safetyMarginTokens = 50
                requiredCapabilities = @('tool-calls')
                inputTokens = 1000
                cacheReadTokens = 400
                cacheWriteTokens = 100
                outputTokens = 50
            }
        )
    }
    $boundary = Invoke-Budget -FixturePath $boundaryFixture
    Assert-Equal $boundary.ExitCode 0 'Boundary fixture exits 0'
    Assert-Equal $boundary.Json.status 'ok' 'Boundary fixture status is ok'
    Assert-Equal $boundary.Json.calls[0].usage.uncachedInputTokens 500 'Cache math derives uncached input tokens'
    Assert-Equal $boundary.Json.calls[0].context.requiredContextTokens 1000 'Required context tokens sum prompt and reserves'
    Assert-True ([bool]$boundary.Json.calls[0].context.fitsContextWindow) 'Exact context boundary passes'
    Assert-Equal $boundary.Json.calls[0].context.remainingContextTokens 0 'Exact context boundary leaves zero remaining tokens'
    Assert-True ([bool]$boundary.Json.calls[0].output.satisfied) 'Exact output cap boundary passes'
    Assert-NumberEqual ([double]$boundary.Json.totals.costUSD) 0.00175 'Boundary fixture cost matches cache-aware pricing'
    Assert-Equal $boundary.Json.caps.costUSD.status 'within' 'Exact USD cap boundary is within'
    Assert-Match $boundary.StdOut '"asOf":"2026-09-05T08:07:47Z"' 'Timestamp asOf is preserved exactly in JSON output'

    $multiCallFixture = Write-ObjectFixture -Name 'multi-call-zero-reserves.json' -Object @{
        version = 1
        rates = @(
            @{
                id = 'synthetic-balanced'
                model = 'example/balanced'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05'
                perMillion = @{
                    input = 1.0
                    cacheRead = 0.0
                    cacheWrite = 2.0
                    output = 4.0
                }
            }
        )
        calls = @(
            @{
                id = 'attempt-1'
                model = 'example/balanced'
                rateId = 'synthetic-balanced'
                contextWindowTokens = 100
                outputCapTokens = 10
                promptTokens = 100
                reservedOutputTokens = 0
                safetyMarginTokens = 0
                inputTokens = 100
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 10
            }
            @{
                id = 'attempt-2'
                model = 'example/balanced'
                rateId = 'synthetic-balanced'
                contextWindowTokens = 190
                outputCapTokens = 20
                promptTokens = 190
                reservedOutputTokens = 0
                safetyMarginTokens = 0
                inputTokens = 200
                cacheReadTokens = 50
                cacheWriteTokens = 50
                outputTokens = 20
            }
        )
    }
    $multiCall = Invoke-Budget -FixturePath $multiCallFixture
    Assert-Equal $multiCall.ExitCode 0 'Multi-call fixture exits 0'
    Assert-Equal $multiCall.Json.callCount 2 'Multi-call fixture counts explicit attempts separately'
    Assert-Equal $multiCall.Json.totals.inputTokensKnownSubtotal 300 'Multi-call input subtotal is additive'
    Assert-Equal $multiCall.Json.totals.outputTokensKnownSubtotal 30 'Multi-call output subtotal is additive'
    Assert-NumberEqual ([double]$multiCall.Json.totals.knownCostSubtotalUSD) 0.00042 'Multi-call known USD subtotal sums all calls'
    Assert-NumberEqual ([double]$multiCall.Json.totals.costUSD) 0.00042 'Fully priced multi-call total is known'

    $pricingUnknownFixture = Write-ObjectFixture -Name 'pricing-unknown-enforced.json' -Object @{
        version = 1
        enforce = @{
            pricing = $true
        }
        calls = @(
            @{
                id = 'unpriced'
                model = 'example/reasoning'
                contextWindowTokens = 10
                outputCapTokens = 1
                promptTokens = 9
                reservedOutputTokens = 1
                safetyMarginTokens = 0
                inputTokens = 10
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 1
            }
        )
    }
    $pricingUnknown = Invoke-Budget -FixturePath $pricingUnknownFixture
    Assert-Equal $pricingUnknown.ExitCode 1 'Pricing unknown with enforced evidence exits 1'
    Assert-Equal $pricingUnknown.Json.status 'blocked' 'Pricing unknown with enforced evidence blocks'
    Assert-Null $pricingUnknown.Json.totals.costUSD 'Unpriced total USD stays null, never zero'
    Assert-NumberEqual ([double]$pricingUnknown.Json.totals.knownCostSubtotalUSD) 0.0 'Unknown pricing keeps known USD subtotal at zero'
    Assert-Contains @($pricingUnknown.Json.unknown.pricingCallIds) 'unpriced' 'Unknown pricing call id is reported'

    $costCapUnknownFixture = Write-ObjectFixture -Name 'cost-cap-unknown.json' -Object @{
        version = 1
        caps = @{
            costUSD = 0.01
        }
        rates = @(
            @{
                id = 'synthetic-cap'
                model = 'example/cap'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05'
                perMillion = @{
                    input = 10.0
                    cacheRead = 1.0
                    cacheWrite = 11.0
                    output = 20.0
                }
            }
        )
        calls = @(
            @{
                id = 'priced'
                model = 'example/cap'
                rateId = 'synthetic-cap'
                contextWindowTokens = 20
                outputCapTokens = 5
                promptTokens = 10
                reservedOutputTokens = 5
                safetyMarginTokens = 0
                inputTokens = 10
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
            }
            @{
                id = 'unpriced-under-cap'
                model = 'example/cap'
                contextWindowTokens = 20
                outputCapTokens = 5
                promptTokens = 10
                reservedOutputTokens = 5
                safetyMarginTokens = 0
                inputTokens = 10
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
            }
        )
    }
    $costCapUnknown = Invoke-Budget -FixturePath $costCapUnknownFixture
    Assert-Equal $costCapUnknown.ExitCode 1 'Configured USD cap with unknown total exits 1'
    Assert-Equal $costCapUnknown.Json.status 'blocked' 'Configured USD cap with unknown total blocks'
    Assert-Null $costCapUnknown.Json.totals.costUSD 'Configured USD cap with unknown total keeps total USD null'
    Assert-Equal $costCapUnknown.Json.caps.costUSD.status 'unknown' 'Configured USD cap with unknown total reports unknown cap status'

    $hostCreditsFixture = Write-ObjectFixture -Name 'host-credits-nonconverted.json' -Object @{
        version = 1
        caps = @{
            hostCredits = 2.0
        }
        calls = @(
            @{
                id = 'credit-only'
                model = 'example/hosted'
                contextWindowTokens = 100
                outputCapTokens = 10
                promptTokens = 90
                reservedOutputTokens = 5
                safetyMarginTokens = 5
                inputTokens = 90
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
                hostCreditsUsed = 1.5
            }
        )
    }
    $hostCredits = Invoke-Budget -FixturePath $hostCreditsFixture
    Assert-Equal $hostCredits.ExitCode 0 'Host-credit-only fixture exits 0'
    Assert-Null $hostCredits.Json.totals.costUSD 'Host credits do not create synthetic USD totals'
    Assert-NumberEqual ([double]$hostCredits.Json.totals.knownCostSubtotalUSD) 0.0 'Host-credit-only fixture has zero known USD subtotal'
    Assert-NumberEqual ([double]$hostCredits.Json.totals.hostCreditsUsed) 1.5 'Host credits are reported separately'
    Assert-Equal $hostCredits.Json.caps.hostCredits.status 'within' 'Known host credits respect the configured cap'
    Assert-Contains @($hostCredits.Json.unknown.pricingCallIds) 'credit-only' 'Missing rate data stays an explicit pricing unknown'

    $hostCreditExceededFixture = Write-ObjectFixture -Name 'host-credit-cap-exceeded.json' -Object @{
        version = 1
        caps = @{
            hostCredits = 1.0
        }
        calls = @(
            @{
                id = 'credit-cap-fail'
                model = 'example/hosted'
                contextWindowTokens = 100
                outputCapTokens = 10
                promptTokens = 90
                reservedOutputTokens = 5
                safetyMarginTokens = 5
                inputTokens = 90
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
                hostCreditsUsed = 1.25
            }
        )
    }
    $hostCreditExceeded = Invoke-Budget -FixturePath $hostCreditExceededFixture
    Assert-Equal $hostCreditExceeded.ExitCode 1 'Exceeded host-credit cap exits 1'
    Assert-Equal $hostCreditExceeded.Json.status 'blocked' 'Exceeded host-credit cap blocks'
    Assert-Equal $hostCreditExceeded.Json.caps.hostCredits.status 'exceeded' 'Exceeded host-credit cap is reported'

    $hostCreditUnknownCapFixture = Write-ObjectFixture -Name 'host-credit-cap-unknown.json' -Object @{
        version = 1
        caps = @{
            hostCredits = 3.0
        }
        calls = @(
            @{
                id = 'known-credit'
                model = 'example/hosted'
                contextWindowTokens = 100
                outputCapTokens = 10
                promptTokens = 90
                reservedOutputTokens = 5
                safetyMarginTokens = 5
                inputTokens = 90
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
                hostCreditsUsed = 1.0
            }
            @{
                id = 'unknown-credit'
                model = 'example/hosted'
                contextWindowTokens = 100
                outputCapTokens = 10
                promptTokens = 90
                reservedOutputTokens = 5
                safetyMarginTokens = 5
                inputTokens = 90
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 5
            }
        )
    }
    $hostCreditUnknownCap = Invoke-Budget -FixturePath $hostCreditUnknownCapFixture
    Assert-Equal $hostCreditUnknownCap.ExitCode 1 'Configured host-credit cap with unknown total exits 1'
    Assert-Equal $hostCreditUnknownCap.Json.status 'blocked' 'Configured host-credit cap with unknown total blocks'
    Assert-Null $hostCreditUnknownCap.Json.totals.hostCreditsUsed 'Configured host-credit cap with unknown total keeps total host credits null'
    Assert-Equal $hostCreditUnknownCap.Json.caps.hostCredits.status 'unknown' 'Configured host-credit cap with unknown total reports unknown cap status'

    $stringTokenFixture = Write-RawFixture -Name 'invalid-string-token.json' -Content @'
{
  "version": 1,
  "calls": [
    {
      "id": "bad-token",
      "model": "example/bad",
      "inputTokens": "100"
    }
  ]
}
'@
    $stringToken = Invoke-Budget -FixturePath $stringTokenFixture
    Assert-Equal $stringToken.ExitCode 2 'String token fixture exits 2'
    Assert-Equal $stringToken.Json.status 'invalid' 'String token fixture is invalid'
    Assert-Match $stringToken.Json.message 'inputTokens' 'String token error names the offending field'

    $malformedJsonFixture = Write-RawFixture -Name 'malformed.json' -Content '{ "version": 1, "calls": ['
    $malformedJson = Invoke-Budget -FixturePath $malformedJsonFixture
    Assert-Equal $malformedJson.ExitCode 2 'Malformed JSON exits 2'
    Assert-Equal $malformedJson.Json.status 'invalid' 'Malformed JSON is invalid'
    Assert-Match $malformedJson.Json.message 'invalid JSON' 'Malformed JSON reports a parsing error'

    $duplicateRateFixture = Write-ObjectFixture -Name 'duplicate-rate.json' -Object @{
        version = 1
        rates = @(
            @{
                id = 'dup-rate'
                model = 'example/a'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05'
                perMillion = @{
                    input = 1.0
                    cacheRead = 0.1
                    cacheWrite = 1.1
                    output = 2.0
                }
            }
            @{
                id = 'dup-rate'
                model = 'example/b'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05'
                perMillion = @{
                    input = 1.0
                    cacheRead = 0.1
                    cacheWrite = 1.1
                    output = 2.0
                }
            }
        )
        calls = @()
    }
    $duplicateRate = Invoke-Budget -FixturePath $duplicateRateFixture
    Assert-Equal $duplicateRate.ExitCode 2 'Duplicate rate id exits 2'
    Assert-Match $duplicateRate.Json.message 'duplicates' 'Duplicate rate id error is explicit'

    $unknownRateFixture = Write-ObjectFixture -Name 'unknown-rate-id.json' -Object @{
        version = 1
        rates = @(
            @{
                id = 'known-rate'
                model = 'example/known'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = '2026-09-05'
                perMillion = @{
                    input = 1.0
                    cacheRead = 0.1
                    cacheWrite = 1.1
                    output = 2.0
                }
            }
        )
        calls = @(
            @{
                id = 'bad-rate-ref'
                model = 'example/known'
                rateId = 'missing-rate'
            }
        )
    }
    $unknownRate = Invoke-Budget -FixturePath $unknownRateFixture
    Assert-Equal $unknownRate.ExitCode 2 'Unknown rate id exits 2'
    Assert-Match $unknownRate.Json.message 'rateId' 'Unknown rate id error names the missing reference'

    $invalidAsOfFixture = Write-ObjectFixture -Name 'invalid-asof.json' -Object @{
        version = 1
        rates = @(
            @{
                id = 'bad-asof'
                model = 'example/date'
                currency = 'USD'
                source = 'synthetic-fixture'
                asOf = 'tomorrow'
                perMillion = @{
                    input = 1.0
                    cacheRead = 0.1
                    cacheWrite = 1.1
                    output = 2.0
                }
            }
        )
        calls = @()
    }
    $invalidAsOf = Invoke-Budget -FixturePath $invalidAsOfFixture
    Assert-Equal $invalidAsOf.ExitCode 2 'Invalid asOf exits 2'
    Assert-Match $invalidAsOf.Json.message 'ISO 8601' 'Invalid asOf reports ISO date requirement'

    $unsupportedPropertyFixture = Write-RawFixture -Name 'unsupported-property.json' -Content @'
{
  "version": 1,
  "calls": [],
  "typo": true
}
'@
    $unsupportedProperty = Invoke-Budget -FixturePath $unsupportedPropertyFixture
    Assert-Equal $unsupportedProperty.ExitCode 2 'Unsupported property exits 2'
    Assert-Match $unsupportedProperty.Json.message 'unsupported property' 'Unsupported property error is explicit'

    $noCallsFixture = Write-ObjectFixture -Name 'no-calls.json' -Object @{
        version = 1
        caps = @{
            costUSD = 0
            hostCredits = 0
        }
        calls = @()
    }
    $noCalls = Invoke-Budget -FixturePath $noCallsFixture
    Assert-Equal $noCalls.ExitCode 0 'No-calls fixture exits 0'
    Assert-Equal $noCalls.Json.callCount 0 'No-calls fixture reports zero calls'
    Assert-NumberEqual ([double]$noCalls.Json.totals.costUSD) 0.0 'No-calls fixture has zero USD total'
    Assert-NumberEqual ([double]$noCalls.Json.totals.hostCreditsUsed) 0.0 'No-calls fixture has zero host-credit total'
    Assert-Equal $noCalls.Json.caps.costUSD.status 'within' 'Zero-call exact USD cap is within'

    $capabilityMismatchFixture = Write-ObjectFixture -Name 'capability-mismatch.json' -Object @{
        version = 1
        suppliedCapabilities = @('json-mode')
        calls = @(
            @{
                id = 'needs-tools'
                model = 'example/capability'
                requiredCapabilities = @('json-mode', 'tool-calls')
                contextWindowTokens = 10
                outputCapTokens = 1
                promptTokens = 9
                reservedOutputTokens = 1
                safetyMarginTokens = 0
                inputTokens = 10
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 1
            }
        )
    }
    $capabilityMismatch = Invoke-Budget -FixturePath $capabilityMismatchFixture
    Assert-Equal $capabilityMismatch.ExitCode 1 'Capability mismatch exits 1'
    Assert-Contains @($capabilityMismatch.Json.failures.capabilityCallIds) 'needs-tools' 'Capability mismatch is a blocking failure'
    Assert-Contains @($capabilityMismatch.Json.calls[0].capabilities.missing) 'tool-calls' 'Missing capability is named explicitly'

    $capabilityOverrideFixture = Write-ObjectFixture -Name 'capability-override.json' -Object @{
        version = 1
        calls = @(
            @{
                id = 'mixed-model-call'
                model = 'example/override'
                suppliedCapabilities = @('tool-calls')
                requiredCapabilities = @('tool-calls')
                contextWindowTokens = 10
                outputCapTokens = 1
                promptTokens = 9
                reservedOutputTokens = 1
                safetyMarginTokens = 0
                inputTokens = 10
                cacheReadTokens = 0
                cacheWriteTokens = 0
                outputTokens = 1
            }
        )
    }
    $capabilityOverride = Invoke-Budget -FixturePath $capabilityOverrideFixture
    Assert-Equal $capabilityOverride.ExitCode 0 'Per-call capability override exits 0'
    Assert-True ([bool]$capabilityOverride.Json.calls[0].capabilities.satisfied) 'Per-call capability override satisfies required capability'
} finally {
    Remove-Item -LiteralPath $script:workspace -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host "Budget behavior tests: $script:pass passed, $script:fail failed"
if ($script:fail -gt 0) {
    exit 1
}

exit 0

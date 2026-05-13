using System.Collections.Generic;
using AgentX.VisualStudio.Services;
using FluentAssertions;
using Xunit;
using static AgentX.VisualStudio.Services.DependencyChecker;

namespace AgentX.VisualStudio.Tests;

/// <summary>
/// Unit tests for the pure rendering and aggregation surface of
/// <see cref="DependencyChecker"/> (Maj-3). Async probes are intentionally
/// excluded: they shell out to <c>pwsh</c>/<c>git</c>/<c>gh</c> and would
/// make the suite environment-dependent.
/// </summary>
public sealed class DependencyCheckerTests
{
    private static ProbeResult Pass(string name, Severity sev, string version) =>
        new(name, sev, true, version, null, null);

    private static ProbeResult Fail(string name, Severity sev, string error, string fix) =>
        new(name, sev, false, null, fix, error);

    private static EnvironmentReport Report(IReadOnlyList<ProbeResult> results, string root = "C:\\repo")
    {
        var requiredMissing = 0;
        var recommendedMissing = 0;
        foreach (var r in results)
        {
            if (r.Found) continue;
            if (r.Severity == Severity.Required) requiredMissing++;
            else if (r.Severity == Severity.Recommended) recommendedMissing++;
        }
        return new EnvironmentReport(results, requiredMissing == 0, requiredMissing, recommendedMissing, root);
    }

    [Fact]
    public void Render_marks_all_passes_when_every_probe_succeeds()
    {
        var report = Report(new[]
        {
            Pass("PowerShell 7+ (pwsh)", Severity.Required, "7.4.0"),
            Pass("Git", Severity.Required, "git version 2.40"),
            Pass("AgentX CLI", Severity.Required, "agentx.ps1"),
            Pass("AgentX state directory", Severity.Recommended, "C:\\repo\\.agentx\\state"),
            Pass("GitHub CLI (gh)", Severity.Recommended, "gh version 2.40"),
        });

        var output = Render(report);

        output.Should().Contain("[PASS] PowerShell 7+ (pwsh)");
        output.Should().Contain("version: 7.4.0");
        output.Should().Contain("Result: HEALTHY");
        output.Should().NotContain("[FAIL]");
        output.Should().NotContain("[WARN]");
    }

    [Fact]
    public void Render_uses_FAIL_marker_for_required_misses_and_reports_unhealthy()
    {
        var report = Report(new[]
        {
            Fail("PowerShell 7+ (pwsh)", Severity.Required, "Probe timed out (>5s)", "winget install --id Microsoft.PowerShell -e"),
            Pass("Git", Severity.Required, "git version 2.40"),
        });

        var output = Render(report);

        output.Should().Contain("[FAIL] PowerShell 7+ (pwsh) (Required)");
        output.Should().Contain("reason : Probe timed out (>5s)");
        output.Should().Contain("fix    : winget install --id Microsoft.PowerShell -e");
        output.Should().Contain("Result: UNHEALTHY - 1 required dependency missing.");
        report.Healthy.Should().BeFalse();
    }

    [Fact]
    public void Render_uses_WARN_marker_for_recommended_misses_and_reports_OK()
    {
        var report = Report(new[]
        {
            Pass("PowerShell 7+ (pwsh)", Severity.Required, "7.4.0"),
            Pass("Git", Severity.Required, "git version 2.40"),
            Pass("AgentX CLI", Severity.Required, "agentx.ps1"),
            Fail("AgentX state directory", Severity.Recommended, "Not found at C:\\repo\\.agentx\\state", "Initialize state"),
            Fail("GitHub CLI (gh)", Severity.Recommended, "Exit 9009", "winget install --id GitHub.cli -e"),
        });

        var output = Render(report);

        output.Should().Contain("[WARN] AgentX state directory (Recommended)");
        output.Should().Contain("[WARN] GitHub CLI (gh) (Recommended)");
        output.Should().Contain("Result: OK - required dependencies present, 2 recommended missing.");
        output.Should().NotContain("[FAIL]");
        report.Healthy.Should().BeTrue();
        report.HasWarnings.Should().BeTrue();
    }

    [Fact]
    public void Render_includes_workspace_header()
    {
        var report = Report(new[]
        {
            Pass("Git", Severity.Required, "git version 2.40"),
        }, root: "D:\\projects\\agentx");

        var output = Render(report);

        output.Should().Contain("Workspace: D:\\projects\\agentx");
        output.Should().StartWith("AgentX Environment Check");
    }

    [Fact]
    public void EnvironmentReport_HasWarnings_is_false_when_no_recommended_missing()
    {
        var report = Report(new[]
        {
            Pass("Git", Severity.Required, "git version 2.40"),
            Pass("GitHub CLI (gh)", Severity.Recommended, "gh version 2.40"),
        });

        report.HasWarnings.Should().BeFalse();
    }

    [Fact]
    public void EnvironmentReport_HasWarnings_is_true_when_any_recommended_missing()
    {
        var report = Report(new[]
        {
            Pass("Git", Severity.Required, "git version 2.40"),
            Fail("GitHub CLI (gh)", Severity.Recommended, "Exit 9009", "winget install --id GitHub.cli -e"),
        });

        report.HasWarnings.Should().BeTrue();
        report.RecommendedMissing.Should().Be(1);
    }

    [Fact]
    public void Render_omits_version_line_when_version_is_empty()
    {
        var probe = new ProbeResult("Tool", Severity.Required, true, null, null, null);
        var report = Report(new[] { probe });

        var output = Render(report);

        output.Should().Contain("[PASS] Tool (Required)");
        output.Should().NotContain("       version:");
    }
}
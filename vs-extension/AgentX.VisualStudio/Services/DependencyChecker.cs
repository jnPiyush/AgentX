using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Dependency probe used by <c>CheckEnvironmentCommand</c>. Mirrors the VS
/// Code extension's setup wizard (<c>setupWizardInternals.ts</c> +
/// <c>dependencyChecker.ts</c>) at a focused subset: the tools the VS
/// out-of-process CLI surface actually needs to run end-to-end.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 does not expose the rich progress / quick-pick UI
/// that VS Code uses, so the report is rendered as text into the AgentX
/// Output window plus a single summary <c>ShowPromptAsync</c>. Failure rows
/// include a copy-paste fix command so the user can install missing tools
/// without leaving Visual Studio.
/// </remarks>
internal static class DependencyChecker
{
    public enum Severity
    {
        Required,
        Recommended,
        Optional,
    }

    public sealed record ProbeResult(
        string Name,
        Severity Severity,
        bool Found,
        string? Version,
        string? FixCommand,
        string? Error);

    public sealed record EnvironmentReport(
        IReadOnlyList<ProbeResult> Results,
        bool Healthy,
        int RequiredMissing,
        int RecommendedMissing,
        string WorkspaceRoot)
    {
        public bool HasWarnings => RecommendedMissing > 0;
    }

    public static async Task<EnvironmentReport> CheckAllAsync(
        string workspaceRoot,
        CancellationToken cancellationToken)
    {
        var results = new List<ProbeResult>
        {
            await ProbePwshAsync(cancellationToken).ConfigureAwait(false),
            await ProbeGitAsync(cancellationToken).ConfigureAwait(false),
            ProbeAgentXCli(workspaceRoot),
            ProbeAgentXState(workspaceRoot),
            await ProbeGhAsync(cancellationToken).ConfigureAwait(false),
        };

        var requiredMissing = 0;
        var recommendedMissing = 0;
        foreach (var r in results)
        {
            if (r.Found) continue;
            if (r.Severity == Severity.Required) requiredMissing++;
            else if (r.Severity == Severity.Recommended) recommendedMissing++;
        }

        return new EnvironmentReport(
            Results: results,
            Healthy: requiredMissing == 0,
            RequiredMissing: requiredMissing,
            RecommendedMissing: recommendedMissing,
            WorkspaceRoot: workspaceRoot);
    }

    private static Task<ProbeResult> ProbePwshAsync(CancellationToken ct)
        => ProbeExecutableAsync(
            name: "PowerShell 7+ (pwsh)",
            severity: Severity.Required,
            executable: "pwsh",
            args: "-NoProfile -Command \"$PSVersionTable.PSVersion.ToString()\"",
            fixCommand: "winget install --id Microsoft.PowerShell -e",
            ct);

    private static Task<ProbeResult> ProbeGitAsync(CancellationToken ct)
        => ProbeExecutableAsync(
            name: "Git",
            severity: Severity.Required,
            executable: "git",
            args: "--version",
            fixCommand: "winget install --id Git.Git -e",
            ct);

    private static Task<ProbeResult> ProbeGhAsync(CancellationToken ct)
        => ProbeExecutableAsync(
            name: "GitHub CLI (gh)",
            severity: Severity.Recommended,
            executable: "gh",
            args: "--version",
            fixCommand: "winget install --id GitHub.cli -e",
            ct);

    private static ProbeResult ProbeAgentXCli(string workspaceRoot)
    {
        var script = Path.Combine(workspaceRoot, ".agentx", "agentx.ps1");
        if (File.Exists(script))
        {
            return new ProbeResult("AgentX CLI", Severity.Required, true, "agentx.ps1", null, null);
        }
        return new ProbeResult(
            "AgentX CLI",
            Severity.Required,
            false,
            null,
            FixCommand: "Open the AgentX repo (folder containing .agentx/agentx.ps1) or set 'AgentX > Root Path'",
            Error: $"Not found at {script}");
    }

    private static ProbeResult ProbeAgentXState(string workspaceRoot)
    {
        var statePath = Path.Combine(workspaceRoot, ".agentx", "state");
        var found = Directory.Exists(statePath);
        return new ProbeResult(
            "AgentX state directory",
            Severity.Recommended,
            found,
            found ? statePath : null,
            FixCommand: found ? null : "Run 'agentx loop start -p \"<task>\"' to initialize state",
            Error: found ? null : $"Not found at {statePath}");
    }

    private static async Task<ProbeResult> ProbeExecutableAsync(
        string name,
        Severity severity,
        string executable,
        string args,
        string fixCommand,
        CancellationToken ct)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            using var process = Process.Start(psi);
            if (process is null)
            {
                return new ProbeResult(name, severity, false, null, fixCommand, "Failed to launch");
            }
            // 5s cap so a hung executable doesn't freeze the dialog.
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            try { await process.WaitForExitAsync(cts.Token).ConfigureAwait(false); }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                return new ProbeResult(name, severity, false, null, fixCommand, "Probe timed out (>5s)");
            }
            var stdout = (await stdoutTask.ConfigureAwait(false)).Trim();
            if (process.ExitCode == 0)
            {
                return new ProbeResult(name, severity, true, stdout, null, null);
            }
            return new ProbeResult(name, severity, false, null, fixCommand, $"Exit {process.ExitCode}");
        }
        catch (Exception ex)
        {
            return new ProbeResult(name, severity, false, null, fixCommand, ex.Message);
        }
    }

    public static string Render(EnvironmentReport report)
    {
        var sb = new StringBuilder();
        sb.AppendLine("AgentX Environment Check");
        sb.AppendLine("========================");
        sb.AppendLine($"Workspace: {report.WorkspaceRoot}");
        sb.AppendLine();
        foreach (var r in report.Results)
        {
            var marker = r.Found ? "[PASS]" : (r.Severity == Severity.Required ? "[FAIL]" : "[WARN]");
            sb.AppendLine($"{marker} {r.Name} ({r.Severity})");
            if (r.Found && !string.IsNullOrEmpty(r.Version))
            {
                sb.AppendLine($"       version: {r.Version}");
            }
            if (!r.Found)
            {
                if (!string.IsNullOrEmpty(r.Error)) sb.AppendLine($"       reason : {r.Error}");
                if (!string.IsNullOrEmpty(r.FixCommand)) sb.AppendLine($"       fix    : {r.FixCommand}");
            }
        }
        sb.AppendLine();
        if (report.Healthy && !report.HasWarnings)
        {
            sb.AppendLine("Result: HEALTHY - all required and recommended dependencies found.");
        }
        else if (report.Healthy)
        {
            sb.AppendLine($"Result: OK - required dependencies present, {report.RecommendedMissing} recommended missing.");
        }
        else
        {
            sb.AppendLine($"Result: UNHEALTHY - {report.RequiredMissing} required dependency missing.");
        }
        return sb.ToString();
    }
}

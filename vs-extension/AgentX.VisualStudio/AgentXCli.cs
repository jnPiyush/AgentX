using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Settings;

namespace AgentX.VisualStudio;

/// <summary>
/// Result of an AgentX CLI invocation.
/// </summary>
internal sealed record AgentXCliResult(int ExitCode, string StdOut, string StdErr)
{
    public bool Success => ExitCode == 0;
}

/// <summary>
/// Thin bridge that shells out to <c>.agentx/agentx.ps1</c>. Mirrors how the
/// VS Code extension invokes the same CLI so business logic stays in one
/// place.
/// </summary>
internal static class AgentXCli
{
    /// <summary>
    /// Runs <c>agentx</c> with the given arguments inside <paramref name="workspaceRoot"/>.
    /// </summary>
    /// <param name="workspaceRoot">Repo root that contains <c>.agentx/agentx.ps1</c>.</param>
    /// <param name="args">CLI args, e.g. <c>new[] { "ready" }</c> or <c>new[] { "loop", "start", "-p", "Task" }</c>.</param>
    /// <param name="shellPreference">One of <see cref="AgentXSettings.ShellAuto"/>,
    /// <see cref="AgentXSettings.ShellPwsh"/>, or <see cref="AgentXSettings.ShellBash"/>.
    /// Defaults to <see cref="AgentXSettings.ShellAuto"/>.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public static Task<AgentXCliResult> RunAsync(
        string workspaceRoot,
        string[] args,
        string? shellPreference = null,
        CancellationToken cancellationToken = default)
        => RunCoreAsync(workspaceRoot, args, shellPreference, onLine: null, cancellationToken);

    /// <summary>
    /// Runs the CLI and streams output line-by-line via <paramref name="onLine"/>.
    /// Useful for the Output window where progressive output matters.
    /// </summary>
    public static Task<AgentXCliResult> RunAsync(
        string workspaceRoot,
        string[] args,
        Action<string> onLine,
        string? shellPreference = null,
        CancellationToken cancellationToken = default)
    {
        if (onLine is null) throw new ArgumentNullException(nameof(onLine));
        return RunCoreAsync(workspaceRoot, args, shellPreference, onLine, cancellationToken);
    }

    private static async Task<AgentXCliResult> RunCoreAsync(
        string workspaceRoot,
        string[] args,
        string? shellPreference,
        Action<string>? onLine,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(workspaceRoot))
        {
            throw new ArgumentException("Workspace root is required.", nameof(workspaceRoot));
        }

        var script = Path.Combine(workspaceRoot, ".agentx", "agentx.ps1");
        if (!File.Exists(script))
        {
            var msg = $"AgentX CLI not found at '{script}'. Run 'agentx init' or check the workspace root.";
            onLine?.Invoke(msg);
            return new AgentXCliResult(-1, string.Empty, msg);
        }

        var (fileName, prefixArgs) = BuildShellInvocation(shellPreference, script);

        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            WorkingDirectory = workspaceRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        // Mirror the VS Code shell.execShell call: NO_COLOR + AGENTX_WORKSPACE_ROOT
        // so the CLI behaves identically regardless of which IDE launched it.
        psi.Environment["NO_COLOR"] = "1";
        psi.Environment["AGENTX_WORKSPACE_ROOT"] = workspaceRoot;

        foreach (var prefix in prefixArgs)
        {
            psi.ArgumentList.Add(prefix);
        }

        foreach (var a in args)
        {
            psi.ArgumentList.Add(a);
        }

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null) return;
            stdout.AppendLine(e.Data);
            onLine?.Invoke(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is null) return;
            stderr.AppendLine(e.Data);
            onLine?.Invoke("[stderr] " + e.Data);
        };

        try
        {
            if (!process.Start())
            {
                return new AgentXCliResult(-1, string.Empty, $"Failed to start '{fileName}'.");
            }
        }
        catch (Exception ex)
        {
            return new AgentXCliResult(-1, string.Empty, $"Failed to start '{fileName}': {ex.Message}");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
            throw;
        }

        return new AgentXCliResult(process.ExitCode, stdout.ToString(), stderr.ToString());
    }

    /// <summary>
    /// Selects the shell binary and base arguments for the given preference.
    /// 'auto' prefers pwsh and falls back to powershell; 'bash' invokes the
    /// script through bash for users on WSL or Git Bash. The script itself is
    /// PowerShell, so 'bash' shells out to pwsh under the hood.
    /// </summary>
    private static (string fileName, string[] prefixArgs) BuildShellInvocation(string? preference, string script)
    {
        var pref = string.IsNullOrWhiteSpace(preference) ? AgentXSettings.ShellAuto : preference!.Trim().ToLowerInvariant();

        if (pref == AgentXSettings.ShellBash)
        {
            // bash -c "pwsh -File <script> ..."  -- but we use ArgumentList for safety
            // and rely on bash's ability to invoke pwsh from the user's PATH.
            var shell = ResolveBash();
            return (shell, new[] { "-lc", $"pwsh -NoProfile -NonInteractive -File \"{script}\" \"$@\"", "--" });
        }

        var pwsh = pref == AgentXSettings.ShellPwsh ? "pwsh.exe" : ResolvePwsh();
        return (pwsh, new[]
        {
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script,
        });
    }

    /// <summary>
    /// Prefer <c>pwsh</c> (PowerShell 7+) but fall back to Windows PowerShell.
    /// </summary>
    private static string ResolvePwsh()
    {
        var paths = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty).Split(Path.PathSeparator);
        foreach (var p in paths)
        {
            try
            {
                var candidate = Path.Combine(p, "pwsh.exe");
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // Ignore malformed PATH entries.
            }
        }

        return "powershell.exe";
    }

    private static string ResolveBash()
    {
        var paths = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty).Split(Path.PathSeparator);
        foreach (var p in paths)
        {
            try
            {
                var candidate = Path.Combine(p, "bash.exe");
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
            }
        }

        return "bash.exe";
    }
}


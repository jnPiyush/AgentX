using System;
using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Services;
using AgentX.VisualStudio.Settings;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.UI;

namespace AgentX.VisualStudio.ToolWindows;

/// <summary>
/// Tabbed AgentX tool window. Wires the view-model commands to the AgentX
/// CLI, mirroring the surface that the VS Code sidebar exposes (status,
/// workflows, loop, council, agents).
/// </summary>
internal sealed class AgentXToolWindowControl : RemoteUserControl
{
    private readonly VisualStudioExtensibility _extensibility;
    private readonly AgentXOutput _output;

    public AgentXToolWindowControl(VisualStudioExtensibility extensibility)
        : base(dataContext: new AgentXToolWindowViewModel())
    {
        _extensibility = extensibility;
        _output = new AgentXOutput(extensibility);

        ViewModel.RefreshCommand = new AsyncRelayCommand(_ => RefreshAsync(CancellationToken.None));

        ViewModel.StartLoopCommand = new AsyncRelayCommand(_ => RunLoopVerbAsync(
            new[] { "loop", "start", "-p", FallbackIfBlank(ViewModel.LoopPromptInput, "Visual Studio session") },
            CancellationToken.None));

        ViewModel.IterateLoopCommand = new AsyncRelayCommand(_ => RunLoopVerbAsync(
            new[] { "loop", "iterate", "-s", FallbackIfBlank(ViewModel.IterationSummaryInput, "Verification pass from Visual Studio") },
            CancellationToken.None));

        ViewModel.CompleteLoopCommand = new AsyncRelayCommand(_ => RunLoopVerbAsync(
            new[] { "loop", "complete", "-s", FallbackIfBlank(ViewModel.CompletionSummaryInput, "All quality gates passed") },
            CancellationToken.None));

        ViewModel.CancelLoopCommand = new AsyncRelayCommand(_ => RunLoopVerbAsync(
            new[] { "loop", "cancel" }, CancellationToken.None));

        ViewModel.RollbackLoopCommand = new AsyncRelayCommand(_ => RunLoopVerbAsync(
            new[] { "loop", "rollback" }, CancellationToken.None));

        ViewModel.RunWorkflowCommand = new AsyncRelayCommand(parameter =>
        {
            if (parameter is WorkflowItem item)
            {
                return RunCliInternalAsync(new[] { "workflow", item.Id }, CancellationToken.None);
            }
            return Task.CompletedTask;
        });

        ViewModel.RunCouncilCommand = new AsyncRelayCommand(parameter =>
        {
            if (parameter is CouncilItem role)
            {
                return RunCliInternalAsync(new[] { "council", role.Id }, CancellationToken.None);
            }
            return Task.CompletedTask;
        });

        ViewModel.GenerateDigestCommand = new AsyncRelayCommand(_ => RunCliInternalAsync(new[] { "digest" }, CancellationToken.None));
        ViewModel.ScrubCommand = new AsyncRelayCommand(_ => RunCliInternalAsync(new[] { "scrub" }, CancellationToken.None));
        ViewModel.AddAgentCommand = new AsyncRelayCommand(_ => RunCliInternalAsync(new[] { "add", "agent" }, CancellationToken.None));
        ViewModel.AddSkillCommand = new AsyncRelayCommand(_ => RunCliInternalAsync(new[] { "add", "skill" }, CancellationToken.None));

        // Fire-and-forget initial refresh: gated by the AutoRefresh setting so users
        // who disable it do not pay the startup cost. Failures fall through silently;
        // the user can always click Refresh manually.
        _ = TryAutoRefreshAsync();
    }

    private AgentXToolWindowViewModel ViewModel => (AgentXToolWindowViewModel)this.DataContext!;

    private async Task TryAutoRefreshAsync()
    {
        try
        {
            var enabled = await AgentXSettings.ReadAutoRefreshAsync(_extensibility, CancellationToken.None)
                .ConfigureAwait(false);
            if (!enabled) return;
            await RefreshAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch
        {
            // Auto-refresh is best-effort; never let it crash the tool window load.
        }
    }

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        if (ViewModel.IsBusy) return;
        ViewModel.IsBusy = true;
        try
        {
            var configured = await AgentXSettings.ReadRootPathAsync(_extensibility, cancellationToken)
                .ConfigureAwait(false);
            var root = await WorkspaceResolver.ResolveAsync(_extensibility, configured, cancellationToken)
                .ConfigureAwait(false);
            if (root is null)
            {
                ViewModel.WorkspaceRoot = "(not found)";
                ViewModel.LoopStatus = "No AgentX workspace open. Open a folder containing '.agentx/agentx.ps1'.";
                ViewModel.ReadyIssues = string.Empty;
                ViewModel.AgentState = string.Empty;
                ViewModel.SetStructuredStatus(null, null, null);
                return;
            }

            ViewModel.WorkspaceRoot = root;
            var shell = await AgentXSettings.ReadShellAsync(_extensibility, cancellationToken).ConfigureAwait(false);

            // Use --json so we can render structured WPF lists. Each section keeps the legacy
            // Format* string as a fallback when JSON parsing fails (CLI error, schema drift).
            var status = await AgentXCli.RunAsync(root, new[] { "loop", "status", "--json" }, shellPreference: shell, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            ViewModel.LoopStatus = status.Success
                ? AgentXCliJson.FormatLoopStatus(status.StdOut)
                : status.StdErr.Trim();

            var ready = await AgentXCli.RunAsync(root, new[] { "ready", "--json" }, shellPreference: shell, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            ViewModel.ReadyIssues = ready.Success
                ? AgentXCliJson.FormatReadyIssues(ready.StdOut)
                : ready.StdErr.Trim();

            var state = await AgentXCli.RunAsync(root, new[] { "state", "--json" }, shellPreference: shell, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            ViewModel.AgentState = state.Success
                ? AgentXCliJson.FormatAgentState(state.StdOut)
                : state.StdErr.Trim();

            // Structured parse: nulls fall back to the legacy strings above via the Has* flags.
            var loopStatusModel = status.Success && AgentXCliJson.TryParseLoopStatus(status.StdOut, out var ls)
                ? ls
                : null;
            var readyRows = ready.Success && AgentXCliJson.TryParseReadyIssues(ready.StdOut, out var rs)
                ? rs
                : null;
            var agentRows = state.Success && AgentXCliJson.TryParseAgentState(state.StdOut, out var ar)
                ? ar
                : null;
            ViewModel.SetStructuredStatus(loopStatusModel, readyRows, agentRows);
        }
        finally
        {
            ViewModel.IsBusy = false;
        }
    }

    private async Task RunLoopVerbAsync(string[] args, CancellationToken cancellationToken)
    {
        await RunCliInternalAsync(args, cancellationToken).ConfigureAwait(false);
        // Refresh status after loop verbs so the Status tab reflects the new state.
        await RefreshAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task RunCliInternalAsync(string[] args, CancellationToken cancellationToken)
    {
        if (ViewModel.IsBusy) return;
        ViewModel.IsBusy = true;
        try
        {
            var configured = await AgentXSettings.ReadRootPathAsync(_extensibility, cancellationToken)
                .ConfigureAwait(false);
            var root = await WorkspaceResolver.ResolveAsync(_extensibility, configured, cancellationToken)
                .ConfigureAwait(false);
            if (root is null)
            {
                ViewModel.AppendLog("[error] No AgentX workspace open.");
                return;
            }

            var shell = await AgentXSettings.ReadShellAsync(_extensibility, cancellationToken).ConfigureAwait(false);

            ViewModel.AppendLog($"$ agentx {string.Join(' ', args)}");
            await _output.ShowAsync(cancellationToken).ConfigureAwait(false);
            await _output.WriteLineAsync($"$ agentx {string.Join(' ', args)}", cancellationToken)
                .ConfigureAwait(false);

            var result = await AgentXCli.RunAsync(
                root,
                args,
                line =>
                {
                    ViewModel.AppendLog(line);
                    _ = _output.WriteLineAsync(line, cancellationToken);
                },
                shellPreference: shell,
                cancellationToken: cancellationToken).ConfigureAwait(false);

            ViewModel.AppendLog($"[exit {result.ExitCode}]");
            await _output.WriteLineAsync($"[exit {result.ExitCode}]", cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            ViewModel.AppendLog($"[error] {ex.Message}");
        }
        finally
        {
            ViewModel.IsBusy = false;
        }
    }

    private static string FallbackIfBlank(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value!;
}

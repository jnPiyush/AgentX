using System;
using System.Collections.Generic;
using System.IO;
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
internal sealed class AgentXToolWindowControl : RemoteUserControl, IDisposable
{
    private readonly VisualStudioExtensibility _extensibility;
    private readonly AgentXOutput _output;
    private readonly LoopStatusNotifier _loopNotifier = new();

    // Live-refresh plumbing (H-4 fix). Watchers fire on workspace state file
    // changes; the debounce timer collapses bursts (e.g. CLI rewrites
    // loop-state.json several times during `loop iterate`) into a single
    // RefreshAsync invocation 500 ms after the last write. Mirrors
    // vscode-extension/src/extension.ts (FileSystemWatcher debounce of 500 ms).
    private readonly object _watcherGate = new();
    private readonly List<FileSystemWatcher> _watchers = new();
    private System.Timers.Timer? _debounceTimer;
    private string? _watchedRoot;
    private bool _disposed;

    public AgentXToolWindowControl(VisualStudioExtensibility extensibility)
        : base(dataContext: new AgentXToolWindowViewModel())
    {
        _extensibility = extensibility;
        _output = new AgentXOutput(extensibility);

        // Re-target watchers when the workspace root flips (H-3 fix). Resolver
        // raises this event whenever ResolveAsync produces a different path
        // than the previous call.
        WorkspaceResolver.WorkspaceRootChanged += OnWorkspaceRootChanged;

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
            // Install or re-target FileSystemWatchers on every successful resolve so
            // the tool window auto-refreshes when CLI state changes (H-4 fix).
            EnsureWatchers(root);
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

            // Maj-2: prompt on terminal loop transitions. Setting-gated; no-op when disabled.
            var notifyEnabled = await AgentXSettings.ReadShowLoopStatusNotificationsAsync(_extensibility, cancellationToken)
                .ConfigureAwait(false);
            await _loopNotifier.UpdateAsync(_extensibility, loopStatusModel, notifyEnabled, cancellationToken)
                .ConfigureAwait(false);
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

    /// <summary>
    /// Installs (or re-targets) <see cref="FileSystemWatcher"/> instances on the three
    /// workspace state files the VS Code extension also watches:
    /// <c>.agentx/config.json</c>, <c>.vscode/mcp.json</c>, and <c>.git/config</c>.
    /// Each change triggers a debounced (500 ms) <see cref="RefreshAsync"/> so the
    /// status badge, ready-issues, and agent-state views stay live without polling.
    /// Idempotent: re-invoking with the same root is a no-op.
    /// </summary>
    private void EnsureWatchers(string root)
    {
        if (_disposed) return;
        lock (_watcherGate)
        {
            if (string.Equals(_watchedRoot, root, StringComparison.OrdinalIgnoreCase) && _watchers.Count > 0)
            {
                return;
            }

            DisposeWatchersLocked();
            _watchedRoot = root;

            // Each watched file lives in a distinct subfolder, so we register one
            // watcher per parent directory with a precise filter. NotifyFilter
            // covers the rewrite patterns the CLI uses (atomic writes that
            // create + rename, plus in-place edits via PowerShell Set-Content).
            TryAddFileWatcher(Path.Combine(root, ".agentx"), "config.json");
            TryAddFileWatcher(Path.Combine(root, ".agentx", "state"), "loop-state.json");
            TryAddFileWatcher(Path.Combine(root, ".vscode"), "mcp.json");
            TryAddFileWatcher(Path.Combine(root, ".git"), "config");

            // Lazily create the debounce timer on first watcher install.
            if (_debounceTimer is null)
            {
                _debounceTimer = new System.Timers.Timer(500) { AutoReset = false };
                _debounceTimer.Elapsed += OnDebounceElapsed;
            }
        }
    }

    private void TryAddFileWatcher(string directory, string filter)
    {
        try
        {
            if (!Directory.Exists(directory)) return;
            var watcher = new FileSystemWatcher(directory, filter)
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size
                             | NotifyFilters.FileName | NotifyFilters.CreationTime,
                IncludeSubdirectories = false,
            };
            watcher.Changed += OnWatchedFileChanged;
            watcher.Created += OnWatchedFileChanged;
            watcher.Renamed += OnWatchedFileChanged;
            watcher.Deleted += OnWatchedFileChanged;
            watcher.EnableRaisingEvents = true;
            _watchers.Add(watcher);
        }
        catch
        {
            // Swallow: watcher install failures must never crash the tool window.
            // The user can still click Refresh manually.
        }
    }

    private void OnWatchedFileChanged(object sender, FileSystemEventArgs e)
    {
        // Reset (debounce) so a burst of writes collapses into one refresh.
        try { _debounceTimer?.Stop(); _debounceTimer?.Start(); }
        catch { /* timer disposed during shutdown */ }
    }

    private void OnDebounceElapsed(object? sender, System.Timers.ElapsedEventArgs e)
    {
        if (_disposed) return;
        // Fire-and-forget: RefreshAsync handles its own busy-state and never throws.
        _ = RefreshAsync(CancellationToken.None);
    }

    private void OnWorkspaceRootChanged(object? sender, WorkspaceRootChangedEventArgs e)
    {
        // The next RefreshAsync will pick up the new root and call EnsureWatchers
        // with the new path; explicitly clear watchers here so we do not keep
        // firing on stale paths in the meantime.
        if (_disposed) return;
        lock (_watcherGate)
        {
            DisposeWatchersLocked();
            _watchedRoot = null;
        }
        // Reset notifier so the new workspace re-arms transitions cleanly.
        _loopNotifier.Reset();
        _ = RefreshAsync(CancellationToken.None);
    }

    private void DisposeWatchersLocked()
    {
        foreach (var watcher in _watchers)
        {
            try
            {
                watcher.EnableRaisingEvents = false;
                watcher.Changed -= OnWatchedFileChanged;
                watcher.Created -= OnWatchedFileChanged;
                watcher.Renamed -= OnWatchedFileChanged;
                watcher.Deleted -= OnWatchedFileChanged;
                watcher.Dispose();
            }
            catch { /* best-effort cleanup */ }
        }
        _watchers.Clear();
    }

    public new void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        WorkspaceResolver.WorkspaceRootChanged -= OnWorkspaceRootChanged;
        lock (_watcherGate)
        {
            DisposeWatchersLocked();
            try
            {
                if (_debounceTimer is not null)
                {
                    _debounceTimer.Stop();
                    _debounceTimer.Elapsed -= OnDebounceElapsed;
                    _debounceTimer.Dispose();
                    _debounceTimer = null;
                }
            }
            catch { /* timer already disposed */ }
        }
        base.Dispose();
    }
}

using System;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Pure state-machine for <see cref="LoopStatusNotifier"/>. Extracted into a
/// VS-Extensibility-free file so the test project can link and exercise the
/// transition logic without dragging the extension SDK into a plain xUnit
/// project (mirrors the AgentXCliJson linking pattern).
/// </summary>
internal sealed class LoopStatusTransitionState
{
    private readonly object _gate = new();
    private string? _lastTerminalStatus;
    private bool _wasActive;

    /// <summary>
    /// Computes whether the latest <paramref name="status"/> represents a
    /// terminal transition that should fire a notification, and returns the
    /// human-readable message to surface. The notifier owns the
    /// <c>ShowPromptAsync</c> side-effect; this method owns the rules:
    ///   - Suppressed when <paramref name="enabled"/> is false.
    ///   - Suppressed when status is null.
    ///   - Fires only on active -> complete or active -> blocked.
    ///   - Fires at most once per terminal value (so re-reads of the same
    ///     loop-state.json do not re-prompt).
    ///   - Re-arms when the loop returns to active.
    /// </summary>
    public (bool ShouldNotify, string? Message) Compute(LoopStatusDto? status, bool enabled)
    {
        if (!enabled || status is null)
        {
            return (false, null);
        }

        var isActive = status.Active == true;
        var statusText = (status.Status ?? string.Empty).Trim().ToLowerInvariant();
        string? terminal = statusText is "complete" or "blocked" ? statusText : null;

        bool shouldNotify;
        lock (_gate)
        {
            shouldNotify =
                terminal is not null
                && _wasActive
                && !string.Equals(_lastTerminalStatus, terminal, StringComparison.Ordinal);

            if (terminal is not null) _lastTerminalStatus = terminal;
            else if (isActive) _lastTerminalStatus = null;
            _wasActive = isActive;
        }

        if (!shouldNotify)
        {
            return (false, null);
        }

        var iter = status.Iteration?.ToString() ?? "?";
        var issue = status.IssueNumber is int n ? $" (issue #{n})" : string.Empty;
        var message = terminal == "complete"
            ? $"AgentX loop COMPLETE at iteration {iter}{issue}."
            : $"AgentX loop BLOCKED at iteration {iter}{issue}.";
        return (true, message);
    }

    /// <summary>Resets cached transition state, e.g. on workspace-root change.</summary>
    public void Reset()
    {
        lock (_gate)
        {
            _lastTerminalStatus = null;
            _wasActive = false;
        }
    }
}

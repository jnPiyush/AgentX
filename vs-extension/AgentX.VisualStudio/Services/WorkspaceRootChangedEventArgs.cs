using System;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Carries the previous and current AgentX workspace root through the
/// <see cref="WorkspaceResolver.WorkspaceRootChanged"/> event so subscribers
/// can decide whether to re-target file watchers, refresh status surfaces,
/// or surface a notification.
/// </summary>
/// <remarks>
/// Hosted in its own file so the test project can link this single source
/// without dragging the VS Extensibility SDK in (mirrors the
/// AgentXCliJson / LoopStatusTransitionState linking pattern).
/// </remarks>
internal sealed class WorkspaceRootChangedEventArgs : EventArgs
{
    public WorkspaceRootChangedEventArgs(string? previousRoot, string? currentRoot)
    {
        PreviousRoot = previousRoot;
        CurrentRoot = currentRoot;
    }

    public string? PreviousRoot { get; }

    public string? CurrentRoot { get; }
}

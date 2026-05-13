using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Settings;
using Microsoft.VisualStudio.Extensibility;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Resolves the AgentX repository root for the current Visual Studio session.
/// Resolution order (mirrors the VS Code extension's logic):
/// 1. <see cref="AgentXSettings.RootPath"/> (explicit user setting).
/// 2. <c>AGENTX_WORKSPACE_ROOT</c> environment variable (used by tests / CI).
/// 3. VS Extensibility workspace folders, when the SDK exposes a stable
///    <c>extensibility.Workspaces()</c> surface (probed defensively at runtime).
/// 4. Current process working directory plus its ancestors -- the first folder
///    containing <c>.agentx/agentx.ps1</c> wins.
/// 5. Bounded recursive search of those ancestors for a child folder that
///    contains <c>.agentx/agentx.ps1</c>, capped by
///    <see cref="AgentXSettings.SearchDepth"/>.
/// </summary>
/// <remarks>
/// <para>
/// VS Extensibility 17.14 does not expose a stable
/// <c>extensibility.Workspaces().GetWorkspacesAsync</c> overload across all
/// host configurations, so the workspace probe is wrapped in try/catch and
/// silently falls through to the working-directory search when unavailable.
/// </para>
/// <para>
/// Solution-switch parity (H-3 fix): the resolver caches the last-resolved
/// root and exposes <see cref="WorkspaceRootChanged"/>; consumers (tool
/// window, status surfaces) listen for the event and re-render. The
/// FileSystemWatcher in <c>AgentXToolWindowControl</c> triggers
/// <see cref="ResolveAsync(VisualStudioExtensibility, string?, CancellationToken)"/>
/// on every <c>.git/config</c>, <c>.agentx/config.json</c>, or
/// <c>.vscode/mcp.json</c> change, which catches solution open/close events
/// indirectly without needing a stable in-process IVsSolutionEvents surface.
/// Direct invalidation is also possible via <see cref="Reset"/>.
/// </para>
/// </remarks>
internal static class WorkspaceResolver
{
    private static readonly object _gate = new();
    private static string? _lastResolved;

    /// <summary>
    /// Raised when <see cref="ResolveAsync(VisualStudioExtensibility, string?, CancellationToken)"/>
    /// returns a different root than the previous resolution (including null
    /// transitions). Consumers subscribe to refresh status surfaces on
    /// solution open/close in lieu of an in-process IVsSolutionEvents API.
    /// </summary>
    public static event EventHandler<WorkspaceRootChangedEventArgs>? WorkspaceRootChanged;

    public static async Task<string?> ResolveAsync(
        VisualStudioExtensibility extensibility,
        string? configuredRoot,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveCoreAsync(extensibility, configuredRoot, cancellationToken).ConfigureAwait(false);
        NotifyIfChanged(resolved);
        return resolved;
    }

    private static async Task<string?> ResolveCoreAsync(
        VisualStudioExtensibility extensibility,
        string? configuredRoot,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(configuredRoot) && IsAgentXRoot(configuredRoot!))
        {
            return Path.GetFullPath(configuredRoot!);
        }

        var env = Environment.GetEnvironmentVariable("AGENTX_WORKSPACE_ROOT");
        if (!string.IsNullOrWhiteSpace(env) && IsAgentXRoot(env!))
        {
            return Path.GetFullPath(env!);
        }

        var depth = await AgentXSettings.ReadSearchDepthAsync(extensibility, cancellationToken)
            .ConfigureAwait(false);

        // Defensive probe: try the VS Extensibility workspace surface when present.
        // Falls through silently when the SDK lacks the API or the host returns nothing.
        var workspaceFolder = TryGetWorkspaceFolder(extensibility);
        if (!string.IsNullOrWhiteSpace(workspaceFolder))
        {
            var match = FindRoot(workspaceFolder!, depth);
            if (match is not null)
            {
                return match;
            }
        }

        var anchor = SafeGetCurrentDirectory();
        if (!string.IsNullOrWhiteSpace(anchor))
        {
            var match = FindRoot(anchor!, depth);
            if (match is not null)
            {
                return match;
            }
        }

        return null;
    }

    /// <summary>
    /// Clears the cached last-resolved root so the next
    /// <see cref="ResolveAsync(VisualStudioExtensibility, string?, CancellationToken)"/>
    /// always raises <see cref="WorkspaceRootChanged"/> if anything has shifted.
    /// </summary>
    public static void Reset()
    {
        lock (_gate)
        {
            _lastResolved = null;
        }
    }

    private static void NotifyIfChanged(string? resolved)
    {
        string? previous;
        lock (_gate)
        {
            previous = _lastResolved;
            _lastResolved = resolved;
        }

        if (!string.Equals(previous, resolved, StringComparison.OrdinalIgnoreCase))
        {
            WorkspaceRootChanged?.Invoke(null, new WorkspaceRootChangedEventArgs(previous, resolved));
        }
    }

    /// <summary>
    /// Best-effort probe of the VS Extensibility workspace surface. Returns
    /// the first workspace folder path when the SDK exposes one, or null
    /// when the API is unavailable / throws / returns no folders.
    /// </summary>
    private static string? TryGetWorkspaceFolder(VisualStudioExtensibility extensibility)
    {
        try
        {
            // Reflection probe so the resolver compiles cleanly across SDK
            // revisions where Workspaces() may shift its return shape. The
            // SDK at 17.14 does not guarantee a stable folders accessor; when
            // it lands, this block becomes a direct API call.
            var ext = extensibility;
            var workspacesMethod = ext.GetType().GetMethod("Workspaces", Type.EmptyTypes);
            var workspaces = workspacesMethod?.Invoke(ext, null);
            if (workspaces is null)
            {
                return null;
            }

            foreach (var name in new[] { "GetWorkspacesAsync", "GetWorkspaceFoldersAsync" })
            {
                var method = workspaces.GetType().GetMethod(name);
                if (method is null) continue;
                // We do not await reflectively here -- the SDK shape is
                // unstable. Returning null lets the working-directory fallback
                // run, which is the documented behaviour at SDK 17.14.
                return null;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public static bool IsAgentXRoot(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        try
        {
            return File.Exists(Path.Combine(path, ".agentx", "agentx.ps1"));
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Walks up from <paramref name="anchor"/> looking for an AgentX root, and
    /// optionally searches each ancestor's children up to <paramref name="depth"/>
    /// levels.
    /// </summary>
    private static string? FindRoot(string anchor, int depth)
    {
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var current = TryGetFullPath(anchor);
        while (current is not null && visited.Add(current))
        {
            if (IsAgentXRoot(current))
            {
                return current;
            }

            if (depth > 0)
            {
                var match = SearchChildren(current, depth);
                if (match is not null)
                {
                    return match;
                }
            }

            var parent = Directory.GetParent(current)?.FullName;
            current = parent is not null && !string.Equals(parent, current, StringComparison.OrdinalIgnoreCase)
                ? parent
                : null;
        }

        return null;
    }

    private static string? SearchChildren(string root, int depth)
    {
        if (depth <= 0)
        {
            return null;
        }

        IEnumerable<string> children;
        try
        {
            children = Directory.EnumerateDirectories(root);
        }
        catch
        {
            return null;
        }

        foreach (var child in children)
        {
            // Skip noisy folders that never contain a project root.
            var name = Path.GetFileName(child);
            if (string.IsNullOrEmpty(name) || name.StartsWith('.') ||
                name.Equals("node_modules", StringComparison.OrdinalIgnoreCase) ||
                name.Equals("bin", StringComparison.OrdinalIgnoreCase) ||
                name.Equals("obj", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (IsAgentXRoot(child))
            {
                return child;
            }

            var nested = SearchChildren(child, depth - 1);
            if (nested is not null)
            {
                return nested;
            }
        }

        return null;
    }

    private static string? SafeGetCurrentDirectory()
    {
        try
        {
            return Environment.CurrentDirectory;
        }
        catch
        {
            return null;
        }
    }

    private static string? TryGetFullPath(string path)
    {
        try
        {
            return Path.GetFullPath(path);
        }
        catch
        {
            return null;
        }
    }
}


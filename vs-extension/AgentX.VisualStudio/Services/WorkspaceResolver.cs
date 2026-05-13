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
/// 3. Current process working directory plus its ancestors -- the first folder
///    containing <c>.agentx/agentx.ps1</c> wins.
/// 4. Bounded recursive search of those ancestors for a child folder that
///    contains <c>.agentx/agentx.ps1</c>, capped by
///    <see cref="AgentXSettings.SearchDepth"/>.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 does not expose a stable
/// <c>extensibility.Workspaces().GetWorkspaceFoldersAsync</c> overload, so we
/// rely on the working directory and well-known environment variables. The
/// extension host launches per-solution with the solution directory as the
/// current directory, which gives us the same anchor the VS Code extension
/// uses (<c>vscode.workspace.workspaceFolders[0]</c>).
/// </remarks>
internal static class WorkspaceResolver
{
    public static async Task<string?> ResolveAsync(
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


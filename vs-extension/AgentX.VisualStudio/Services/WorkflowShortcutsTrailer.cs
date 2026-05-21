using System.Collections.Generic;
using System.Text;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Builds a discoverability trailer that lists the AgentX-provided
/// <c>AgentX: Workflow - *</c> Tools-menu shortcuts.
/// </summary>
/// <remarks>
/// The trailer is appended to the Output window after
/// <c>ShowStatusCommand</c> runs <c>agentx state</c> so users who reach
/// for the "Show Agent Status" command also see which workflow shortcuts
/// ship with the extension. Display names mirror
/// <c>string-resources.json</c> exactly so anything a user reads in the
/// Output pane can be typed back into the Ctrl+Q command palette.
/// </remarks>
internal static class WorkflowShortcutsTrailer
{
    /// <summary>
    /// Display names of the 8 <c>AgentX: Workflow - *</c> shortcuts in the
    /// canonical AgentX workflow order (Feature -&gt; Epic -&gt; Story -&gt;
    /// Bug -&gt; Spike -&gt; DevOps -&gt; Docs -&gt; Iterative Loop). This
    /// matches the current Tools-menu and Workflows-tab presentation order.
    /// Kept in sync with <c>string-resources.json</c> and
    /// <c>WorkflowCommands.cs</c>.
    /// </summary>
    public static IReadOnlyList<string> WorkflowDisplayNames { get; } = new[]
    {
        "AgentX: Workflow - Feature",
        "AgentX: Workflow - Epic",
        "AgentX: Workflow - Story",
        "AgentX: Workflow - Bug",
        "AgentX: Workflow - Spike",
        "AgentX: Workflow - DevOps",
        "AgentX: Workflow - Docs",
        "AgentX: Workflow - Iterative Loop",
    };

    /// <summary>
    /// Header line that introduces the trailer. Stable text so tests and
    /// the smoke-test checklist can anchor on it.
    /// </summary>
    public const string Header = "Workflow shortcuts available (Tools menu / Ctrl+Q):";

    /// <summary>
    /// Builds the trailer as a single string with one display name per line
    /// (prefixed with "  - "). A leading blank line separates the trailer
    /// from the preceding CLI output.
    /// </summary>
    public static string Build()
    {
        var sb = new StringBuilder();
        sb.AppendLine();
        sb.AppendLine(Header);
        foreach (var name in WorkflowDisplayNames)
        {
            sb.Append("  - ").AppendLine(name);
        }
        return sb.ToString();
    }
}

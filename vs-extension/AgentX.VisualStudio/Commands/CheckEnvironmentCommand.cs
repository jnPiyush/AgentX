using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Services;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using Microsoft.VisualStudio.Extensibility.Shell;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Visual Studio counterpart to the VS Code <c>agentx.checkEnvironment</c>
/// command (see <c>vscode-extension/src/commands/setupWizard.ts</c>). Probes
/// PowerShell 7+, Git, the AgentX CLI, the local AgentX state directory, and
/// the optional GitHub CLI; renders the report into the AgentX Output window
/// and surfaces a pass/fail prompt so the user knows whether further setup
/// is required. (Maj-3 fix.)
/// </summary>
[VisualStudioContribution]
internal sealed class CheckEnvironmentCommand : AgentXCommand
{
    public CheckEnvironmentCommand(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
    }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.CheckEnvironment.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override async Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
    {
        var root = await ResolveRootAsync(cancellationToken).ConfigureAwait(false);
        if (root is null)
        {
            await this.Extensibility.Shell().ShowPromptAsync(
                "AgentX repo not found. Open a folder containing '.agentx/agentx.ps1' or set 'AgentX > Root Path'.",
                PromptOptions.OK,
                cancellationToken).ConfigureAwait(false);
            return;
        }

        await Output.ShowAsync(cancellationToken).ConfigureAwait(false);
        await Output.WriteLineAsync("$ agentx check-environment", cancellationToken).ConfigureAwait(false);

        var report = await DependencyChecker.CheckAllAsync(root, cancellationToken).ConfigureAwait(false);
        var rendered = DependencyChecker.Render(report);

        // Stream rendered report to the AgentX Output channel.
        foreach (var line in rendered.Split('\n'))
        {
            await Output.WriteLineAsync(line.TrimEnd('\r'), cancellationToken).ConfigureAwait(false);
        }
        await Output.WriteLineAsync("[exit 0]", cancellationToken).ConfigureAwait(false);

        var summary = report.Healthy
            ? (report.HasWarnings
                ? $"AgentX environment OK with {report.RecommendedMissing} recommended dependency missing. See AgentX Output for details."
                : "AgentX environment is healthy. All required and recommended dependencies are installed.")
            : $"AgentX environment UNHEALTHY: {report.RequiredMissing} required dependency missing. See AgentX Output for fix commands.";

        await this.Extensibility.Shell().ShowPromptAsync(summary, PromptOptions.OK, cancellationToken)
            .ConfigureAwait(false);
    }
}

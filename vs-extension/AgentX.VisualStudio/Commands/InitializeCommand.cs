using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

/// <summary>Runs <c>agentx init</c> to scaffold the local runtime.</summary>
[VisualStudioContribution]
internal sealed class InitializeCommand : AgentXCommand
{
    public InitializeCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Initialize.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "init" }, cancellationToken);
}

using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

[VisualStudioContribution]
internal sealed class ShowStatusCommand : AgentXCommand
{
    public ShowStatusCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.ShowStatus.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "state" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class CheckDepsCommand : AgentXCommand
{
    public CheckDepsCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.CheckDeps.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "deps" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class RunWorkflowCommand : AgentXCommand
{
    public RunWorkflowCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.RunWorkflow.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "agent-x" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class ValidateHandoffCommand : AgentXCommand
{
    public ValidateHandoffCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.ValidateHandoff.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "validate" }, cancellationToken);
}


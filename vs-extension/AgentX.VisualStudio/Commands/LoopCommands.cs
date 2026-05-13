using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Quality-loop commands. The Tool Window provides a free-text input surface
/// for prompts and summaries; these commands let users invoke the loop verbs
/// directly from the Tools menu with sensible defaults.
/// </summary>
[VisualStudioContribution]
internal sealed class LoopStartCommand : AgentXCommand
{
    public LoopStartCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopStart.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "start", "-p", "Visual Studio session" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class LoopStatusCommand : AgentXCommand
{
    public LoopStatusCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopStatus.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "status" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class LoopIterateCommand : AgentXCommand
{
    public LoopIterateCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopIterate.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "iterate", "-s", "Verification pass from Visual Studio" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class LoopCompleteCommand : AgentXCommand
{
    public LoopCompleteCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopComplete.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "complete", "-s", "All quality gates passed" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class LoopCancelCommand : AgentXCommand
{
    public LoopCancelCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopCancel.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "cancel" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class LoopRollbackCommand : AgentXCommand
{
    public LoopRollbackCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.LoopRollback.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "loop", "rollback" }, cancellationToken);
}


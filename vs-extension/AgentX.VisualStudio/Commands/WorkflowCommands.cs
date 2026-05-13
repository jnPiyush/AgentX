using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Per-workflow shortcut commands. Mirrors the VS Code extension's
/// <c>runWorkflowType</c> palette entries so users can launch a specific
/// workflow without going through a generic dispatcher.
/// </summary>
[VisualStudioContribution]
internal sealed class WorkflowFeatureCommand : AgentXCommand
{
    public WorkflowFeatureCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Feature.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "feature" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowEpicCommand : AgentXCommand
{
    public WorkflowEpicCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Epic.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "epic" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowStoryCommand : AgentXCommand
{
    public WorkflowStoryCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Story.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "story" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowBugCommand : AgentXCommand
{
    public WorkflowBugCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Bug.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "bug" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowSpikeCommand : AgentXCommand
{
    public WorkflowSpikeCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Spike.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "spike" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowDevOpsCommand : AgentXCommand
{
    public WorkflowDevOpsCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.DevOps.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "devops" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowDocsCommand : AgentXCommand
{
    public WorkflowDocsCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.Docs.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "docs" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class WorkflowIterativeLoopCommand : AgentXCommand
{
    public WorkflowIterativeLoopCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Workflow.IterativeLoop.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "workflow", "iterative-loop" }, cancellationToken);
}

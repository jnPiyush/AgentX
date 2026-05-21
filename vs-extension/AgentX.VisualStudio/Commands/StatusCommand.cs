using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Services;
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

    public override async Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
    {
        // Run `agentx state` and stream the CLI output to the AgentX Output
        // window via the shared RunCliAsync helper.
        await RunCliAsync(new[] { "state" }, cancellationToken).ConfigureAwait(false);

        // Append a discoverability trailer enumerating the
        // `AgentX: Workflow - *` shortcuts so users reaching for "Show Agent
        // Status" also learn what workflow shortcuts ship with this extension.
        // The trailer text mirrors string-resources.json so anything printed
        // here can be typed back into Ctrl+Q.
        //
        // Intentionally emitted on both success and failure: the trailer is a
        // discoverability hint, not a result summary. On failure the user has
        // already seen RunCliAsync's prompt; the trailer still helps them find
        // alternate AgentX commands to try.
        await Output.WriteLineAsync(WorkflowShortcutsTrailer.Build(), cancellationToken)
            .ConfigureAwait(false);
    }
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


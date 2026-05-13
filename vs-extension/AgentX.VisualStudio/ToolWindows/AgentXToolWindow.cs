using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using Microsoft.VisualStudio.Extensibility.ToolWindows;
using Microsoft.VisualStudio.RpcContracts.RemoteUI;

namespace AgentX.VisualStudio.ToolWindows;

/// <summary>
/// 'AgentX' tool window. Hosts the WPF panel showing loop state, ready
/// issues, workflows, council shortcuts, and an output console. Backed by
/// the same CLI used by the menu commands.
/// </summary>
[VisualStudioContribution]
internal sealed class AgentXToolWindow : ToolWindow
{
    public AgentXToolWindow(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
        Title = "AgentX";
    }

    // Solution Explorer's well-known tool window guid. ToolWindowPlacement.DockedTo(guid)
    // is the only sidebar-style dock the VS 17.14 out-of-process SDK exposes; pure
    // "DockedRight" is not surfaced. Docking next to Solution Explorer puts AgentX in
    // the right sidebar by default and mirrors the VS Code activity-bar placement
    // (`agentx-work` / `agentx-status` view containers). Users can redock or float;
    // VS persists their choice per window layout.
    private static readonly Guid SolutionExplorerToolWindowGuid =
        new("3ae79031-e1bc-11d0-8f78-00a0c9110057");

    public override ToolWindowConfiguration ToolWindowConfiguration => new()
    {
        Placement = ToolWindowPlacement.DockedTo(SolutionExplorerToolWindowGuid),
    };

    public override Task<IRemoteUserControl> GetContentAsync(CancellationToken cancellationToken)
        => Task.FromResult<IRemoteUserControl>(new AgentXToolWindowControl(this.Extensibility));

    public override Task InitializeAsync(CancellationToken cancellationToken)
    {
        // Title is also assigned in the constructor so the tool window has a
        // valid label before the async initializer runs.
        Title = "AgentX";
        return base.InitializeAsync(cancellationToken);
    }
}

/// <summary>Command to open the AgentX tool window from the View / Other Windows menu.</summary>
[VisualStudioContribution]
internal sealed class ShowAgentXToolWindowCommand : Command
{
    public ShowAgentXToolWindowCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.ShowToolWindow.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ViewOtherWindowsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => this.Extensibility.Shell().ShowToolWindowAsync<AgentXToolWindow>(activate: true, cancellationToken);
}


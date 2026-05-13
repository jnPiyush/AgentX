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

    public override ToolWindowConfiguration ToolWindowConfiguration => new()
    {
        Placement = ToolWindowPlacement.Floating,
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


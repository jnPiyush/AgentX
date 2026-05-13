using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Maintenance commands: digest generation, scrub, asset add. These map to
/// the same CLI verbs the VS Code extension exposes via its palette.
/// </summary>
[VisualStudioContribution]
internal sealed class GenerateDigestCommand : AgentXCommand
{
    public GenerateDigestCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.GenerateDigest.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "digest" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class ScrubCommand : AgentXCommand
{
    public ScrubCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Scrub.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "scrub" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class AddAgentCommand : AgentXCommand
{
    public AddAgentCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.AddAgent.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "add", "agent" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class AddSkillCommand : AgentXCommand
{
    public AddSkillCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.AddSkill.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "add", "skill" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class ConfigShowCommand : AgentXCommand
{
    public ConfigShowCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.ConfigShow.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "config", "show" }, cancellationToken);
}

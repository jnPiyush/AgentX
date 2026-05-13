using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Model Council commands. Each role mirrors a council from
/// <c>scripts/model-council.ps1</c> (research, prd-scope, adr-options,
/// ai-design, code-review). These call <c>agentx council &lt;role&gt;</c>.
/// </summary>
[VisualStudioContribution]
internal sealed class CouncilResearchCommand : AgentXCommand
{
    public CouncilResearchCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Council.Research.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "council", "research" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class CouncilPrdScopeCommand : AgentXCommand
{
    public CouncilPrdScopeCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Council.PrdScope.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "council", "prd-scope" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class CouncilAdrOptionsCommand : AgentXCommand
{
    public CouncilAdrOptionsCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Council.AdrOptions.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "council", "adr-options" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class CouncilAiDesignCommand : AgentXCommand
{
    public CouncilAiDesignCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Council.AiDesign.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "council", "ai-design" }, cancellationToken);
}

[VisualStudioContribution]
internal sealed class CouncilCodeReviewCommand : AgentXCommand
{
    public CouncilCodeReviewCommand(VisualStudioExtensibility extensibility) : base(extensibility) { }

    public override CommandConfiguration CommandConfiguration => new("%AgentX.Council.CodeReview.DisplayName%")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ToolsMenu },
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => RunCliAsync(new[] { "council", "code-review" }, cancellationToken);
}

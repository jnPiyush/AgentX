using Microsoft.VisualStudio.Extensibility;

namespace AgentX.VisualStudio;

/// <summary>
/// Entry point for the AgentX Visual Studio extension.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 instantiates <see cref="Extension"/> with no
/// arguments. Commands and tool windows receive their own
/// <see cref="VisualStudioExtensibility"/> via the base class and create the
/// shared 'AgentX' Output channel on demand through
/// <c>AgentX.VisualStudio.Services.AgentXOutput</c>.
/// </remarks>
[VisualStudioContribution]
internal sealed class AgentXExtension : Extension
{
    /// <inheritdoc />
    public override ExtensionConfiguration ExtensionConfiguration => new()
    {
        Metadata = new(
            id: "AgentX.VisualStudio.jnPiyush",
            version: this.ExtensionAssemblyVersion,
            publisherName: "Piyush Jain",
            displayName: "AgentX - Multi-Agent Orchestration",
            description: "AI-powered multi-agent orchestration for Visual Studio. Coordinates PM, Architect, Engineer, Reviewer, DevOps, and other agents via the shared AgentX CLI.")
        {
            // Marketplace metadata. All values must be compile-time constants because the
            // SDK source-generates the .vsixmanifest. Icon and License paths ship as VSIX
            // content (see csproj <Content Include="resources\icon.png" /> and LICENSE).
            Icon = "resources\\icon.png",
            License = "LICENSE",
            MoreInfo = "https://github.com/jnPiyush/AgentX",
            ReleaseNotes = "https://github.com/jnPiyush/AgentX/blob/master/CHANGELOG.md",
            Tags = new[] { "agent", "ai", "multi-agent", "workflow", "automation", "llm", "copilot", "powershell", "orchestration" },
        },
    };
}




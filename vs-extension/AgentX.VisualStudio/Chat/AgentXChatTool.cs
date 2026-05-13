// Copilot Chat extensibility for Visual Studio is a preview/preview-track API.
// This file is a stub that compiles only when the matching package is enabled
// in the .csproj (PackageReference 'Microsoft.VisualStudio.Copilot.Extensibility').
//
// When you opt in:
//   1. Uncomment the PackageReference in AgentX.VisualStudio.csproj.
//   2. Remove the '#if AGENTX_COPILOT_CHAT' guard below.
//   3. Implement the tool surface using whichever attribute the SDK exposes
//      (e.g. [VisualStudioContribution] on a ChatTool subclass).
//
// The tool simply delegates the user's prompt to `agentx loop iterate` and
// returns the CLI output, mirroring how the VS Code chat participant works.

#if AGENTX_COPILOT_CHAT
using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Services;
using Microsoft.VisualStudio.Copilot.Extensibility;
using Microsoft.VisualStudio.Extensibility;

namespace AgentX.VisualStudio.Chat;

[VisualStudioContribution]
internal sealed class AgentXChatTool : ChatTool
{
    public override ChatToolConfiguration Configuration => new("@agentx")
    {
        DisplayName = "AgentX",
        Description = "Multi-agent orchestration. Routes a prompt through the AgentX quality loop.",
    };

    public override async Task<ChatToolResult> InvokeAsync(
        ChatToolRequest request,
        IChatToolContext context,
        CancellationToken cancellationToken)
    {
        var configured = await Settings.AgentXSettings.RootPath.GetValueAsync(cancellationToken).ConfigureAwait(false);
        var root = await WorkspaceResolver.ResolveAsync(this.Extensibility, configured, cancellationToken)
            .ConfigureAwait(false);
        if (root is null)
        {
            return new ChatToolResult("AgentX repo not detected. Open the workspace or set 'agentx.rootPath'.");
        }

        var args = new[] { "loop", "iterate", "-s", request.Prompt };
        var result = await AgentXCli.RunAsync(root, args, cancellationToken).ConfigureAwait(false);
        return new ChatToolResult(result.Success ? result.StdOut : result.StdErr);
    }
}
#endif

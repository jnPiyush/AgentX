// Copilot Chat participant for the AgentX Visual Studio extension.
//
// This file compiles only when the AGENTX_COPILOT_CHAT compilation symbol is
// defined. The symbol is gated by the <EnableCopilotChat> MSBuild property in
// AgentX.VisualStudio.csproj (default: false). Enable the chat surface with:
//
//   dotnet build .\AgentX.VisualStudio.sln -c Release -p:EnableCopilotChat=true
//
// or set <EnableCopilotChat>true</EnableCopilotChat> in the csproj. When the
// symbol is defined, the Microsoft.VisualStudio.Extensibility.Copilot.Chat
// PackageReference is also brought in conditionally, exposing the
// ChatTool / ChatToolConfiguration / ChatToolRequest surfaces used below.
//
// The tool routes a user's prompt through `agentx loop iterate -s <prompt>`,
// mirroring how the VS Code chat participant `agentx.chat` integrates the same
// CLI (see vscode-extension/src/chat/chatParticipant.ts).
//
// Behaviour parity with VS Code:
//   * Activation guard: chat is registered only when the SDK package is
//     available at compile time. The VS Code equivalent uses a runtime probe
//     (`typeof vscode.chat?.createChatParticipant === 'function'`), which is
//     not necessary here because the build-time gate already prevents
//     reference errors.
//   * Workspace resolution: shares WorkspaceResolver with the menu commands
//     and tool window so the chat surface targets the same `.agentx` root the
//     user sees in the AgentX panel.

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
        var configured = await Settings.AgentXSettings.ReadRootPathAsync(this.Extensibility, cancellationToken).ConfigureAwait(false);
        var root = await WorkspaceResolver.ResolveAsync(this.Extensibility, configured, cancellationToken)
            .ConfigureAwait(false);
        if (root is null)
        {
            return new ChatToolResult("AgentX repo not detected. Open the workspace or set 'agentx.rootPath'.");
        }

        var args = new[] { "loop", "iterate", "-s", request.Prompt };
        var result = await AgentXCli.RunAsync(root, args, cancellationToken: cancellationToken).ConfigureAwait(false);
        return new ChatToolResult(result.Success ? result.StdOut : result.StdErr);
    }
}
#endif

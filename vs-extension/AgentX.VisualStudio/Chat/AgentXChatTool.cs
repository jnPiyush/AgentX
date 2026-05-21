// Copilot Chat participant for the AgentX Visual Studio extension.
//
// NOTE (current state, verified against SDK 17.14.40608):
//   The package Microsoft.VisualStudio.Extensibility.Copilot.Chat is NOT yet
//   published on any public NuGet feed. The VisualStudio.Extensibility OOP
//   SDK does not currently expose a chat-tool or chat-participant surface.
//   That is why @agentx does not appear in Visual Studio's Copilot chat
//   window after installing the VSIX -- the chat surface itself does not
//   exist for VS extensions today. The VS Code analogue
//   (vscode-extension/src/chat/chatParticipant.ts) uses VS Code's public
//   vscode.chat API, which has no equivalent in the VS Extensibility SDK
//   at this version. See vs-extension/README.md for the user-facing
//   explanation and the supported surfaces (Tool Window, Tools menu,
//   Command Palette).
//
//   This file is kept as a forward-looking stub so that the day Microsoft
//   publishes the chat extensibility package, enabling it is a single MSBuild
//   property flip plus a namespace/type reconciliation against the real
//   shipped API surface. The using directives and type names below are
//   speculative -- they will almost certainly need to be updated against the
//   actual SDK once it ships.
//
// This file compiles ONLY when the AGENTX_COPILOT_CHAT compilation symbol is
// defined. The symbol is gated by the <EnableCopilotChat> MSBuild property in
// AgentX.VisualStudio.csproj (default: false). Do NOT flip the default to
// true: dotnet restore will fail with NU1101 because the package id does not
// resolve on nuget.org.
//
// When the SDK ships, route a user's prompt through
// `agentx loop iterate -s <prompt>`, mirroring how the VS Code chat
// participant `agentx.chat` integrates the same CLI.
//
// Behaviour parity with VS Code (planned, not active today):
//   * Activation guard: chat will be registered only when the SDK package is
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

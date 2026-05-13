using System.Threading;
using System.Threading.Tasks;
using AgentX.VisualStudio.Services;
using AgentX.VisualStudio.Settings;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using Microsoft.VisualStudio.Extensibility.Shell;

namespace AgentX.VisualStudio.Commands;

/// <summary>
/// Shared boilerplate for AgentX commands: workspace resolution, output channel,
/// and a CLI invocation helper that streams to the Output window.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 requires every <see cref="Command"/> to take a
/// <see cref="VisualStudioExtensibility"/> argument and forward it to
/// <see cref="Command(VisualStudioExtensibility)"/>. The AgentX command surface
/// does that here so derived commands stay declaration-only.
/// </remarks>
internal abstract class AgentXCommand : Command
{
    private AgentXOutput? _output;

    protected AgentXCommand(VisualStudioExtensibility extensibility)
        : base(extensibility)
    {
    }

    protected AgentXOutput Output => _output ??= new AgentXOutput(this.Extensibility);

    protected async Task<string?> ResolveRootAsync(CancellationToken cancellationToken)
    {
        var configured = await AgentXSettings.ReadRootPathAsync(this.Extensibility, cancellationToken)
            .ConfigureAwait(false);
        return await WorkspaceResolver.ResolveAsync(this.Extensibility, configured, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Runs the AgentX CLI, streams output to the Output window, and shows a brief
    /// status prompt on failure.
    /// </summary>
    protected async Task<bool> RunCliAsync(string[] args, CancellationToken cancellationToken)
    {
        var root = await ResolveRootAsync(cancellationToken).ConfigureAwait(false);
        if (root is null)
        {
            await this.Extensibility.Shell().ShowPromptAsync(
                "AgentX repo not found. Open a folder containing '.agentx/agentx.ps1' or set the 'AgentX > Root Path' setting.",
                PromptOptions.OK,
                cancellationToken).ConfigureAwait(false);
            return false;
        }

        var shell = await AgentXSettings.ReadShellAsync(this.Extensibility, cancellationToken)
            .ConfigureAwait(false);

        await Output.ShowAsync(cancellationToken).ConfigureAwait(false);
        await Output.WriteLineAsync($"$ agentx {string.Join(' ', args)}", cancellationToken)
            .ConfigureAwait(false);

        var result = await AgentXCli.RunAsync(
            root,
            args,
            line => _ = Output.WriteLineAsync(line, cancellationToken),
            shellPreference: shell,
            cancellationToken: cancellationToken).ConfigureAwait(false);

        await Output.WriteLineAsync($"[exit {result.ExitCode}]", cancellationToken)
            .ConfigureAwait(false);

        if (!result.Success)
        {
            await this.Extensibility.Shell().ShowPromptAsync(
                $"agentx {string.Join(' ', args)} failed (exit {result.ExitCode}). See the AgentX Output window for details.",
                PromptOptions.OK,
                cancellationToken).ConfigureAwait(false);
        }

        return result.Success;
    }
}


using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Shell;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Maj-2 fix: surface AgentX quality-loop transitions as transient prompts.
/// </summary>
/// <remarks>
/// VS Code parity: the VS Code extension owns a status bar item
/// (<c>$(hubot) AgentX</c>) that updates whenever <c>.agentx/state/loop-state.json</c>
/// is rewritten. The Visual Studio 17.14 out-of-process Extensibility SDK does
/// not expose <c>IVsStatusbar</c> (and the VisualStudio.Shell APIs are not
/// reachable from an OOP extension), so we approximate parity by raising a
/// short modal prompt only on terminal transitions (active to complete,
/// active to blocked). The tool window keeps the always-visible badge.
///
/// Pure transition rules live in <see cref="LoopStatusTransitionState"/> so
/// they can be unit-tested without the VS Extensibility SDK; this class only
/// owns the <c>ShowPromptAsync</c> side-effect.
/// </remarks>
internal sealed class LoopStatusNotifier
{
    private readonly LoopStatusTransitionState _state = new();

    /// <summary>
    /// Compares the latest parsed <see cref="LoopStatusDto"/> against the last-seen
    /// status and shows a prompt when the loop crosses into <c>complete</c> or
    /// <c>blocked</c>. Suppressed while <paramref name="enabled"/> is false.
    /// </summary>
    public async Task UpdateAsync(
        VisualStudioExtensibility extensibility,
        LoopStatusDto? status,
        bool enabled,
        CancellationToken cancellationToken)
    {
        var (shouldNotify, message) = _state.Compute(status, enabled);
        if (!shouldNotify || message is null) return;

        try
        {
            await extensibility.Shell()
                .ShowPromptAsync(message, PromptOptions.OK, cancellationToken)
                .ConfigureAwait(false);
        }
        catch
        {
            // Best-effort surface; never break the refresh loop on prompt failure.
        }
    }

    /// <summary>Resets cached state, e.g. when the workspace root flips.</summary>
    public void Reset() => _state.Reset();
}

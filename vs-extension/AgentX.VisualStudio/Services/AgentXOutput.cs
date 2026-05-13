using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Documents;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Wraps the Visual Studio Output window 'AgentX' channel.
/// Mirrors the VS Code <c>OutputChannel</c> used by the TypeScript extension
/// so users see CLI output in the same place regardless of IDE.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 exposes the output API at
/// <c>extensibility.Views().Output.CreateOutputChannelAsync(displayName, ct)</c>
/// and returns an <see cref="OutputChannel"/>. Channels must be created at most
/// once per name per extension lifetime, so we cache the instance behind a
/// semaphore. Writes go through <c>OutputChannel.Writer.WriteLineAsync</c>.
/// </remarks>
internal sealed class AgentXOutput
{
    private const string ChannelName = "AgentX";

    private readonly VisualStudioExtensibility _extensibility;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private OutputChannel? _channel;

    public AgentXOutput(VisualStudioExtensibility extensibility)
    {
        _extensibility = extensibility;
    }

    public async Task WriteLineAsync(string message, CancellationToken cancellationToken = default)
    {
        var channel = await EnsureChannelAsync(cancellationToken).ConfigureAwait(false);
        await channel.Writer.WriteLineAsync(message ?? string.Empty).ConfigureAwait(false);
    }

    public async Task ShowAsync(CancellationToken cancellationToken = default)
    {
        // Creating (or reusing) the channel is enough to make it appear in the
        // Output window dropdown. The Extensibility SDK does not expose an
        // explicit Show on OutputChannel.
        _ = await EnsureChannelAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<OutputChannel> EnsureChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is not null)
        {
            return _channel;
        }

        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _channel ??= await _extensibility.Views().Output
                .CreateOutputChannelAsync(ChannelName, cancellationToken)
                .ConfigureAwait(false);
            return _channel;
        }
        finally
        {
            _gate.Release();
        }
    }
}


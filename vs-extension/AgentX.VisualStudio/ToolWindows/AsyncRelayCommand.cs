using System;
using System.Threading.Tasks;
using System.Windows.Input;

namespace AgentX.VisualStudio.ToolWindows;

/// <summary>
/// Minimal awaitable <see cref="ICommand"/> implementation. The VS
/// Extensibility SDK does not ship its own AsyncCommand on 17.14, so the
/// tool window VM provides one for buttons that need to await the AgentX
/// CLI.
/// </summary>
/// <remarks>
/// Re-entrancy is blocked while a previous invocation is still running.
/// <see cref="CanExecuteChanged"/> is raised on the same thread that called
/// <see cref="Execute"/>; for WPF buttons this is the UI dispatcher.
/// </remarks>
internal sealed class AsyncRelayCommand : ICommand
{
    private readonly Func<object?, Task> _execute;
    private readonly Func<object?, bool>? _canExecute;
    private bool _isRunning;

    public AsyncRelayCommand(Func<object?, Task> execute, Func<object?, bool>? canExecute = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
    }

    public AsyncRelayCommand(Func<Task> execute)
        : this(_ => execute())
    {
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter)
        => !_isRunning && (_canExecute?.Invoke(parameter) ?? true);

    public async void Execute(object? parameter)
    {
        if (!CanExecute(parameter)) return;

        _isRunning = true;
        RaiseCanExecuteChanged();
        try
        {
            await _execute(parameter).ConfigureAwait(true);
        }
        finally
        {
            _isRunning = false;
            RaiseCanExecuteChanged();
        }
    }

    public void RaiseCanExecuteChanged()
        => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}

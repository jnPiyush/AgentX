using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using AgentX.VisualStudio.Services;

namespace AgentX.VisualStudio.ToolWindows;

/// <summary>
/// Sectioned view-model for <see cref="AgentXToolWindowControl"/> matching
/// the five-tab layout (Status / Workflows / Loop / Council / Agents) so VS
/// users see the same surface as the VS Code sidebar.
/// </summary>
internal sealed class AgentXToolWindowViewModel : INotifyPropertyChanged
{
    private bool _isBusy;
    private string _logOutput = string.Empty;
    private string _workspaceRoot = string.Empty;

    // Status tab
    private string _loopStatus = "Click Refresh to load AgentX status.";
    private string _readyIssues = string.Empty;
    private string _agentState = string.Empty;
    private LoopStatusDto? _loopStatusModel;
    private bool _hasStructuredLoopStatus;
    private bool _hasStructuredReadyIssues;
    private bool _hasStructuredAgentState;

    // Loop tab
    private string _loopPromptInput = string.Empty;
    private string _iterationSummaryInput = string.Empty;
    private string _completionSummaryInput = string.Empty;

    public AgentXToolWindowViewModel()
    {
        ReadyIssueRows = new ObservableCollection<ReadyIssueDto>();
        AgentStateRows = new ObservableCollection<AgentStateRow>();
        LoopStatusHistoryRows = new ObservableCollection<LoopHistoryDto>();

        WorkflowItems = new ObservableCollection<WorkflowItem>(new[]
        {
            new WorkflowItem("feature", "Feature"),
            new WorkflowItem("epic", "Epic"),
            new WorkflowItem("story", "Story"),
            new WorkflowItem("bug", "Bug"),
            new WorkflowItem("spike", "Spike"),
            new WorkflowItem("devops", "DevOps"),
            new WorkflowItem("docs", "Docs"),
            new WorkflowItem("iterative-loop", "Iterative Loop"),
        });

        CouncilRoles = new ObservableCollection<CouncilItem>(new[]
        {
            new CouncilItem("research", "Research"),
            new CouncilItem("prd-scope", "PRD Scope"),
            new CouncilItem("adr-options", "ADR Options"),
            new CouncilItem("ai-design", "AI Design"),
            new CouncilItem("code-review", "Code Review"),
        });
    }

    public bool IsBusy
    {
        get => _isBusy;
        set => SetField(ref _isBusy, value);
    }

    public string WorkspaceRoot
    {
        get => _workspaceRoot;
        set => SetField(ref _workspaceRoot, value);
    }

    public string LogOutput
    {
        get => _logOutput;
        set => SetField(ref _logOutput, value);
    }

    // Status tab properties
    public string LoopStatus
    {
        get => _loopStatus;
        set => SetField(ref _loopStatus, value);
    }

    public string ReadyIssues
    {
        get => _readyIssues;
        set => SetField(ref _readyIssues, value);
    }

    public string AgentState
    {
        get => _agentState;
        set => SetField(ref _agentState, value);
    }

    /// <summary>Typed loop status when JSON parsed cleanly; null when fallback string is in use.</summary>
    public LoopStatusDto? LoopStatusModel
    {
        get => _loopStatusModel;
        set => SetField(ref _loopStatusModel, value);
    }

    /// <summary>True when the structured Loop Status panel should be shown instead of the fallback TextBox.</summary>
    public bool HasStructuredLoopStatus
    {
        get => _hasStructuredLoopStatus;
        set => SetField(ref _hasStructuredLoopStatus, value);
    }

    /// <summary>True when the structured Ready Issues list should be shown instead of the fallback TextBox.</summary>
    public bool HasStructuredReadyIssues
    {
        get => _hasStructuredReadyIssues;
        set => SetField(ref _hasStructuredReadyIssues, value);
    }

    /// <summary>True when the structured Agent State list should be shown instead of the fallback TextBox.</summary>
    public bool HasStructuredAgentState
    {
        get => _hasStructuredAgentState;
        set => SetField(ref _hasStructuredAgentState, value);
    }

    /// <summary>Recent iteration history rows (newest last) for the Loop Status panel.</summary>
    public ObservableCollection<LoopHistoryDto> LoopStatusHistoryRows { get; }

    /// <summary>Issue rows for the Ready Issues list.</summary>
    public ObservableCollection<ReadyIssueDto> ReadyIssueRows { get; }

    /// <summary>Agent rows for the Agent State list.</summary>
    public ObservableCollection<AgentStateRow> AgentStateRows { get; }

    /// <summary>
    /// Replaces structured Status-tab state in a single batch so the UI doesn't see a half-populated view.
    /// Pass <c>null</c> for any section that failed to parse; that section's <c>Has*</c> flag is cleared and
    /// the existing fallback string remains visible.
    /// </summary>
    public void SetStructuredStatus(
        LoopStatusDto? loopStatus,
        IReadOnlyList<ReadyIssueDto>? readyIssues,
        IReadOnlyList<AgentStateRow>? agentRows)
    {
        LoopStatusModel = loopStatus;
        HasStructuredLoopStatus = loopStatus is not null;
        LoopStatusHistoryRows.Clear();
        if (loopStatus?.History is { Count: > 0 } history)
        {
            // Show the most recent five entries to match the legacy Format* output.
            var start = System.Math.Max(0, history.Count - 5);
            for (var i = start; i < history.Count; i++)
            {
                LoopStatusHistoryRows.Add(history[i]);
            }
        }

        ReadyIssueRows.Clear();
        HasStructuredReadyIssues = readyIssues is not null;
        if (readyIssues is not null)
        {
            foreach (var issue in readyIssues)
            {
                ReadyIssueRows.Add(issue);
            }
        }

        AgentStateRows.Clear();
        HasStructuredAgentState = agentRows is not null;
        if (agentRows is not null)
        {
            foreach (var row in agentRows)
            {
                AgentStateRows.Add(row);
            }
        }
    }

    // Loop tab inputs
    public string LoopPromptInput
    {
        get => _loopPromptInput;
        set => SetField(ref _loopPromptInput, value);
    }

    public string IterationSummaryInput
    {
        get => _iterationSummaryInput;
        set => SetField(ref _iterationSummaryInput, value);
    }

    public string CompletionSummaryInput
    {
        get => _completionSummaryInput;
        set => SetField(ref _completionSummaryInput, value);
    }

    // Workflows / Council collections
    public ObservableCollection<WorkflowItem> WorkflowItems { get; }

    public ObservableCollection<CouncilItem> CouncilRoles { get; }

    // Commands -- assigned by the control after construction.
    public ICommand? RefreshCommand { get; set; }
    public ICommand? StartLoopCommand { get; set; }
    public ICommand? IterateLoopCommand { get; set; }
    public ICommand? CompleteLoopCommand { get; set; }
    public ICommand? CancelLoopCommand { get; set; }
    public ICommand? RollbackLoopCommand { get; set; }
    public ICommand? RunWorkflowCommand { get; set; }
    public ICommand? RunCouncilCommand { get; set; }
    public ICommand? GenerateDigestCommand { get; set; }
    public ICommand? ScrubCommand { get; set; }
    public ICommand? AddAgentCommand { get; set; }
    public ICommand? AddSkillCommand { get; set; }

    public event PropertyChangedEventHandler? PropertyChanged;

    public void AppendLog(string line)
    {
        LogOutput = string.IsNullOrEmpty(LogOutput) ? line : LogOutput + System.Environment.NewLine + line;
    }

    private void SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (Equals(field, value)) return;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}

/// <summary>Workflow type displayed in the Workflows tab.</summary>
internal sealed record WorkflowItem(string Id, string DisplayName);

/// <summary>Council role displayed in the Council tab.</summary>
internal sealed record CouncilItem(string Id, string DisplayName);


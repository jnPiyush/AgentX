using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgentX.VisualStudio.Services;

/// <summary>
/// Parses <c>--json</c> output from the AgentX CLI and converts the structured
/// results into compact, human-readable strings for the AgentX tool window.
/// </summary>
/// <remarks>
/// All <c>Format*</c> helpers fall back to the raw input when JSON parsing
/// fails so the UI never goes blank because of an unexpected schema change.
/// </remarks>
internal static class AgentXCliJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Attempts to deserialize <c>agentx loop status --json</c> output into a structured
    /// <see cref="LoopStatusDto"/> for typed WPF binding. Returns <c>false</c> when the input
    /// is empty or malformed; callers can then fall back to <see cref="FormatLoopStatus"/>.
    /// </summary>
    public static bool TryParseLoopStatus(string rawJson, out LoopStatusDto? status)
    {
        status = null;
        if (string.IsNullOrWhiteSpace(rawJson)) return false;
        try
        {
            status = JsonSerializer.Deserialize<LoopStatusDto>(rawJson, Options);
            return status is not null;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>
    /// Attempts to deserialize <c>agentx ready --json</c> output into a list of
    /// <see cref="ReadyIssueDto"/>. Returns <c>false</c> when the input is empty or malformed.
    /// On success an empty list is a valid result (means "no ready work").
    /// </summary>
    public static bool TryParseReadyIssues(string rawJson, out IReadOnlyList<ReadyIssueDto> issues)
    {
        issues = Array.Empty<ReadyIssueDto>();
        if (string.IsNullOrWhiteSpace(rawJson)) return false;
        try
        {
            var parsed = JsonSerializer.Deserialize<List<ReadyIssueDto>>(rawJson, Options);
            issues = parsed ?? new List<ReadyIssueDto>();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>
    /// Attempts to deserialize <c>agentx state --json</c> output into row records for
    /// list binding. Returns <c>false</c> when the input is empty or malformed. On success an
    /// empty list is a valid result (means "no agent state").
    /// </summary>
    public static bool TryParseAgentState(string rawJson, out IReadOnlyList<AgentStateRow> rows)
    {
        rows = Array.Empty<AgentStateRow>();
        if (string.IsNullOrWhiteSpace(rawJson)) return false;
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, AgentStateDto>>(rawJson, Options);
            if (dict is null)
            {
                rows = Array.Empty<AgentStateRow>();
                return true;
            }

            rows = dict
                .OrderBy(p => p.Key, StringComparer.Ordinal)
                .Select(p => new AgentStateRow(
                    Name: p.Key,
                    Status: p.Value?.Status ?? "idle",
                    Issue: p.Value?.Issue,
                    LastActivity: string.IsNullOrWhiteSpace(p.Value?.LastActivity)
                        ? null
                        : FormatTimestamp(p.Value!.LastActivity!)))
                .ToList();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>Renders <c>agentx loop status --json</c> output as a compact summary.</summary>
    public static string FormatLoopStatus(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return "(no loop state)";
        }

        try
        {
            var status = JsonSerializer.Deserialize<LoopStatusDto>(rawJson, Options);
            if (status is null)
            {
                return rawJson.Trim();
            }

            var sb = new StringBuilder();
            var stateLabel = status.Active == true ? "ACTIVE" : (status.Status ?? "(unknown)");
            sb.Append("State: ").Append(stateLabel.ToUpperInvariant());

            if (status.Iteration is int iter)
            {
                sb.Append("  |  Iteration ").Append(iter);
                if (status.MinIterations is int min || status.MaxIterations is int max)
                {
                    sb.Append(" (min=").Append(status.MinIterations ?? 0)
                      .Append(", max=").Append(status.MaxIterations ?? 0).Append(')');
                }
            }

            if (status.IssueNumber is int issue)
            {
                sb.Append("  |  Issue #").Append(issue);
            }

            if (!string.IsNullOrWhiteSpace(status.Prompt))
            {
                sb.AppendLine().Append("Prompt: ").Append(Truncate(status.Prompt, 160));
            }

            if (!string.IsNullOrWhiteSpace(status.LastIterationAt))
            {
                sb.AppendLine().Append("Last iteration: ").Append(FormatTimestamp(status.LastIterationAt));
            }

            if (status.History is { Count: > 0 } history)
            {
                sb.AppendLine().AppendLine().Append("Recent history:");
                foreach (var entry in history.Skip(Math.Max(0, history.Count - 5)))
                {
                    sb.AppendLine();
                    sb.Append("  [")
                      .Append(entry.Iteration?.ToString(CultureInfo.InvariantCulture) ?? "?")
                      .Append("] ")
                      .Append(entry.Status ?? "?")
                      .Append(" - ")
                      .Append(Truncate(entry.Summary ?? string.Empty, 140));
                }
            }

            return sb.ToString();
        }
        catch (JsonException)
        {
            return rawJson.Trim();
        }
    }

    /// <summary>Renders <c>agentx ready --json</c> output as a one-line-per-issue list.</summary>
    public static string FormatReadyIssues(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return "(no ready work)";
        }

        try
        {
            var issues = JsonSerializer.Deserialize<List<ReadyIssueDto>>(rawJson, Options);
            if (issues is null || issues.Count == 0)
            {
                return "(no ready work)";
            }

            var sb = new StringBuilder();
            sb.Append(issues.Count).AppendLine(" ready issue(s):");
            foreach (var issue in issues)
            {
                sb.Append("  #").Append(issue.Number?.ToString(CultureInfo.InvariantCulture) ?? "?");
                if (issue.Labels is { Count: > 0 })
                {
                    sb.Append(" [").Append(string.Join(",", issue.Labels)).Append(']');
                }
                sb.Append("  ").Append(Truncate(issue.Title ?? string.Empty, 110));
                sb.AppendLine();
            }
            return sb.ToString().TrimEnd();
        }
        catch (JsonException)
        {
            return rawJson.Trim();
        }
    }

    /// <summary>Renders <c>agentx state --json</c> output as one line per agent.</summary>
    public static string FormatAgentState(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return "(no agent state)";
        }

        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, AgentStateDto>>(rawJson, Options);
            if (dict is null || dict.Count == 0)
            {
                return "(no agent state)";
            }

            var sb = new StringBuilder();
            foreach (var kvp in dict.OrderBy(p => p.Key, StringComparer.Ordinal))
            {
                sb.Append("  ").Append(kvp.Key.PadRight(22))
                  .Append(' ').Append((kvp.Value?.Status ?? "idle").PadRight(14));
                if (kvp.Value?.Issue is int issue)
                {
                    sb.Append(" #").Append(issue);
                }
                if (!string.IsNullOrWhiteSpace(kvp.Value?.LastActivity))
                {
                    sb.Append("  (").Append(FormatTimestamp(kvp.Value!.LastActivity!)).Append(')');
                }
                sb.AppendLine();
            }
            return sb.ToString().TrimEnd();
        }
        catch (JsonException)
        {
            return rawJson.Trim();
        }
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
        return value.Substring(0, maxLength - 3) + "...";
    }

    private static string FormatTimestamp(string iso)
    {
        if (DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dto))
        {
            return dto.ToLocalTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        }
        return iso;
    }
}

/// <summary>Loop state surfaced from <c>agentx loop status --json</c>.</summary>
internal sealed class LoopStatusDto
{
    [JsonPropertyName("active")] public bool? Active { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("prompt")] public string? Prompt { get; set; }
    [JsonPropertyName("iteration")] public int? Iteration { get; set; }
    [JsonPropertyName("minIterations")] public int? MinIterations { get; set; }
    [JsonPropertyName("maxIterations")] public int? MaxIterations { get; set; }
    [JsonPropertyName("issueNumber")] public int? IssueNumber { get; set; }
    [JsonPropertyName("startedAt")] public string? StartedAt { get; set; }
    [JsonPropertyName("lastIterationAt")] public string? LastIterationAt { get; set; }
    [JsonPropertyName("history")] public List<LoopHistoryDto>? History { get; set; }
}

/// <summary>Single iteration entry inside <see cref="LoopStatusDto.History"/>.</summary>
internal sealed class LoopHistoryDto
{
    [JsonPropertyName("iteration")] public int? Iteration { get; set; }
    [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }
    [JsonPropertyName("summary")] public string? Summary { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("outcome")] public string? Outcome { get; set; }
}

/// <summary>Single issue surfaced from <c>agentx ready --json</c>.</summary>
internal sealed class ReadyIssueDto
{
    [JsonPropertyName("number")] public int? Number { get; set; }
    [JsonPropertyName("title")] public string? Title { get; set; }
    [JsonPropertyName("state")] public string? State { get; set; }
    [JsonPropertyName("url")] public string? Url { get; set; }
    [JsonPropertyName("labels")] public List<string>? Labels { get; set; }
}

/// <summary>Per-agent record decoded from <c>agentx state --json</c>.</summary>
internal sealed class AgentStateDto
{
    [JsonPropertyName("lastActivity")] public string? LastActivity { get; set; }
    [JsonPropertyName("issue")] public int? Issue { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
}

/// <summary>
/// Flattened agent-state row used by the Status tab list binding.
/// <see cref="LastActivity"/> is already formatted into local time when set.
/// </summary>
internal sealed record AgentStateRow(string Name, string Status, int? Issue, string? LastActivity);

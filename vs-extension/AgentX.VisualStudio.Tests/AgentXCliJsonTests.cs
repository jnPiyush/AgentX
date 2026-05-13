using System.IO;
using System.Linq;
using AgentX.VisualStudio.Services;
using FluentAssertions;
using Xunit;

namespace AgentX.VisualStudio.Tests;

/// <summary>
/// Behavior tests for <see cref="AgentXCliJson"/>.
/// Validates happy-path rendering, empty-state handling, malformed-JSON
/// fallback, and truncation rules across the three CLI schemas the tool
/// window consumes (loop status, ready, state).
/// </summary>
public sealed class AgentXCliJsonTests
{
    private static string Fixture(string name)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "Fixtures");
        return File.ReadAllText(Path.Combine(dir, name));
    }

    // -----------------------------------------------------------------------
    // FormatLoopStatus
    // -----------------------------------------------------------------------

    [Fact]
    public void FormatLoopStatus_ActiveLoop_RendersStateIterationAndHistory()
    {
        var json = Fixture("loop-status-active.json");

        var output = AgentXCliJson.FormatLoopStatus(json);

        output.Should().Contain("State: ACTIVE");
        output.Should().Contain("Iteration 3");
        output.Should().Contain("(min=5, max=10)");
        output.Should().Contain("Issue #42");
        output.Should().Contain("Prompt: Add unit tests");
        output.Should().Contain("Recent history:");
        output.Should().Contain("[1] active");
        output.Should().Contain("[3] active");
    }

    [Fact]
    public void FormatLoopStatus_InactiveLiteral_RendersInactiveState()
    {
        var json = Fixture("loop-status-empty.json");

        var output = AgentXCliJson.FormatLoopStatus(json);

        // The CLI emits {"active":false} when no loop exists. The formatter
        // should produce a non-empty, non-throwing summary.
        output.Should().NotBeNullOrWhiteSpace();
        output.Should().StartWith("State: ");
        output.Should().NotContain("Iteration ");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t  \r")]
    public void FormatLoopStatus_NullOrWhitespace_ReturnsEmptyMarker(string? input)
    {
        var output = AgentXCliJson.FormatLoopStatus(input!);

        output.Should().Be("(no loop state)");
    }

    [Fact]
    public void FormatLoopStatus_MalformedJson_FallsBackToTrimmedRaw()
    {
        const string broken = "  { not valid json  ";

        var output = AgentXCliJson.FormatLoopStatus(broken);

        output.Should().Be("{ not valid json");
    }

    [Fact]
    public void FormatLoopStatus_LongPrompt_IsTruncatedWithEllipsis()
    {
        var longPrompt = new string('x', 300);
        var json = "{ \"active\": true, \"status\": \"active\", \"iteration\": 1, \"prompt\": \"" + longPrompt + "\" }";

        var output = AgentXCliJson.FormatLoopStatus(json);

        output.Should().Contain("...");
        // The prompt line should not contain all 300 chars verbatim.
        output.Should().NotContain(longPrompt);
    }

    // -----------------------------------------------------------------------
    // FormatReadyIssues
    // -----------------------------------------------------------------------

    [Fact]
    public void FormatReadyIssues_WithIssues_RendersCountAndPerIssueLines()
    {
        var json = Fixture("ready-with-issues.json");

        var output = AgentXCliJson.FormatReadyIssues(json);

        output.Should().StartWith("3 ready issue(s):");
        output.Should().Contain("#101");
        output.Should().Contain("#102");
        output.Should().Contain("#103");
        output.Should().Contain("[type:story,needs:engineer,priority:high]");
        output.Should().Contain("Wire AgentX tool window");
    }

    [Fact]
    public void FormatReadyIssues_EmptyArray_ReturnsEmptyMarker()
    {
        var json = Fixture("ready-empty.json");

        var output = AgentXCliJson.FormatReadyIssues(json);

        output.Should().Be("(no ready work)");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void FormatReadyIssues_NullOrWhitespace_ReturnsEmptyMarker(string? input)
    {
        var output = AgentXCliJson.FormatReadyIssues(input!);

        output.Should().Be("(no ready work)");
    }

    [Fact]
    public void FormatReadyIssues_MalformedJson_FallsBackToTrimmedRaw()
    {
        const string broken = "  [ {not valid} ]  ";

        var output = AgentXCliJson.FormatReadyIssues(broken);

        output.Should().Be("[ {not valid} ]");
    }

    [Fact]
    public void FormatReadyIssues_LongTitle_IsTruncated()
    {
        var longTitle = new string('y', 300);
        var json = "[{ \"number\": 1, \"title\": \"" + longTitle + "\", \"labels\": [] }]";

        var output = AgentXCliJson.FormatReadyIssues(json);

        output.Should().Contain("...");
        output.Should().NotContain(longTitle);
    }

    // -----------------------------------------------------------------------
    // FormatAgentState
    // -----------------------------------------------------------------------

    [Fact]
    public void FormatAgentState_MultipleAgents_RendersOrderedRows()
    {
        var json = Fixture("state-multiple-agents.json");

        var output = AgentXCliJson.FormatAgentState(json);

        output.Should().Contain("architect");
        output.Should().Contain("auto-fix-reviewer");
        output.Should().Contain("engineer");
        output.Should().Contain("reviewer");
        output.Should().Contain("working");
        output.Should().Contain("reviewing");
        output.Should().Contain("idle");
        output.Should().Contain("done");
        output.Should().Contain("#42");
        output.Should().Contain("#41");

        // Each row begins (after leading whitespace) with the agent name followed by padding.
        // Anchor on "agent + space" at line start so "reviewer" does not match inside "auto-fix-reviewer".
        var lines = output.Split('\n');
        int LineIndex(string agent) =>
            Array.FindIndex(lines, l => l.TrimStart().StartsWith(agent + " ", StringComparison.Ordinal));

        var iArchitect = LineIndex("architect");
        var iAutoFix   = LineIndex("auto-fix-reviewer");
        var iEngineer  = LineIndex("engineer");
        var iReviewer  = LineIndex("reviewer");

        iArchitect.Should().BeGreaterThanOrEqualTo(0);
        iAutoFix.Should().BeGreaterThanOrEqualTo(0);
        iEngineer.Should().BeGreaterThanOrEqualTo(0);
        iReviewer.Should().BeGreaterThanOrEqualTo(0);

        // Ordinal sort puts 'architect' before 'auto-fix-reviewer' before 'engineer' before 'reviewer'.
        iArchitect.Should().BeLessThan(iAutoFix);
        iAutoFix.Should().BeLessThan(iEngineer);
        iEngineer.Should().BeLessThan(iReviewer);
    }

    [Fact]
    public void FormatAgentState_AgentWithoutIssue_OmitsIssueMarker()
    {
        var json = Fixture("state-multiple-agents.json");

        var output = AgentXCliJson.FormatAgentState(json);

        // 'architect' has issue=null in the fixture, so its row must not include "#".
        var lines = output.Split('\n');
        var architectLine = Array.Find(lines, l => l.Contains("architect", StringComparison.Ordinal))!;
        architectLine.Should().NotBeNull();
        architectLine.Should().NotContain(" #");
    }

    [Fact]
    public void FormatAgentState_EmptyDictionary_ReturnsEmptyMarker()
    {
        var json = Fixture("state-empty.json");

        var output = AgentXCliJson.FormatAgentState(json);

        output.Should().Be("(no agent state)");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void FormatAgentState_NullOrWhitespace_ReturnsEmptyMarker(string? input)
    {
        var output = AgentXCliJson.FormatAgentState(input!);

        output.Should().Be("(no agent state)");
    }

    [Fact]
    public void FormatAgentState_MalformedJson_FallsBackToTrimmedRaw()
    {
        const string broken = "  { engineer: bad }  ";

        var output = AgentXCliJson.FormatAgentState(broken);

        output.Should().Be("{ engineer: bad }");
    }

    // -----------------------------------------------------------------------
    // TryParseLoopStatus
    // -----------------------------------------------------------------------

    [Fact]
    public void TryParseLoopStatus_HappyPath_ReturnsDtoWithIterationAndHistory()
    {
        var json = Fixture("loop-status-active.json");

        var ok = AgentXCliJson.TryParseLoopStatus(json, out var status);

        ok.Should().BeTrue();
        status.Should().NotBeNull();
        status!.Active.Should().BeTrue();
        status.Iteration.Should().Be(3);
        status.IssueNumber.Should().Be(42);
        status.History.Should().NotBeNull();
        status.History!.Should().HaveCountGreaterThanOrEqualTo(3);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryParseLoopStatus_NullOrWhitespace_ReturnsFalseWithNull(string? input)
    {
        var ok = AgentXCliJson.TryParseLoopStatus(input!, out var status);

        ok.Should().BeFalse();
        status.Should().BeNull();
    }

    [Fact]
    public void TryParseLoopStatus_MalformedJson_ReturnsFalseWithNull()
    {
        var ok = AgentXCliJson.TryParseLoopStatus("{ not valid json", out var status);

        ok.Should().BeFalse();
        status.Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // TryParseReadyIssues
    // -----------------------------------------------------------------------

    [Fact]
    public void TryParseReadyIssues_HappyPath_ReturnsAllIssuesInOrder()
    {
        var json = Fixture("ready-with-issues.json");

        var ok = AgentXCliJson.TryParseReadyIssues(json, out var issues);

        ok.Should().BeTrue();
        issues.Should().HaveCount(3);
        issues[0].Number.Should().Be(101);
        issues[0].Labels.Should().NotBeNull();
        issues[0].Labels!.Should().Contain("type:story");
    }

    [Fact]
    public void TryParseReadyIssues_EmptyArray_ReturnsTrueWithEmptyList()
    {
        var json = Fixture("ready-empty.json");

        var ok = AgentXCliJson.TryParseReadyIssues(json, out var issues);

        ok.Should().BeTrue();
        issues.Should().BeEmpty();
    }

    [Fact]
    public void TryParseReadyIssues_MalformedJson_ReturnsFalseWithEmptyList()
    {
        var ok = AgentXCliJson.TryParseReadyIssues("[ {not valid} ]", out var issues);

        ok.Should().BeFalse();
        issues.Should().BeEmpty();
    }

    // -----------------------------------------------------------------------
    // TryParseAgentState
    // -----------------------------------------------------------------------

    [Fact]
    public void TryParseAgentState_HappyPath_OrdersAgentsAlphabetically()
    {
        var json = Fixture("state-multiple-agents.json");

        var ok = AgentXCliJson.TryParseAgentState(json, out var rows);

        ok.Should().BeTrue();
        rows.Should().HaveCount(4);
        // Ordinal sort: architect < auto-fix-reviewer < engineer < reviewer.
        rows[0].Name.Should().Be("architect");
        rows[1].Name.Should().Be("auto-fix-reviewer");
        rows[2].Name.Should().Be("engineer");
        rows[3].Name.Should().Be("reviewer");
        rows[2].Issue.Should().Be(42);
        rows[2].Status.Should().Be("working");
        rows[0].Issue.Should().BeNull();
    }

    [Fact]
    public void TryParseAgentState_FormatsLastActivityToLocalTime()
    {
        var json = Fixture("state-multiple-agents.json");

        AgentXCliJson.TryParseAgentState(json, out var rows).Should().BeTrue();

        var engineer = rows.First(r => r.Name == "engineer");
        engineer.LastActivity.Should().NotBeNullOrWhiteSpace();
        // Formatted output is "yyyy-MM-dd HH:mm" (no T separator, no Z suffix).
        engineer.LastActivity.Should().NotContain("T");
        engineer.LastActivity.Should().NotContain("Z");
        engineer.LastActivity.Should().MatchRegex(@"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$");
    }

    [Fact]
    public void TryParseAgentState_EmptyDictionary_ReturnsTrueWithEmptyList()
    {
        var json = Fixture("state-empty.json");

        var ok = AgentXCliJson.TryParseAgentState(json, out var rows);

        ok.Should().BeTrue();
        rows.Should().BeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryParseAgentState_NullOrWhitespace_ReturnsFalseWithEmptyList(string? input)
    {
        var ok = AgentXCliJson.TryParseAgentState(input!, out var rows);

        ok.Should().BeFalse();
        rows.Should().BeEmpty();
    }

    [Fact]
    public void TryParseAgentState_MalformedJson_ReturnsFalseWithEmptyList()
    {
        var ok = AgentXCliJson.TryParseAgentState("{ engineer: bad }", out var rows);

        ok.Should().BeFalse();
        rows.Should().BeEmpty();
    }
}

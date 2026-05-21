using AgentX.VisualStudio.Services;
using FluentAssertions;
using Xunit;

namespace AgentX.VisualStudio.Tests;

/// <summary>
/// Behavior tests for <see cref="WorkflowShortcutsTrailer"/>.
/// The trailer is appended to the AgentX Output window by
/// <c>ShowStatusCommand</c> so users discover the
/// <c>AgentX: Workflow - *</c> shortcuts. These tests pin the display
/// names to the literals in <c>string-resources.json</c> so a drift in
/// either file is caught at build time.
/// </summary>
public sealed class WorkflowShortcutsTrailerTests
{
    private static readonly string[] ExpectedDisplayNames = new[]
    {
        "AgentX: Workflow - Feature",
        "AgentX: Workflow - Epic",
        "AgentX: Workflow - Story",
        "AgentX: Workflow - Bug",
        "AgentX: Workflow - Spike",
        "AgentX: Workflow - DevOps",
        "AgentX: Workflow - Docs",
        "AgentX: Workflow - Iterative Loop",
    };

    [Fact]
    public void WorkflowDisplayNames_ExposesEightShortcutsInToolsMenuOrder()
    {
        WorkflowShortcutsTrailer.WorkflowDisplayNames
            .Should().Equal(ExpectedDisplayNames);
    }

    [Fact]
    public void Build_ContainsHeaderFollowedByAllEightDisplayNames()
    {
        var trailer = WorkflowShortcutsTrailer.Build();

        trailer.Should().Contain(WorkflowShortcutsTrailer.Header);
        foreach (var name in ExpectedDisplayNames)
        {
            trailer.Should().Contain(name);
        }
    }

    [Fact]
    public void Build_PrefixesEachShortcutWithBulletAndPlacesHeaderBeforeFirstShortcut()
    {
        var trailer = WorkflowShortcutsTrailer.Build();

        var headerIndex = trailer.IndexOf(WorkflowShortcutsTrailer.Header);
        headerIndex.Should().BeGreaterOrEqualTo(0);

        foreach (var name in ExpectedDisplayNames)
        {
            trailer.Should().Contain("  - " + name);
            trailer.IndexOf(name).Should().BeGreaterThan(headerIndex,
                "the trailer must list shortcuts after the header line so the Output pane reads top-down");
        }
    }

    [Fact]
    public void Build_StartsWithBlankLineToSeparateFromPrecedingCliOutput()
    {
        var trailer = WorkflowShortcutsTrailer.Build();

        // Two characters: the leading "\r\n" (Windows) or "\n" (Unix) emitted
        // by AppendLine on an empty line. We just need at least one newline
        // before any visible content.
        trailer.TrimStart('\r', '\n').Should().NotStartWith(" ");
        var firstVisible = trailer.IndexOf(WorkflowShortcutsTrailer.Header);
        var prefix = trailer.Substring(0, firstVisible);
        prefix.Should().MatchRegex(@"^[\r\n]+$",
            "the trailer must begin with a blank line so the header is visually offset from the prior `[exit N]` line");
    }
}

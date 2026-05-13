using AgentX.VisualStudio.Services;
using FluentAssertions;
using Xunit;

namespace AgentX.VisualStudio.Tests;

/// <summary>
/// Unit tests for the cache invalidation surface added to
/// <c>WorkspaceResolver</c> by H-3. Only the
/// <see cref="WorkspaceRootChangedEventArgs"/> payload is exercised here -
/// the static <c>WorkspaceResolver</c> type itself depends on the VS
/// Extensibility SDK and is covered by the in-IDE smoke tests instead.
/// </summary>
public sealed class WorkspaceResolverEventTests
{
    [Fact]
    public void WorkspaceRootChangedEventArgs_carries_previous_and_current_roots()
    {
        var args = new WorkspaceRootChangedEventArgs(previousRoot: "C:\\old", currentRoot: "C:\\new");

        args.PreviousRoot.Should().Be("C:\\old");
        args.CurrentRoot.Should().Be("C:\\new");
    }

    [Fact]
    public void WorkspaceRootChangedEventArgs_allows_null_previous_for_initial_resolution()
    {
        var args = new WorkspaceRootChangedEventArgs(previousRoot: null, currentRoot: "C:\\repo");

        args.PreviousRoot.Should().BeNull();
        args.CurrentRoot.Should().Be("C:\\repo");
    }

    [Fact]
    public void WorkspaceRootChangedEventArgs_allows_null_current_for_solution_close()
    {
        var args = new WorkspaceRootChangedEventArgs(previousRoot: "C:\\repo", currentRoot: null);

        args.PreviousRoot.Should().Be("C:\\repo");
        args.CurrentRoot.Should().BeNull();
    }

    [Fact]
    public void WorkspaceRootChangedEventArgs_allows_both_null_when_resolver_has_no_root()
    {
        var args = new WorkspaceRootChangedEventArgs(previousRoot: null, currentRoot: null);

        args.PreviousRoot.Should().BeNull();
        args.CurrentRoot.Should().BeNull();
    }
}

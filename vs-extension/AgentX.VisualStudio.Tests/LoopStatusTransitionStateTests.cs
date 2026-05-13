using AgentX.VisualStudio.Services;
using FluentAssertions;
using Xunit;

namespace AgentX.VisualStudio.Tests;

/// <summary>
/// Unit tests for the pure transition state machine that backs
/// <c>LoopStatusNotifier</c> (Maj-2). Verifies the rules for when a terminal
/// transition should produce a prompt and how the message is formatted.
/// </summary>
public sealed class LoopStatusTransitionStateTests
{
    private static LoopStatusDto Status(string? status, bool? active = null, int? iteration = null, int? issue = null)
        => new()
        {
            Status = status,
            Active = active,
            Iteration = iteration,
            IssueNumber = issue,
        };

    [Fact]
    public void Compute_returns_no_notification_when_disabled()
    {
        var state = new LoopStatusTransitionState();
        // Prime active state so a transition would otherwise fire.
        state.Compute(Status("active", active: true), enabled: true);

        var (should, msg) = state.Compute(Status("complete", active: false, iteration: 5), enabled: false);

        should.Should().BeFalse();
        msg.Should().BeNull();
    }

    [Fact]
    public void Compute_returns_no_notification_when_status_null()
    {
        var state = new LoopStatusTransitionState();

        var (should, msg) = state.Compute(status: null, enabled: true);

        should.Should().BeFalse();
        msg.Should().BeNull();
    }

    [Fact]
    public void Compute_does_not_notify_on_first_terminal_without_prior_active()
    {
        // Mirrors the case where the tool window opens onto an already-complete loop.
        var state = new LoopStatusTransitionState();

        var (should, msg) = state.Compute(Status("complete", active: false, iteration: 7), enabled: true);

        should.Should().BeFalse();
        msg.Should().BeNull();
    }

    [Fact]
    public void Compute_notifies_on_active_to_complete_transition()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true, iteration: 3), enabled: true);

        var (should, msg) = state.Compute(Status("complete", active: false, iteration: 5, issue: 42), enabled: true);

        should.Should().BeTrue();
        msg.Should().Be("AgentX loop COMPLETE at iteration 5 (issue #42).");
    }

    [Fact]
    public void Compute_notifies_on_active_to_blocked_transition()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true, iteration: 2), enabled: true);

        var (should, msg) = state.Compute(Status("BLOCKED", active: false, iteration: 4), enabled: true);

        should.Should().BeTrue();
        msg.Should().Be("AgentX loop BLOCKED at iteration 4.");
    }

    [Fact]
    public void Compute_does_not_re_notify_for_same_terminal_status()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);
        state.Compute(Status("complete", active: false, iteration: 5), enabled: true);

        var (should, msg) = state.Compute(Status("complete", active: false, iteration: 5), enabled: true);

        should.Should().BeFalse();
        msg.Should().BeNull();
    }

    [Fact]
    public void Compute_re_arms_after_returning_to_active()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);
        state.Compute(Status("complete", active: false, iteration: 5), enabled: true);
        // New loop kicks off.
        state.Compute(Status("active", active: true, iteration: 1), enabled: true);

        var (should, msg) = state.Compute(Status("complete", active: false, iteration: 6), enabled: true);

        should.Should().BeTrue();
        msg.Should().Be("AgentX loop COMPLETE at iteration 6.");
    }

    [Fact]
    public void Compute_can_switch_between_blocked_and_complete_after_active()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);
        var first = state.Compute(Status("blocked", active: false, iteration: 3), enabled: true);
        state.Compute(Status("active", active: true), enabled: true);
        var second = state.Compute(Status("complete", active: false, iteration: 4), enabled: true);

        first.ShouldNotify.Should().BeTrue();
        first.Message.Should().Contain("BLOCKED");
        second.ShouldNotify.Should().BeTrue();
        second.Message.Should().Contain("COMPLETE");
    }

    [Fact]
    public void Compute_treats_unknown_status_text_as_non_terminal()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);

        var (should, msg) = state.Compute(Status("paused", active: false, iteration: 9), enabled: true);

        should.Should().BeFalse();
        msg.Should().BeNull();
    }

    [Fact]
    public void Compute_uses_question_mark_when_iteration_missing()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);

        var (should, msg) = state.Compute(Status("complete", active: false), enabled: true);

        should.Should().BeTrue();
        msg.Should().Be("AgentX loop COMPLETE at iteration ?.");
    }

    [Fact]
    public void Reset_clears_terminal_memory_and_active_flag()
    {
        var state = new LoopStatusTransitionState();
        state.Compute(Status("active", active: true), enabled: true);
        state.Compute(Status("complete", active: false, iteration: 5), enabled: true);
        state.Reset();

        // After reset, a fresh complete with no active prior should not fire.
        var (should, _) = state.Compute(Status("complete", active: false, iteration: 5), enabled: true);

        should.Should().BeFalse();
    }
}

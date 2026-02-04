# Add Local Mode Support

## Description
Enable AgentX to work without a GitHub repository by implementing filesystem-based issue tracking and agent coordination.

## Motivation
Users should be able to use AgentX for local development without requiring GitHub infrastructure.

## Implementation Plan
1. Detect repo setup status during installation
2. Create local issue tracking system (`.agentx/` directory)
3. Implement local status management
4. Update agent workflows to support both modes
5. Add mode switching capability

## Acceptance Criteria
- [ ] Install script detects missing repo and enables local mode
- [ ] Local issue creation/management works
- [ ] Agent coordination works via local files
- [ ] Status tracking works without GitHub Projects
- [ ] All existing agents compatible with local mode

## Type
type:feature

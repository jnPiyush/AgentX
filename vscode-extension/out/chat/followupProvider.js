"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentXFollowupProvider = void 0;
/**
 * Provides contextual follow-up suggestions after each chat response.
 */
class AgentXFollowupProvider {
    _agentx;
    constructor(_agentx) {
        this._agentx = _agentx;
    }
    provideFollowups(result, _context, _token) {
        const meta = result.metadata;
        if (!meta) {
            return [];
        }
        if (!meta.initialized) {
            return [{
                    prompt: 'How do I initialize AgentX?',
                    label: 'Learn about initialization',
                }];
        }
        const followups = [];
        switch (meta.command) {
            case 'ready':
                followups.push({ prompt: 'feature', label: 'Start a feature workflow', command: 'workflow' }, { prompt: '', label: 'Check agent status', command: 'status' });
                break;
            case 'workflow':
                followups.push({ prompt: '', label: 'Check ready queue', command: 'ready' }, { prompt: '', label: 'Show agent status', command: 'status' });
                break;
            case 'status':
                followups.push({ prompt: '', label: 'Show ready queue', command: 'ready' }, { prompt: 'feature', label: 'Run a workflow', command: 'workflow' });
                break;
            case 'deps':
                followups.push({ prompt: '', label: 'Check ready queue', command: 'ready' }, { prompt: '', label: 'Show agent status', command: 'status' });
                break;
            case 'digest':
                followups.push({ prompt: '', label: 'Show ready queue', command: 'ready' }, { prompt: '', label: 'Show agent status', command: 'status' });
                break;
            default:
                // Natural language route -- suggest based on which agent was routed to
                if (meta.agentName) {
                    followups.push(...getAgentFollowups(meta.agentName));
                }
                else {
                    followups.push({ prompt: '', label: 'Show ready queue', command: 'ready' }, { prompt: '', label: 'Show agent status', command: 'status' }, { prompt: 'What workflows are available?', label: 'List workflows' });
                }
                break;
        }
        return followups;
    }
}
exports.AgentXFollowupProvider = AgentXFollowupProvider;
function getAgentFollowups(agentFile) {
    switch (agentFile) {
        case 'product-manager':
            return [
                { prompt: 'epic', label: 'Run epic workflow', command: 'workflow' },
                { prompt: 'What does the product backlog look like?', label: 'Review backlog' },
            ];
        case 'ux-designer':
            return [
                { prompt: 'feature', label: 'Run feature workflow', command: 'workflow' },
                { prompt: 'What UX deliverables exist?', label: 'Check UX artifacts' },
            ];
        case 'architect':
            return [
                { prompt: 'spike', label: 'Start a research spike', command: 'workflow' },
                { prompt: 'What architecture decisions have been made?', label: 'Review ADRs' },
            ];
        case 'engineer':
            return [
                { prompt: 'story', label: 'Run story workflow', command: 'workflow' },
                { prompt: 'bug', label: 'Run bug workflow', command: 'workflow' },
                { prompt: '', label: 'Check ready queue', command: 'ready' },
            ];
        case 'reviewer':
            return [
                { prompt: '', label: 'Show ready queue', command: 'ready' },
                { prompt: '', label: 'Check agent status', command: 'status' },
            ];
        case 'devops':
            return [
                { prompt: 'devops', label: 'Run DevOps workflow', command: 'workflow' },
                { prompt: '', label: 'Check agent status', command: 'status' },
            ];
        default:
            return [
                { prompt: '', label: 'Show ready queue', command: 'ready' },
                { prompt: '', label: 'Show agent status', command: 'status' },
            ];
    }
}
//# sourceMappingURL=followupProvider.js.map
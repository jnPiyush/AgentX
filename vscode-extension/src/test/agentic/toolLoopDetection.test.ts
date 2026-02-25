import { strict as assert } from 'assert';
import { ToolLoopDetector } from '../../agentic';

describe('ToolLoopDetector', () => {
  it('should detect repeated-call loop with warning-or-higher severity', () => {
    const detector = new ToolLoopDetector({ warningThreshold: 3, criticalThreshold: 5, circuitBreakerThreshold: 7 });

    for (let i = 0; i < 5; i++) {
      detector.record('file_read', { filePath: 'README.md' }, `ok-${i}`);
    }

    const result = detector.detect();
    assert.ok(['warning', 'critical', 'circuit_breaker'].includes(result.severity));
    assert.equal(result.detector, 'generic_repeat');
  });

  it('should detect poll-no-progress loop with tighter threshold', () => {
    const detector = new ToolLoopDetector({ warningThreshold: 6, criticalThreshold: 8, circuitBreakerThreshold: 10 });

    for (let i = 0; i < 4; i++) {
      detector.record('process_status', { pid: 123 }, 'still-running');
    }

    const result = detector.detect();
    assert.equal(result.severity, 'critical');
    assert.equal(result.detector, 'poll_no_progress');
  });
});

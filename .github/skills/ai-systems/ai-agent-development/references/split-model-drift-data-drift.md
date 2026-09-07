# split-model-drift-data-drift

> Source: [model-drift-judge-patterns.md](model-drift-judge-patterns.md)
> Source hash (LF-normalized original file): `97FC504BDF0A789795EC626C20A3B4EE4E417AF3174FD95B96CFF3C7CFB25244`
> Relocation manifest:
- `## 2. Data Drift Detection` -> original lines 82-193
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## 2. Data Drift Detection

### The Problem

Your agent is tested on sample queries during development. In production, users send:

- **Different topics** than your test set covered
- **Different languages** or formatting
- **Adversarial inputs** (jailbreak attempts, edge cases)
- **Longer/shorter inputs** than expected
- **Changed domain context** (new products, updated policies)

Over weeks, the distribution of real inputs diverges from your test data. Agent quality degrades silently.

### Decision Tree

```
Monitoring agent inputs?
+- No -> Set up input logging immediately
| +- Log: query length, topic classification, language
| +- Log: tool selection distribution
| - Log: response satisfaction signals (if available)
+- Yes -> Analyzing drift?
| +- Compare production input distribution vs test dataset
| +- Flag queries with no similar test case (novelty detection)
| +- Track topic distribution shifts week-over-week
| - Track failure rate by input category
- Drift detected?
 +- Update test dataset with representative production samples
 +- Re-run evaluation on updated dataset
 +- Adjust agent instructions if needed
 - Add guardrails for unexpected input categories
```

### Data Drift Checklist

- [ ] **Log all production inputs** - At minimum: query text, timestamp, response, latency
- [ ] **Classify inputs** - Categorize by topic/intent to track distribution
- [ ] **Sample production data weekly** - Pull random sample for manual review
- [ ] **Compare distributions** - Production inputs vs evaluation dataset
- [ ] **Track failure patterns** - Group low-quality responses by input characteristics
- [ ] **Update eval dataset quarterly** - Add new representative production queries
- [ ] **Monitor out-of-domain queries** - Detect inputs your agent wasn't designed for

### Drift Signals to Monitor

| Signal | What It Means | Action |
|--------|--------------|--------|
| Query length shifting | Users are asking differently | Update test cases |
| New topic clusters | Agent is being used for unintended purposes | Add guardrails or expand scope |
| Increasing tool call failures | Input format changed | Update tool schemas |
| Declining satisfaction scores | Overall quality degrading | Full diagnosis needed |
| Rising latency | Queries getting more complex | Optimize or add caching |
| Language mix changing | New user demographics | Add multilingual testing |

### Drift Detection Implementation

```python
"""Lightweight drift detector for agent inputs."""

import json
from collections import Counter
from datetime import datetime, timedelta

class DriftDetector:
 """Compare production input patterns against baseline."""

 def __init__(self, baseline_path: str):
 with open(baseline_path) as f:
 self.baseline = json.load(f)

 def check_length_drift(self, recent_queries: list[str]) -> dict:
 """Check if query lengths have shifted."""
 baseline_avg = self.baseline.get("avg_query_length", 100)
 current_avg = sum(len(q) for q in recent_queries) / len(recent_queries)
 drift_pct = abs(current_avg - baseline_avg) / baseline_avg * 100
 return {
 "metric": "query_length",
 "baseline": baseline_avg,
 "current": current_avg,
 "drift_percent": round(drift_pct, 1),
 "alert": drift_pct > 25, # > 25% shift = alert
 }

 def check_topic_drift(self, recent_topics: list[str]) -> dict:
 """Check if topic distribution has shifted."""
 baseline_dist = self.baseline.get("topic_distribution", {})
 current_dist = dict(Counter(recent_topics))
 # Normalize
 total = sum(current_dist.values())
 current_pct = {k: v / total for k, v in current_dist.items()}
 # Find new topics not in baseline
 new_topics = set(current_pct.keys()) - set(baseline_dist.keys())
 return {
 "metric": "topic_distribution",
 "new_topics": list(new_topics),
 "alert": len(new_topics) > 0,
 }

 def save_snapshot(self, queries: list[str], topics: list[str], path: str):
 """Save current distribution as new baseline."""
 snapshot = {
 "timestamp": datetime.now().isoformat(),
 "avg_query_length": sum(len(q) for q in queries) / len(queries),
 "query_count": len(queries),
 "topic_distribution": dict(Counter(topics)),
 }
 with open(path, "w") as f:
 json.dump(snapshot, f, indent=2)
```

---

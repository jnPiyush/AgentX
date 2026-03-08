# Data Drift Strategy - Tools and Troubleshooting

## GenAI Input Monitoring Tools

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **OpenTelemetry + AI Toolkit** | Query logging, latency, token tracking, trace viewer | Production agent input/output monitoring |
| **Azure AI Evaluation** | Input quality scoring, topic classification, relevance checks | Automated input quality assessment |
| **Embedding Analyzers (numpy/sklearn)** | Centroid drift, cluster analysis, cosine similarity trends | RAG retrieval quality monitoring |
| **Custom Topic Classifier** | Intent detection, OOD detection, topic distribution | User intent drift tracking |
| **LLM-as-Judge** | Retrieval relevance scoring, input quality grading | Query-level quality monitoring |

## Traditional ML Data Monitoring Tools

| Tool | Capabilities | When to Use |
|------|-------------|-------------|
| **Great Expectations** | Data validation, profiling, docs | Pipeline quality gates |
| **Evidently AI** | Drift reports, dashboards, monitoring | Comprehensive drift monitoring |
| **WhyLogs** | Lightweight profiling, streaming | Real-time data monitoring |
| **dbt Tests** | SQL-based data quality tests | Data warehouse pipelines |
| **Apache Spark** | Distributed data profiling | Large-scale data processing |
| **Pandera** | DataFrame schema validation | Python pipeline validation |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Query topics shifting beyond agent scope | Add topic classification, implement guardrails for OOD queries |
| RAG retrieval scores declining | Re-index knowledge base, check for stale content, evaluate chunk strategy |
| Embedding drift detected | Compare centroid shift against threshold, re-embed if significant |
| Adversarial inputs increasing | Strengthen prompt injection filters, log patterns for analysis |
| Conversation depth increasing unexpectedly | Agent may be struggling; review response quality and tool accuracy |
| Too many drift alerts | Increase thresholds or use tiered alerting; focus on critical features |
| Drift detected but model performs fine | Benign drift; update reference dataset to new distribution |
| Schema changes break pipeline | Implement schema evolution strategy with backward compatibility |
| Not enough data for statistical tests | Increase window size or use approximate methods |
| Seasonal patterns trigger false alarms | Use time-aware baselines (compare same period last year) |

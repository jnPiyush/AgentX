# Threat Model Catalog

Retained threat categories from the source skill. Calibrate likelihood and impact
to the actual system; this dated starter matrix is not a current threat assessment.

## Threat Model (Top Risks, 2026)

| Risk | Description | Likelihood | Impact |
|------|-------------|------------|--------|
| Direct prompt injection | User overrides instructions | High | High |
| **Indirect prompt injection** | Hostile content in retrieved doc, email, web page, image alt-text, OCR'd PDF | **Very High** | High |
| Jailbreak / persuasion | Multi-turn coercion to bypass policy | High | Medium |
| Data exfiltration | Tool used to leak secrets via DNS / URLs / images | Medium | Critical |
| Tool / RBAC abuse | Agent calls tools beyond user's actual permissions | Medium | Critical |
| Output harm | Toxic, biased, or illegal content | Medium | High |
| Hallucinated grounding | Fabricated citations or facts presented confidently | High | Medium |
| Model supply chain | Tampered open-weights model or fine-tune | Low | Critical |

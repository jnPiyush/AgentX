# Template Input Variables Guide

> **Purpose**: Dynamic template generation using input variables for consistency and efficiency.

## Overview

AgentX templates now support **input variables** that allow dynamic content generation. This eliminates manual search-and-replace and reduces errors when creating deliverables.

## Syntax

Input variables use `${variable_name}` syntax in template files.

```markdown
# PRD: ${epic_title}

**Epic**: #${issue_number}  
**Author**: ${author}  
**Date**: ${date}
```

## Declaring Input Variables

Templates declare their input variables in YAML frontmatter at the top of the file:

```yaml
---
inputs:
  variable_name:
    description: "User-friendly description"
    required: true|false
    default: "default value or ${special_token}"
---
```

### Special Tokens

| Token | Value | Example |
|-------|-------|---------|
| `${current_date}` | Today's date in YYYY-MM-DD format | `2026-02-03` |
| `${current_year}` | Current year | `2026` |
| `${user}` | GitHub username of current user | `jnPiyush` |

## Available Templates with Input Variables

### 1. PRD Template

**Location**: `.github/templates/PRD-TEMPLATE.md`

**Input Variables**:
```yaml
epic_title:        # Required - Title of the Epic
issue_number:      # Required - GitHub issue number
priority:          # Optional - Default: "p2"
author:            # Optional - Default: "Product Manager Agent"
date:              # Optional - Default: ${current_date}
```

**Usage Example**:
```bash
# Agent fills in automatically when creating PRD
epic_title = "User Authentication System"
issue_number = "42"
# Generates: docs/prd/PRD-42.md with title "PRD: User Authentication System"
```

### 2. ADR Template

**Location**: `.github/templates/ADR-TEMPLATE.md`

**Input Variables**:
```yaml
decision_id:       # Required - ADR sequential ID (e.g., "001")
decision_title:    # Required - Short title (e.g., "Use PostgreSQL")
issue_number:      # Required - GitHub issue number
epic_id:           # Optional - Parent Epic number
date:              # Optional - Default: ${current_date}
status:            # Optional - Default: "Accepted"
```

**Usage Example**:
```bash
decision_id = "003"
decision_title = "Implement JWT Authentication"
issue_number = "45"
epic_id = "42"
# Generates: docs/adr/ADR-003.md
```

### 3. UX Template

**Location**: `.github/templates/UX-TEMPLATE.md`

**Input Variables**:
```yaml
feature_name:      # Required - Feature being designed
issue_number:      # Required - GitHub issue number
epic_id:           # Optional - Parent Epic number
designer:          # Optional - Default: "UX Designer Agent"
date:              # Optional - Default: ${current_date}
```

### 4. Technical Spec Template

**Location**: `.github/templates/SPEC-TEMPLATE.md`

**Input Variables**:
```yaml
feature_name:      # Required - Feature name
issue_number:      # Required - GitHub issue number
epic_id:           # Optional - Parent Epic number
author:            # Optional - Default: "Solution Architect Agent"
date:              # Optional - Default: ${current_date}
```

### 5. Code Review Template

**Location**: `.github/templates/REVIEW-TEMPLATE.md`

**Input Variables**:
```yaml
story_title:       # Required - Story title
issue_number:      # Required - GitHub issue number
feature_id:        # Optional - Parent Feature number
epic_id:           # Optional - Parent Epic number
engineer:          # Required - Engineer's GitHub username
reviewer:          # Optional - Default: "Code Reviewer Agent"
commit_sha:        # Required - Full commit SHA being reviewed
date:              # Optional - Default: ${current_date}
```

## How Agents Use Input Variables

### Automatic Substitution

Agents automatically substitute variables when creating documents:

```markdown
<!-- Template -->
# PRD: ${epic_title}

<!-- Agent creates with -->
epic_title = "User Dashboard Redesign"

<!-- Result -->
# PRD: User Dashboard Redesign
```

### Handoff Buttons

Handoff buttons use input variables in prompts:

```yaml
handoffs:
  - label: "🎨 Hand off to UX"
    agent: ux-designer
    prompt: "Design user interface for issue #${issue_number}"
    send: false
```

When clicked, `${issue_number}` is replaced with the actual issue number.

### Interactive Prompting

When required variables are missing, agents prompt the user:

```
🤖 Agent: Creating PRD for Epic

Please provide the following information:
  epic_title: _______
  issue_number: _______
  priority [p2]: _______
```

## Best Practices

### 1. Always Use Variables for IDs

❌ **Don't hardcode**:
```markdown
**Epic**: #42
```

✅ **Use variables**:
```markdown
**Epic**: #${issue_number}
```

### 2. Provide Sensible Defaults

```yaml
author:
  description: "Document author"
  required: false
  default: "Product Manager Agent"  # ✅ Good default
```

### 3. Make Critical Fields Required

```yaml
issue_number:
  description: "GitHub issue number"
  required: true  # ✅ Prevents missing issue links
  default: ""
```

### 4. Use Descriptive Variable Names

❌ **Bad**:
```yaml
id1:
  description: "Some ID"
```

✅ **Good**:
```yaml
epic_id:
  description: "Parent Epic issue number"
```

### 5. Document Variable Purpose

```yaml
priority:
  description: "Priority level (p0=critical, p1=high, p2=medium, p3=low)"
  required: false
  default: "p2"
```

## Variable Naming Conventions

| Pattern | Use Case | Example |
|---------|----------|---------|
| `{entity}_id` | Identifiers | `epic_id`, `feature_id` |
| `{entity}_number` | Issue numbers | `issue_number` |
| `{entity}_title` | Titles/names | `epic_title`, `story_title` |
| `{entity}_name` | Names | `feature_name`, `author` |
| `{action}_date` | Dates | `date`, `review_date` |

## Validation

### Agent-Side Validation

Agents validate inputs before substitution:

```python
# Pseudo-code
if required and not provided:
    prompt_user_for_input()

if issue_number and not is_valid_issue(issue_number):
    error("Invalid issue number")

if date and not is_valid_date_format(date):
    error("Date must be YYYY-MM-DD format")
```

### Template Validation

Templates should validate via JSON schema (future enhancement):

```json
{
  "inputs": {
    "issue_number": {
      "type": "string",
      "pattern": "^[0-9]+$",
      "minLength": 1
    }
  }
}
```

## Troubleshooting

### Variable Not Substituted

**Problem**: `${epic_title}` appears in final document  
**Cause**: Variable not provided or not in frontmatter  
**Solution**: Add to inputs declaration and provide value

### Wrong Value Substituted

**Problem**: Wrong issue number used  
**Cause**: Variable scope confusion  
**Solution**: Use unique variable names (`epic_id` vs `issue_number`)

### Required Variable Missing

**Problem**: Agent errors on required field  
**Cause**: Variable declared required but no default  
**Solution**: Either make optional or provide default value

## Migration Guide

### Converting Existing Templates

**Before** (hardcoded placeholders):
```markdown
# PRD: {Epic Title}

**Epic**: #{epic-id}
**Author**: {Agent/Person}
**Date**: {YYYY-MM-DD}
```

**After** (input variables):
```markdown
---
inputs:
  epic_title: { required: true, default: "" }
  issue_number: { required: true, default: "" }
  author: { required: false, default: "Product Manager Agent" }
  date: { required: false, default: "${current_date}" }
---

# PRD: ${epic_title}

**Epic**: #${issue_number}
**Author**: ${author}
**Date**: ${date}
```

### Benefits

- ✅ **Consistency**: Same format every time
- ✅ **Speed**: No manual search-and-replace
- ✅ **Accuracy**: Reduces typos and missing fields
- ✅ **Automation**: Enables fully automated document generation
- ✅ **Validation**: Can enforce required fields

## Examples

### Complete PRD Generation

```yaml
# User request:
"Create PRD for issue #123: User Authentication"

# Agent extracts:
epic_title = "User Authentication"
issue_number = "123"
priority = "p0"  # from issue labels
author = "Product Manager Agent"
date = "2026-02-03"

# Generated document:
---
# PRD: User Authentication

**Epic**: #123
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-02-03
**Stakeholders**: {Names/Roles}
**Priority**: p0
---
```

### Chained Variables Across Documents

```yaml
# PRD creates Epic #123
epic_id = 123

# ADR references Epic
# ADR-001.md
**Epic**: #123
**PRD**: [PRD-123.md](../prd/PRD-123.md)

# UX references Epic
# UX-125.md
**Epic**: #123
**Related PRD**: [PRD-123.md](../prd/PRD-123.md)
```

## Future Enhancements

### Planned Features

- **Conditional Variables**: Show/hide sections based on variable values
- **Computed Variables**: Derive values from other variables
- **Variable Validation**: JSON Schema enforcement
- **Variable Suggestions**: Auto-complete from issue metadata
- **Variable History**: Remember commonly used values

### Example: Conditional Sections

```markdown
{{#if needs_ux}}
## UX Considerations
See [UX-${issue_number}.md](../ux/UX-${issue_number}.md)
{{/if}}
```

## Related Documentation

- [AGENTS.md](../../AGENTS.md#templates) - Template usage in workflows
- [Agent Definitions](.github/agents/) - How agents use variables
- [Template Directory](.github/templates/) - All available templates

---

**Version**: 1.0  
**Last Updated**: February 3, 2026  
**Status**: Stable

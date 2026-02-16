## [WARN] PR Checklist - Required Before Merge

### Issue Reference
- [ ] This PR closes #_____ (must reference a GitHub Issue)
- [ ] Issue was created **BEFORE** work began (not retroactively)
- [ ] Issue Status was updated in GitHub Projects when claimed

### Code Quality
- [ ] All tests pass locally
- [ ] Code coverage 80%
- [ ] No compiler warnings or linter errors
- [ ] XML docs added for all public APIs
- [ ] Code follows repository style guidelines

### Testing
- [ ] Unit tests added/updated (70% of coverage)
- [ ] Integration tests added/updated (20% of coverage)
- [ ] E2E tests added/updated if UI changes (10% of coverage)
- [ ] All test scenarios documented

### Security
- [ ] No secrets/credentials in code
- [ ] Input validation implemented
- [ ] SQL queries parameterized (no concatenation)
- [ ] Dependencies scanned for vulnerabilities

### Documentation
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] CHANGELOG.md updated
- [ ] Comments explain "why" not "what"

### Deployment
- [ ] Configuration changes documented
- [ ] Database migrations tested
- [ ] Rollback strategy documented
- [ ] Monitoring/alerts configured

---

## Description
<!-- Clear description of what this PR does -->

## Changes
<!-- List of specific changes made -->
- 
- 

## Testing
<!-- How was this tested? -->

## Screenshots
<!-- If UI changes, include before/after screenshots -->

## Related Documentation
<!-- Link to ADR, Tech Spec, PRD if applicable -->
- ADR: docs/adr/ADR-#.md
- Spec: docs/specs/SPEC-#.md
- PRD: docs/prd/PRD-#.md

## Deployment Notes
<!-- Anything special needed for deployment? -->

---

**By submitting this PR, I confirm:**
- This work was done after creating and claiming a GitHub Issue
- All checklist items above are complete
- I've reviewed my own code
- This PR is ready for review

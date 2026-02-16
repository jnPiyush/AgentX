# Rollback Procedure Scripts

> Load when implementing rollback procedures. See [SKILL.md](../SKILL.md) for when to rollback.

---

## Automated Rollback

```yaml
# GitHub Actions with Automated Rollback
name: Deploy with Rollback

on:
 workflow_dispatch:
 inputs:
 version:
 required: true
 type: string

jobs:
 deploy:
 runs-on: ubuntu-latest
 steps:
 - name: Deploy version
 id: deploy
 run: |
 ./deploy.sh ${{ github.event.inputs.version }}
 echo "deployed-version=${{ github.event.inputs.version }}" >> $GITHUB_OUTPUT

 - name: Health check
 id: health
 run: |
 sleep 30 # Wait for deployment
 HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)
 if [ $HEALTH -eq 200 ]; then
 echo "Health check passed"
 else
 echo "Health check failed: $HEALTH"
 exit 1
 fi

 - name: Monitor error rate
 id: monitor
 run: |
 ERROR_RATE=$(./get-error-rate.sh --duration=5m)
 BASELINE_ERROR_RATE=0.5

 if [ $(echo "$ERROR_RATE > $BASELINE_ERROR_RATE * 2" | bc) -eq 1 ]; then
 echo "Error rate too high: $ERROR_RATE% (baseline: $BASELINE_ERROR_RATE%)"
 exit 1
 fi

 - name: Rollback on failure
 if: failure()
 run: |
 echo "Rolling back to previous version"
 PREVIOUS_VERSION=$(./get-previous-version.sh)
 ./deploy.sh $PREVIOUS_VERSION

 # Verify rollback
 sleep 30
 HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)
 if [ $HEALTH -ne 200 ]; then
 echo "Rollback failed! Manual intervention required!"
 exit 1
 fi

 - name: Notify team
 if: always()
 run: |
 if [ "${{ job.status }}" = "success" ]; then
 ./notify.sh "[PASS] Deployment successful: ${{ github.event.inputs.version }}"
 else
 ./notify.sh "[FAIL] Deployment failed, rolled back to previous version"
 fi
```

---

## Manual Rollback

```bash
# Script: rollback.sh
#!/bin/bash

# Get current version
CURRENT_VERSION=$(kubectl get deployment myapp -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)

echo "Current version: $CURRENT_VERSION"

# Get previous versions from registry
echo "Available versions:"
./list-versions.sh | tail -10

# Prompt for version to rollback to
read -p "Enter version to rollback to: " ROLLBACK_VERSION

# Confirm rollback
read -p "Rollback from $CURRENT_VERSION to $ROLLBACK_VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
 echo "Rollback cancelled"
 exit 1
fi

# Perform rollback
echo "Rolling back..."
kubectl set image deployment/myapp myapp=myapp:$ROLLBACK_VERSION

# Wait for rollout
kubectl rollout status deployment/myapp --timeout=5m

# Verify health
echo "Verifying health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)

if [ $HEALTH -eq 200 ]; then
 echo "[PASS] Rollback successful"
else
 echo "[FAIL] Rollback failed! Health check returned: $HEALTH"
 exit 1
fi
```

---

## Database Rollback

```sql
-- Migration versioning (Flyway / Liquibase style)

-- V1__initial_schema.sql
CREATE TABLE users (
 id INT PRIMARY KEY,
 name VARCHAR(100),
 email VARCHAR(100)
);

-- V2__add_phone_column.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- U2__rollback_phone_column.sql (Undo script)
ALTER TABLE users DROP COLUMN phone;
```

**Rollback strategy:**
1. **Forward-only migrations**: Never delete columns, mark as deprecated
2. **Backward-compatible migrations**: Ensure new code works with old schema
3. **Blue-green with separate databases**: Rollback by switching database connection

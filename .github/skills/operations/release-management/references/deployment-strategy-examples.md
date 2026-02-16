# Deployment Strategy Implementation Examples

> Load when implementing deployment strategies. See [SKILL.md](../SKILL.md) for strategy selection guide.

---

## Blue-Green Deployment

**Concept**: Maintain two identical production environments (Blue and Green). Deploy to inactive environment, test, then switch traffic.

```yaml
# GitHub Actions with Blue-Green
name: Blue-Green Deployment

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
 - name: Determine active environment
 id: active
 run: |
 ACTIVE=$(curl -s https://example.com/active-env)
 if [ "$ACTIVE" = "blue" ]; then
 echo "inactive=green" >> $GITHUB_OUTPUT
 else
 echo "inactive=blue" >> $GITHUB_OUTPUT
 fi

 - name: Deploy to inactive environment
 run: |
 echo "Deploying to ${{ steps.active.outputs.inactive }}"
 ./deploy.sh ${{ steps.active.outputs.inactive }} ${{ github.event.inputs.version }}

 - name: Run smoke tests
 run: |
 ./smoke-tests.sh ${{ steps.active.outputs.inactive }}

 - name: Switch traffic
 run: |
 echo "Switching traffic to ${{ steps.active.outputs.inactive }}"
 ./switch-traffic.sh ${{ steps.active.outputs.inactive }}

 - name: Monitor new environment
 run: |
 ./monitor.sh ${{ steps.active.outputs.inactive }} --duration=10m

 - name: Rollback if needed
 if: failure()
 run: |
 echo "Rolling back to previous environment"
 ./switch-traffic.sh blue # Switch back
```

**Pros:**
- Zero downtime
- Instant rollback
- Full testing before switch

**Cons:**
- Requires double infrastructure
- Database migration complexity
- Cost

---

## Canary Deployment

**Concept**: Gradually roll out changes to a small subset of users, monitor, then expand to all users.

```yaml
# Kubernetes Canary Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
 name: myapp-canary
spec:
 replicas: 1 # Start with 1 replica (10% if 10 total)
 selector:
 matchLabels:
 app: myapp
 version: canary
 template:
 metadata:
 labels:
 app: myapp
 version: canary
 spec:
 containers:
 - name: myapp
 image: myapp:v2.0.0
---
apiVersion: apps/v1
kind: Deployment
metadata:
 name: myapp-stable
spec:
 replicas: 9 # 90% of traffic
 selector:
 matchLabels:
 app: myapp
 version: stable
 template:
 metadata:
 labels:
 app: myapp
 version: stable
 spec:
 containers:
 - name: myapp
 image: myapp:v1.0.0
```

**GitHub Actions Canary Pipeline:**

```yaml
name: Canary Deployment

on:
 workflow_dispatch:
 inputs:
 canary-percentage:
 required: true
 type: choice
 options:
 - '10'
 - '25'
 - '50'
 - '100'

jobs:
 deploy-canary:
 runs-on: ubuntu-latest
 steps:
 - name: Deploy canary
 run: |
 kubectl scale deployment myapp-canary --replicas=${{ github.event.inputs.canary-percentage }}

 - name: Monitor metrics
 run: |
 ./monitor-canary.sh --percentage=${{ github.event.inputs.canary-percentage }} --duration=30m

 - name: Check error rate
 run: |
 ERROR_RATE=$(./get-error-rate.sh canary)
 if [ $(echo "$ERROR_RATE > 1.0" | bc) -eq 1 ]; then
 echo "Error rate too high: $ERROR_RATE%"
 exit 1
 fi

 - name: Rollback on failure
 if: failure()
 run: |
 kubectl scale deployment myapp-canary --replicas=0
 echo "Canary rolled back due to high error rate"

 promote-canary:
 needs: deploy-canary
 runs-on: ubuntu-latest
 if: github.event.inputs.canary-percentage == '100'
 steps:
 - name: Promote canary to stable
 run: |
 kubectl set image deployment/myapp-stable myapp=myapp:v2.0.0
 kubectl scale deployment myapp-canary --replicas=0
```

**Pros:**
- Low risk
- Real user feedback
- Gradual rollout

**Cons:**
- Complex to implement
- Longer deployment time
- Requires monitoring infrastructure

---

## Rolling Deployment

**Concept**: Gradually replace instances one at a time.

```yaml
# Kubernetes Rolling Update
apiVersion: apps/v1
kind: Deployment
metadata:
 name: myapp
spec:
 replicas: 10
 strategy:
 type: RollingUpdate
 rollingUpdate:
 maxSurge: 2 # Max 2 extra pods during update
 maxUnavailable: 1 # Max 1 pod unavailable during update
 selector:
 matchLabels:
 app: myapp
 template:
 metadata:
 labels:
 app: myapp
 spec:
 containers:
 - name: myapp
 image: myapp:v2.0.0
 readinessProbe:
 httpGet:
 path: /health
 port: 8080
 initialDelaySeconds: 10
 periodSeconds: 5
 livenessProbe:
 httpGet:
 path: /health
 port: 8080
 initialDelaySeconds: 15
 periodSeconds: 10
```

**Pros:**
- Built-in to most orchestrators
- Automatic rollback on failure
- Zero downtime

**Cons:**
- Mixed versions during deployment
- Slower than blue-green

---

## Feature Flags / Feature Toggles

**Concept**: Deploy code with features disabled, enable gradually via configuration.

```yaml
# GitHub Actions with Feature Flags
name: Deploy with Feature Flags

on:
 push:
 branches: [ main ]

jobs:
 deploy:
 runs-on: ubuntu-latest
 steps:
 - name: Deploy application
 run: |
 ./deploy.sh production

 - name: Configure feature flags
 run: |
 # Enable new feature for 10% of users
 ./feature-flag.sh --feature=new-checkout --percentage=10 --env=production

 - name: Monitor metrics
 run: |
 ./monitor.sh --feature=new-checkout --duration=1h

 - name: Increase rollout
 if: success()
 run: |
 ./feature-flag.sh --feature=new-checkout --percentage=50 --env=production
```

**Implementation Example:**

```csharp
// .NET with feature flags
public class FeatureFlagService
{
 private readonly IConfiguration _config;

 public FeatureFlagService(IConfiguration config)
 {
 _config = config;
 }

 public bool IsEnabled(string feature, string userId = null)
 {
 var percentage = _config.GetValue<int>($"FeatureFlags:{feature}:Percentage");

 if (percentage == 100) return true;
 if (percentage == 0) return false;

 if (userId != null)
 {
 var hash = GetConsistentHash(userId);
 return hash % 100 < percentage;
 }

 return false;
 }

 private int GetConsistentHash(string input)
 {
 using var md5 = MD5.Create();
 var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(input));
 return BitConverter.ToInt32(hash, 0);
 }
}
```

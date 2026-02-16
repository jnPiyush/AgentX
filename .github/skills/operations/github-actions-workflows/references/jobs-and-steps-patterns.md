# Jobs & Steps Patterns

> Load when configuring job dependencies and conditional execution. See [SKILL.md](../SKILL.md) for concepts.

---

## Job Dependencies

```yaml
jobs:
 build:
 runs-on: ubuntu-latest
 steps:
 - run: echo "Building..."

 test:
 needs: build # Wait for build
 runs-on: ubuntu-latest
 steps:
 - run: echo "Testing..."

 deploy-staging:
 needs: test
 runs-on: ubuntu-latest
 steps:
 - run: echo "Deploying to staging..."

 deploy-prod:
 needs: [test, deploy-staging] # Multiple dependencies
 runs-on: ubuntu-latest
 steps:
 - run: echo "Deploying to production..."
```

## Conditional Jobs

```yaml
jobs:
 build:
 runs-on: ubuntu-latest
 steps:
 - run: echo "Always runs"

 deploy-dev:
 if: github.ref == 'refs/heads/develop'
 runs-on: ubuntu-latest
 steps:
 - run: echo "Deploy to dev"

 deploy-prod:
 if: github.ref == 'refs/heads/main' && github.event_name == 'push'
 runs-on: ubuntu-latest
 steps:
 - run: echo "Deploy to prod"

 manual-step:
 if: github.event_name == 'workflow_dispatch'
 runs-on: ubuntu-latest
 steps:
 - run: echo "Manual trigger"
```

## Conditional Steps

```yaml
steps:
 - name: Checkout
 uses: actions/checkout@v4

 - name: Run on main branch only
 if: github.ref == 'refs/heads/main'
 run: echo "Main branch"

 - name: Run on PR only
 if: github.event_name == 'pull_request'
 run: echo "Pull request"

 - name: Run on success
 if: success()
 run: echo "Previous steps succeeded"

 - name: Run on failure
 if: failure()
 run: echo "Previous steps failed"

 - name: Always run
 if: always()
 run: echo "Runs regardless of status"

 - name: Run on cancelled
 if: cancelled()
 run: echo "Workflow was cancelled"
```

## Runner Selection

```yaml
jobs:
 linux:
 runs-on: ubuntu-latest
 steps:
 - run: echo "Linux"

 windows:
 runs-on: windows-latest
 steps:
 - run: echo "Windows"

 macos:
 runs-on: macos-latest
 steps:
 - run: echo "macOS"

 self-hosted:
 runs-on: [self-hosted, linux, x64, gpu]
 steps:
 - run: echo "Self-hosted runner"

 specific-version:
 runs-on: ubuntu-22.04 # Specific version
 steps:
 - run: echo "Ubuntu 22.04"
```

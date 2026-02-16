# Secrets, Variables & Matrix Builds Reference

> Load when configuring secrets, variables, or matrix builds. See [SKILL.md](../SKILL.md) for concepts.

---

## Secrets and Variables

### Using Secrets

```yaml
steps:
 - name: Use secret
 run: echo "Secret value is hidden"
 env:
 API_KEY: ${{ secrets.API_KEY }}
 DATABASE_URL: ${{ secrets.DATABASE_URL }}

 - name: Use in action
 uses: azure/login@v1
 with:
 creds: ${{ secrets.AZURE_CREDENTIALS }}
```

### Environment Variables

```yaml
# Global
env:
 GLOBAL_VAR: 'global value'

jobs:
 build:
 # Job-level
 env:
 JOB_VAR: 'job value'

 steps:
 # Step-level
 - name: Use variables
 env:
 STEP_VAR: 'step value'
 run: |
 echo "Global: $GLOBAL_VAR"
 echo "Job: $JOB_VAR"
 echo "Step: $STEP_VAR"

 # GitHub context variables
 - name: GitHub variables
 run: |
 echo "Repository: ${{ github.repository }}"
 echo "Ref: ${{ github.ref }}"
 echo "SHA: ${{ github.sha }}"
 echo "Actor: ${{ github.actor }}"
 echo "Event: ${{ github.event_name }}"
```

### Configuration Variables

```yaml
# Repository/Organization/Environment variables
steps:
 - name: Use config variables
 run: |
 echo "Config: ${{ vars.ENVIRONMENT_NAME }}"
 echo "URL: ${{ vars.API_URL }}"
```

---

## Matrix Builds

### Basic Matrix

```yaml
jobs:
 build:
 runs-on: ${{ matrix.os }}
 strategy:
 matrix:
 os: [ubuntu-latest, windows-latest, macos-latest]
 node-version: [18, 20, 22]

 steps:
 - uses: actions/checkout@v4
 - name: Setup Node.js ${{ matrix.node-version }}
 uses: actions/setup-node@v4
 with:
 node-version: ${{ matrix.node-version }}
 - run: npm test
```

### Matrix with Exclusions

```yaml
strategy:
 matrix:
 os: [ubuntu-latest, windows-latest]
 node-version: [18, 20, 22]
 exclude:
 - os: windows-latest
 node-version: 18

 include:
 - os: ubuntu-latest
 node-version: 22
 extra-flag: '--experimental'
```

### Fail-Fast and Max-Parallel

```yaml
strategy:
 fail-fast: false # Continue other jobs if one fails
 max-parallel: 3 # Run max 3 jobs concurrently
 matrix:
 os: [ubuntu-latest, windows-latest, macos-latest]
 node-version: [18, 20, 22]
```

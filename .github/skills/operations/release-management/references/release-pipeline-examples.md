# Release Pipeline Examples

> Load when implementing release pipelines. See [SKILL.md](../SKILL.md) for concepts.

---

## Basic Release Pipeline

```yaml
# .github/workflows/release.yml
name: Release Pipeline

on:
 push:
 tags:
 - 'v*.*.*'

jobs:
 validate:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: Validate version
 run: |
 TAG=${GITHUB_REF#refs/tags/}
 echo "Releasing version: $TAG"

 build:
 needs: validate
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: Build artifacts
 run: |
 npm ci
 npm run build
 - name: Upload artifacts
 uses: actions/upload-artifact@v4
 with:
 name: release-artifacts
 path: dist/

 test:
 needs: build
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: Download artifacts
 uses: actions/download-artifact@v4
 with:
 name: release-artifacts
 - name: Run tests
 run: npm test

 create-release:
 needs: test
 runs-on: ubuntu-latest
 permissions:
 contents: write
 steps:
 - uses: actions/checkout@v4
 with:
 fetch-depth: 0

 - name: Generate changelog
 id: changelog
 run: |
 PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
 if [ -z "$PREVIOUS_TAG" ]; then
 CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges)
 else
 CHANGELOG=$(git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --no-merges)
 fi
 echo "$CHANGELOG" > CHANGELOG.md
 echo "changelog<<EOF" >> $GITHUB_OUTPUT
 echo "$CHANGELOG" >> $GITHUB_OUTPUT
 echo "EOF" >> $GITHUB_OUTPUT

 - name: Create GitHub Release
 uses: softprops/action-gh-release@v1
 with:
 tag_name: ${{ github.ref_name }}
 name: Release ${{ github.ref_name }}
 body: ${{ steps.changelog.outputs.changelog }}
 draft: false
 prerelease: ${{ contains(github.ref_name, '-alpha') || contains(github.ref_name, '-beta') }}
 env:
 GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

 - name: Download artifacts
 uses: actions/download-artifact@v4
 with:
 name: release-artifacts
 path: ./release

 - name: Upload release assets
 uses: softprops/action-gh-release@v1
 with:
 files: ./release/**
 env:
 GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

 deploy-production:
 needs: create-release
 runs-on: ubuntu-latest
 environment:
 name: production
 url: https://app.example.com
 steps:
 - name: Download artifacts
 uses: actions/download-artifact@v4
 with:
 name: release-artifacts

 - name: Deploy to production
 run: |
 echo "Deploying version ${{ github.ref_name }} to production"
 # Deployment commands here

 - name: Notify team
 if: success()
 run: |
 echo "Release ${{ github.ref_name }} deployed successfully"
 # Send notification (Slack, Teams, email)
```

## Multi-Environment Release Pipeline

```yaml
# Azure Pipelines
trigger:
 tags:
 include:
 - v*.*.*

stages:
- stage: Build
 jobs:
 - job: BuildJob
 steps:
 - script: dotnet build -c Release
 - script: dotnet publish -c Release -o $(Build.ArtifactStagingDirectory)
 - publish: $(Build.ArtifactStagingDirectory)

- stage: DeployStaging
 dependsOn: Build
 jobs:
 - deployment: DeployStaging
 environment: staging
 strategy:
 runOnce:
 deploy:
 steps:
 - download: current
 artifact: drop
 - task: AzureWebApp@1
 inputs:
 azureSubscription: 'Azure-Staging'
 appName: 'myapp-staging'

- stage: SmokeTests
 dependsOn: DeployStaging
 jobs:
 - job: SmokeTestsJob
 steps:
 - script: |
 curl -f https://staging.example.com/health || exit 1
 npm run test:smoke -- --env=staging

- stage: DeployProduction
 dependsOn: SmokeTests
 jobs:
 - deployment: DeployProduction
 environment: production
 strategy:
 runOnce:
 deploy:
 steps:
 - download: current
 artifact: drop
 - task: AzureWebApp@1
 inputs:
 azureSubscription: 'Azure-Production'
 appName: 'myapp-production'

- stage: PostDeployment
 dependsOn: DeployProduction
 jobs:
 - job: VerificationJob
 steps:
 - script: |
 curl -f https://app.example.com/health || exit 1
 npm run test:smoke -- --env=production
 - script: echo "Notifying stakeholders..."
```

# CI/CD Integration, Maintenance & Advanced Git Operations

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/ci.yml
name: CI

on:
 push:
 branches: [ main, develop ]
 pull_request:
 branches: [ main ]

jobs:
 build:
 runs-on: ubuntu-latest
 
 steps:
 - uses: actions/checkout@v3
 with:
 fetch-depth: 0 # Full history for versioning
 
 - name: Setup .NET
 uses: actions/setup-dotnet@v3
 with:
 dotnet-version: 8.0.x
 
 - name: Restore dependencies
 run: dotnet restore
 
 - name: Build
 run: dotnet build --no-restore
 
 - name: Test
 run: dotnet test --no-build --verbosity normal
 
 - name: Publish
 run: dotnet publish -c Release -o ./publish
```

### Azure Pipelines Example

```yaml
# azure-pipelines.yml
trigger:
- main
- develop

pool:
 vmImage: 'ubuntu-latest'

variables:
 buildConfiguration: 'Release'

steps:
- task: UseDotNet@2
 inputs:
 version: '8.0.x'

- task: DotNetCoreCLI@2
 displayName: 'Restore'
 inputs:
 command: 'restore'

- task: DotNetCoreCLI@2
 displayName: 'Build'
 inputs:
 command: 'build'
 arguments: '--configuration $(buildConfiguration)'

- task: DotNetCoreCLI@2
 displayName: 'Test'
 inputs:
 command: 'test'
 arguments: '--configuration $(buildConfiguration) --collect:"XPlat Code Coverage"'

- task: PublishCodeCoverageResults@1
 inputs:
 codeCoverageTool: 'Cobertura'
 summaryFileLocation: '$(Agent.TempDirectory)/**/coverage.cobertura.xml'
```

---

## Repository Maintenance

### Cleaning Up

```bash
# Remove untracked files
git clean -fd

# Clean up local branches that are merged
git branch --merged main | grep -v "^\* main" | xargs -n 1 git branch -d

# Garbage collection
git gc --aggressive --prune=now

# Verify repository integrity
git fsck --full

# Reduce repository size
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Repository Statistics

```bash
# View repository size
git count-objects -vH

# Find large files
git rev-list --objects --all |
 git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
 sed -n 's/^blob //p' |
 sort --numeric-sort --key=2 |
 tail -n 10

# Show commit activity
git shortlog -s -n --all

# View repository history size
git log --all --pretty=format:'%h %ad %s' --date=short | wc -l
```

---

## Security Best Practices

### Protecting Sensitive Data

```bash
# Never commit sensitive files
# Add to .gitignore:
appsettings.Development.json
appsettings.Local.json
*.secrets.json
.env
.env.local
*.key
*.pem
*.pfx

# Remove accidentally committed secrets
git filter-branch --force --index-filter \
 "git rm --cached --ignore-unmatch secrets.json" \
 --prune-empty --tag-name-filter cat -- --all

# Or use BFG Repo-Cleaner (faster)
bfg --delete-files secrets.json
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Rotate compromised credentials immediately!
```

### Signed Commits

```bash
# Generate GPG key
gpg --full-generate-key

# List GPG keys
gpg --list-secret-keys --keyid-format=long

# Configure Git to use GPG key
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# Sign commits
git commit -S -m "feat: Add feature"

# Verify signed commits
git log --show-signature

# Add GPG key to GitHub/GitLab
gpg --armor --export YOUR_KEY_ID
# Paste in Settings -> SSH and GPG keys
```

---

## Multi-Remote Workflows

### Maintaining Multiple Remotes

```bash
# Setup
git remote add origin https://github.com/yourfork/repo.git
git remote add upstream https://github.com/original/repo.git
git remote add backup git@gitlab.com:user/repo.git

# Fetch from all remotes
git fetch --all

# Push to multiple remotes
git push origin main
git push backup main

# Configure push to multiple remotes automatically
git remote set-url --add --push origin git@github.com:yourfork/repo.git
git remote set-url --add --push origin git@gitlab.com:user/repo.git
git push origin main # Pushes to both
```

---

## Platform-Specific Features

### GitHub

```bash
# Create repository from CLI (requires GitHub CLI)
gh repo create my-project --public

# Create pull request
gh pr create --title "Add feature" --body "Description"

# View pull requests
gh pr list

# Checkout PR locally
gh pr checkout 123

# Clone with GitHub CLI
gh repo clone username/repo
```

### Azure DevOps

```bash
# Clone using Azure DevOps URL
git clone https://dev.azure.com/organization/project/_git/repo

# Using SSH
git clone git@ssh.dev.azure.com:v3/organization/project/repo

# Work with work items
git commit -m "feat: Add login #123" # Links to work item 123
```

### GitLab

```bash
# Clone with GitLab token
git clone https://oauth2:YOUR_TOKEN@gitlab.com/user/repo.git

# Push options for merge requests
git push -o merge_request.create \
 -o merge_request.target=main \
 -o merge_request.title="Add feature"
```

---

## Performance Optimization

```bash
# Shallow clone for faster downloads
git clone --depth 1 --single-branch --branch main https://github.com/user/repo.git

# Partial clone (Git 2.19+)
git clone --filter=blob:none https://github.com/user/repo.git

# Sparse checkout (only specific folders)
git clone --no-checkout https://github.com/user/repo.git
cd repo
git sparse-checkout init --cone
git sparse-checkout set src/ docs/
git checkout main

# Parallel fetch
git config --global fetch.parallel 8

# Use protocol v2 (faster)
git config --global protocol.version 2
```

---

---
name: remote-git-operations
description: 'Best practices for remote Git operations including GitHub, Azure DevOps, pull requests, CI/CD integration, and branch protection rules.'
---

# Remote Git Repository Operations

> **Purpose**: Best practices for working with remote Git repositories, including GitHub, Azure DevOps, GitLab, and Bitbucket.

---

## Remote Repository Setup

### Adding and Managing Remotes

```bash
# View existing remotes
git remote -v

# Add a new remote
git remote add origin https://github.com/username/repo.git
git remote add upstream https://github.com/original/repo.git

# Change remote URL
git remote set-url origin https://github.com/username/new-repo.git

# Remove a remote
git remote remove upstream

# Rename a remote
git remote rename origin main-repo

# Fetch remote information
git remote show origin
```

### Clone Strategies

```bash
# Standard clone
git clone https://github.com/username/repo.git

# Clone with different folder name
git clone https://github.com/username/repo.git my-project

# Clone specific branch
git clone -b develop https://github.com/username/repo.git

# Shallow clone (faster, less history)
git clone --depth 1 https://github.com/username/repo.git

# Clone with submodules
git clone --recursive https://github.com/username/repo.git

# Clone using SSH
git clone git@github.com:username/repo.git
```

---

## Authentication Methods

### HTTPS Authentication

```bash
# Using Git Credential Manager (recommended for Windows)
git config --global credential.helper manager-core

# Cache credentials for 1 hour
git config --global credential.helper 'cache --timeout=3600'

# Store credentials (less secure)
git config --global credential.helper store

# Using Personal Access Token (GitHub)
# 1. Generate PAT: GitHub → Settings → Developer settings → Personal access tokens
# 2. Use as password when prompted:
#    Username: your-github-username
#    Password: ghp_xxxxxxxxxxxxxxxxxxxx
```

### SSH Authentication (Recommended)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Start SSH agent (Windows Git Bash)
eval "$(ssh-agent -s)"

# Add SSH key to agent
ssh-add ~/.ssh/id_ed25519

# Copy public key (Windows)
clip < ~/.ssh/id_ed25519.pub

# Add to GitHub/Azure DevOps/GitLab
# GitHub: Settings → SSH and GPG keys → New SSH key

# Test connection
ssh -T git@github.com
ssh -T git@ssh.dev.azure.com

# Use SSH URLs
git remote set-url origin git@github.com:username/repo.git
```

### Azure DevOps Authentication

```bash
# Using Personal Access Token (PAT)
# 1. Azure DevOps → User Settings → Personal Access Tokens
# 2. Create token with Code (Read & Write) scope
# 3. Use as password when prompted

# Using Azure CLI authentication
az login
git config --global credential.helper "!az account get-access-token --query accessToken -o tsv"

# Using SSH (recommended)
# 1. Generate key: ssh-keygen -t rsa -b 4096
# 2. Add to Azure DevOps: User Settings → SSH Public Keys
```

---

## Fetching and Pulling

### Fetch Updates

```bash
# Fetch from origin
git fetch origin

# Fetch all remotes
git fetch --all

# Fetch and prune deleted remote branches
git fetch origin --prune

# Fetch specific branch
git fetch origin main:main

# View fetched changes
git log HEAD..origin/main
git diff HEAD origin/main
```

### Pull Changes

```bash
# Pull with merge (default)
git pull origin main

# Pull with rebase (recommended for cleaner history)
git pull --rebase origin main

# Pull with force (use cautiously)
git pull --force origin main

# Set default pull strategy
git config --global pull.rebase true

# Pull all branches
git pull --all
```

---

## Pushing Changes

### Basic Push Operations

```bash
# Push to origin main
git push origin main

# Push and set upstream tracking
git push -u origin feature-branch

# Push all branches
git push --all origin

# Push tags
git push origin --tags
git push origin v1.0.0

# Delete remote branch
git push origin --delete feature-branch
git push origin :feature-branch  # Alternative syntax

# Force push (use with extreme caution!)
git push --force origin main

# Force push with lease (safer, checks for conflicts)
git push --force-with-lease origin feature-branch
```

### Push Best Practices

```bash
# Always check status before pushing
git status
git log origin/main..HEAD

# Run tests before pushing
dotnet test
npm test

# Ensure you're on the right branch
git branch --show-current

# Use force-with-lease instead of force
git push --force-with-lease origin feature-branch

# Push only if tests pass (git hook)
# Create .git/hooks/pre-push
#!/bin/sh
dotnet test --no-build
exit $?
```

---

## Branch Management

### Creating and Managing Remote Branches

```bash
# Create local branch and push
git checkout -b feature/new-feature
git push -u origin feature/new-feature

# Track remote branch
git checkout --track origin/feature-branch
git checkout feature-branch  # Simplified

# List remote branches
git branch -r
git branch -a  # All branches (local + remote)

# Delete remote branch
git push origin --delete old-feature

# Prune deleted remote branches locally
git fetch --prune
git remote prune origin
```

### Syncing Fork with Upstream

```bash
# Add upstream remote
git remote add upstream https://github.com/original/repo.git

# Fetch upstream changes
git fetch upstream

# Merge upstream changes
git checkout main
git merge upstream/main

# Push to your fork
git push origin main

# Alternative: Rebase instead of merge
git rebase upstream/main
git push --force-with-lease origin main
```

---

## Pull Requests and Code Review

### Preparing Pull Requests

```bash
# Create feature branch
git checkout -b feature/add-user-auth

# Make changes and commit
git add .
git commit -m "feat(auth): Add user authentication"

# Push to remote
git push -u origin feature/add-user-auth

# Keep PR branch updated with main
git fetch origin
git rebase origin/main
git push --force-with-lease origin feature/add-user-auth

# Squash commits before PR (interactive rebase)
git rebase -i HEAD~3
git push --force-with-lease origin feature/add-user-auth
```

### Addressing PR Feedback

```bash
# Make requested changes
git add .
git commit -m "fix: Address PR feedback - update validation"

# Or amend last commit
git add .
git commit --amend --no-edit
git push --force-with-lease origin feature/add-user-auth

# Squash all commits in PR
git rebase -i origin/main
# In editor: pick first commit, squash rest
git push --force-with-lease origin feature/add-user-auth
```

---

## Conflict Resolution with Remote

### Handling Merge Conflicts

```bash
# Pull latest changes
git pull origin main
# If conflicts occur:

# 1. View conflicting files
git status

# 2. Resolve conflicts in editor
# Remove conflict markers: <<<<<<<, =======, >>>>>>>

# 3. Mark as resolved
git add conflicted-file.cs

# 4. Complete merge
git commit -m "Merge: Resolve conflicts with main"

# 5. Push
git push origin feature-branch
```

### Rebase Conflicts

```bash
# Start rebase
git rebase origin/main

# If conflicts occur:
# 1. Resolve conflicts
# 2. Stage resolved files
git add .

# 3. Continue rebase
git rebase --continue

# Or abort rebase
git rebase --abort

# Push after successful rebase
git push --force-with-lease origin feature-branch
```

---

## Working with Large Files (Git LFS)

```bash
# Install Git LFS
git lfs install

# Track large file types
git lfs track "*.psd"
git lfs track "*.mp4"
git lfs track "*.zip"

# Commit .gitattributes
git add .gitattributes
git commit -m "Add Git LFS tracking"

# Add large file
git add large-file.zip
git commit -m "Add large binary file"
git push origin main

# Clone repository with LFS files
git clone https://github.com/username/repo.git
cd repo
git lfs pull

# Fetch LFS files for specific commit
git lfs fetch origin main
git lfs checkout
```

---

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
        fetch-depth: 0  # Full history for versioning
    
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
# Paste in Settings → SSH and GPG keys
```

---

## Troubleshooting Common Issues

### "Your branch is ahead/behind origin"

```bash
# View differences
git log origin/main..HEAD  # Commits you have but remote doesn't
git log HEAD..origin/main  # Commits remote has but you don't

# Sync with remote
git pull --rebase origin main
git push origin main
```

### "Failed to push: rejected"

```bash
# Fetch latest changes first
git fetch origin

# Option 1: Merge (creates merge commit)
git merge origin/main
git push origin main

# Option 2: Rebase (cleaner history)
git rebase origin/main
git push origin main

# Option 3: Force push (dangerous!)
git push --force-with-lease origin main
```

### "Authentication failed"

```bash
# Update credentials
git credential reject
git pull  # Will prompt for new credentials

# Use SSH instead of HTTPS
git remote set-url origin git@github.com:username/repo.git

# Check credential helper
git config --global credential.helper
```

### Large Push Failures

```bash
# Increase buffer size
git config --global http.postBuffer 524288000  # 500MB

# Use SSH instead of HTTPS (more reliable)
git remote set-url origin git@github.com:username/repo.git

# Push in smaller chunks
git push origin main~10:main
git push origin main~5:main
git push origin main
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
git push origin main  # Pushes to both
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
git commit -m "feat: Add login #123"  # Links to work item 123
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

## Best Practices Summary

### ✅ DO
- Use SSH authentication for security
- Fetch before pushing
- Use `--force-with-lease` instead of `--force`
- Keep commits small and focused
- Write clear commit messages
- Pull with rebase for cleaner history
- Protect main branch with branch policies
- Sign commits for verification
- Use Git LFS for large binary files
- Run tests before pushing

### ❌ DON'T
- Commit sensitive data (keys, passwords)
- Force push to shared branches
- Push untested code
- Rewrite public history
- Use ambiguous commit messages
- Commit large binary files without LFS
- Push directly to main (use PRs)
- Leave merge conflicts unresolved
- Ignore .gitignore patterns

---

**Related Skills**:
- [Version Control](12-version-control.md)
- [Security](04-security.md)
- [Code Organization](08-code-organization.md)

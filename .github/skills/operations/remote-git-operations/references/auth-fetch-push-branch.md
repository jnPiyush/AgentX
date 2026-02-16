# Git Authentication, Fetch, Push & Branch Management

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
# 1. Generate PAT: GitHub -> Settings -> Developer settings -> Personal access tokens
# 2. Use as password when prompted:
# Username: your-github-username
# Password: ghp_xxxxxxxxxxxxxxxxxxxx
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
# GitHub: Settings -> SSH and GPG keys -> New SSH key

# Test connection
ssh -T git@github.com
ssh -T git@ssh.dev.azure.com

# Use SSH URLs
git remote set-url origin git@github.com:username/repo.git
```

### Azure DevOps Authentication

```bash
# Using Personal Access Token (PAT)
# 1. Azure DevOps -> User Settings -> Personal Access Tokens
# 2. Create token with Code (Read & Write) scope
# 3. Use as password when prompted

# Using Azure CLI authentication
az login
git config --global credential.helper "!az account get-access-token --query accessToken -o tsv"

# Using SSH (recommended)
# 1. Generate key: ssh-keygen -t rsa -b 4096
# 2. Add to Azure DevOps: User Settings -> SSH Public Keys
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
git push origin :feature-branch # Alternative syntax

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
git checkout feature-branch # Simplified

# List remote branches
git branch -r
git branch -a # All branches (local + remote)

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

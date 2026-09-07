# remote-git-operations: Decision Tree, Remote Repository Setup

> MUST read before work involving **decision tree, remote repository setup**. This reference preserves complete source guidance relocated for context-budget compliance.

## Decision Tree

```
What remote Git operation?
+-- Setting up authentication?
|   +-- Personal machine? -> SSH key
|   +-- CI/CD pipeline? -> Deploy key or app token
|   +-- Temporary access? -> HTTPS + credential helper
+-- Collaborating on code?
|   +-- Small team, single remote? -> Feature branch + PR
|   +-- Fork-based (open source)? -> Fork + upstream remote + PR
|   +-- Multiple remotes? -> Named remotes (origin, upstream)
+-- Syncing with remote?
|   +-- Linear history preferred? -> git pull --rebase
|   +-- Merge commits acceptable? -> git pull (merge)
|   +-- CI branch behind? -> git fetch + git rebase origin/main
+-- Handling large files?
|   +-- Binary assets (images, models, videos)? -> Git LFS
|   +-- Large repo history? -> Shallow clone (--depth 1)
```

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

## References

- [Auth Fetch Push Branch](auth-fetch-push-branch.md)
- [Pr Conflicts Lfs](pr-conflicts-lfs.md)
- [Cicd Maintenance Advanced](cicd-maintenance-advanced.md)
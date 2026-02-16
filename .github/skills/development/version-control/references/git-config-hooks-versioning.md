# Git Configuration, Hooks & Semantic Versioning

## .gitignore for C#

```gitignore
# Build results
[Dd]ebug/
[Dd]ebugPublic/
[Rr]elease/
[Rr]eleases/
x64/
x86/
[Aa]rm/
[Aa]rm64/
bld/
[Bb]in/
[Oo]bj/
[Ll]og/
[Ll]ogs/

# Visual Studio
.vs/
*.suo
*.user
*.userosscache
*.sln.docstates
*.userprefs

# ReSharper
_ReSharper*/
*.[Rr]e[Ss]harper
*.DotSettings.user

# NuGet
*.nupkg
*.snupkg
**/packages/*
!**/packages/build/
project.lock.json
project.fragment.lock.json
artifacts/

# Test results
[Tt]est[Rr]esult*/
[Bb]uild[Ll]og.*
*.trx
*.coverage
*.coveragexml

# ASP.NET Scaffolding
ScaffoldingReadMe.txt

# .NET Core
appsettings.Development.json
appsettings.Local.json
*.user.json

# User secrets
secrets.json

# Environment files
.env
.env.local
.env.*.local

# IDEs
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
Desktop.ini

# Azure
*.pubxml
*.azurePubxml
publish/

# Database
*.mdf
*.ldf
*.ndf

# Local History
.localhistory/

# Rider
.idea/
*.sln.iml
```

---

## Git Hooks for C#

### pre-commit hook (format checking)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Format C# files before commit

echo "Running dotnet format..."
dotnet format --verify-no-changes

if [ $? -ne 0 ]; then
 echo "Code formatting issues detected. Run 'dotnet format' to fix."
 exit 1
fi

echo "Running tests..."
dotnet test --no-build --verbosity quiet

if [ $? -ne 0 ]; then
 echo "Tests failed. Commit aborted."
 exit 1
fi

exit 0
```

### commit-msg hook (validate commit messages)

Create `.git/hooks/commit-msg`:

```bash
#!/bin/sh
# Validate commit message format

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Check if commit message matches conventional commits format
pattern="^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .{1,50}"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
 echo "ERROR: Commit message does not follow conventional commits format"
 echo "Expected: type(scope): description"
 echo "Example: feat(auth): Add login endpoint"
 exit 1
fi

exit 0
```

---

## Git Configuration for C#

```bash
# User configuration
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Editor
git config --global core.editor "code --wait"

# Line endings (Windows)
git config --global core.autocrlf true

# Aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'

# Diff tool
git config --global diff.tool vscode
git config --global difftool.vscode.cmd 'code --wait --diff $LOCAL $REMOTE'

# Merge tool
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
```

---

## Semantic Versioning with Git Tags

```bash
# Format: MAJOR.MINOR.PATCH
# MAJOR: Breaking changes
# MINOR: New features (backward compatible)
# PATCH: Bug fixes

# Create annotated tag
git tag -a v1.2.3 -m "Release version 1.2.3"

# Push tags
git push origin v1.2.3
# Or push all tags
git push origin --tags

# List tags
git tag -l

# View tag details
git show v1.2.3

# Delete tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Checkout specific version
git checkout tags/v1.2.3 -b version-1.2.3
```

---

**Related Skills**:
- [Code Organization](../../architecture/code-organization/SKILL.md)
- [Documentation](../documentation/SKILL.md)

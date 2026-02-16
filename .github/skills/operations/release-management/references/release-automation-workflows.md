# Release Automation Workflows

> Load when setting up release automation. See [SKILL.md](../SKILL.md) for automation concepts.

---

## Automated Version Bumping

```yaml
# .github/workflows/version-bump.yml
name: Version Bump

on:
 push:
 branches: [ main ]

jobs:
 bump-version:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 with:
 fetch-depth: 0
 token: ${{ secrets.PAT_TOKEN }} # Personal Access Token for pushing

 - name: Determine version bump
 id: bump
 run: |
 # Check commit messages for conventional commits
 if git log -1 --pretty=%B | grep -q "BREAKING CHANGE"; then
 echo "bump=major" >> $GITHUB_OUTPUT
 elif git log -1 --pretty=%B | grep -q "^feat"; then
 echo "bump=minor" >> $GITHUB_OUTPUT
 else
 echo "bump=patch" >> $GITHUB_OUTPUT
 fi

 - name: Bump version
 run: |
 npm version ${{ steps.bump.outputs.bump }} --no-git-tag-version

 - name: Commit version bump
 run: |
 NEW_VERSION=$(node -p "require('./package.json').version")
 git config user.name "github-actions[bot]"
 git config user.email "github-actions[bot]@users.noreply.github.com"
 git add package.json
 git commit -m "chore: bump version to $NEW_VERSION"
 git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"
 git push origin main --tags
```

---

## Automated Changelog Generation

```yaml
# .github/workflows/changelog.yml
name: Generate Changelog

on:
 push:
 tags:
 - 'v*'

jobs:
 changelog:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 with:
 fetch-depth: 0

 - name: Generate changelog
 run: |
 PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || git rev-list --max-parents=0 HEAD)

 echo "# Changelog for ${{ github.ref_name }}" > CHANGELOG.md
 echo "" >> CHANGELOG.md
 echo "## Features" >> CHANGELOG.md
 git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^feat" >> CHANGELOG.md
 echo "" >> CHANGELOG.md
 echo "## Bug Fixes" >> CHANGELOG.md
 git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^fix" >> CHANGELOG.md
 echo "" >> CHANGELOG.md
 echo "## Other Changes" >> CHANGELOG.md
 git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^chore\\|^docs" >> CHANGELOG.md

 - name: Commit changelog
 run: |
 git config user.name "github-actions[bot]"
 git config user.email "github-actions[bot]@users.noreply.github.com"
 git add CHANGELOG.md
 git commit -m "docs: update changelog for ${{ github.ref_name }}"
 git push
```

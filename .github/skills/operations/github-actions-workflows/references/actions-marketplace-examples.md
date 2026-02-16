# Actions Marketplace Examples

> Load when using specific marketplace actions. See [SKILL.md](../SKILL.md) for action overview.

---

## Essential Actions

### Checkout Code

```yaml
- name: Checkout code
 uses: actions/checkout@v4
 with:
 fetch-depth: 0 # Full history
 submodules: true # Include submodules
 token: ${{ secrets.GITHUB_TOKEN }}
```

### Setup Language Runtimes

```yaml
# Node.js
- name: Setup Node.js
 uses: actions/setup-node@v4
 with:
 node-version: '20.x'
 cache: 'npm'

# .NET
- name: Setup .NET
 uses: actions/setup-dotnet@v4
 with:
 dotnet-version: '8.0.x'

# Python
- name: Setup Python
 uses: actions/setup-python@v5
 with:
 python-version: '3.11'
 cache: 'pip'

# Java
- name: Setup Java
 uses: actions/setup-java@v4
 with:
 java-version: '17'
 distribution: 'temurin'
 cache: 'maven'

# Go
- name: Setup Go
 uses: actions/setup-go@v5
 with:
 go-version: '1.21'
 cache: true
```

### Caching

```yaml
- name: Cache dependencies
 uses: actions/cache@v4
 with:
 path: ~/.npm
 key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
 restore-keys: |
 ${{ runner.os }}-node-

- name: Cache NuGet packages
 uses: actions/cache@v4
 with:
 path: ~/.nuget/packages
 key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
```

### Upload/Download Artifacts

```yaml
- name: Upload artifacts
 uses: actions/upload-artifact@v4
 with:
 name: build-output
 path: |
 dist/
 build/
 retention-days: 7

- name: Download artifacts
 uses: actions/download-artifact@v4
 with:
 name: build-output
 path: ./artifacts
```

### Code Coverage

```yaml
- name: Upload coverage to Codecov
 uses: codecov/codecov-action@v4
 with:
 token: ${{ secrets.CODECOV_TOKEN }}
 files: ./coverage/coverage.xml
 flags: unittests
 name: codecov-umbrella
 fail_ci_if_error: true
```

### Docker

```yaml
- name: Login to Docker Hub
 uses: docker/login-action@v3
 with:
 username: ${{ secrets.DOCKER_USERNAME }}
 password: ${{ secrets.DOCKER_PASSWORD }}

- name: Build and push
 uses: docker/build-push-action@v5
 with:
 context: .
 push: true
 tags: user/app:latest
 cache-from: type=registry,ref=user/app:buildcache
 cache-to: type=registry,ref=user/app:buildcache,mode=max
```

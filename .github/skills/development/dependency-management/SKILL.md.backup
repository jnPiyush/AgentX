---
name: dependency-management
description: 'Manage project dependencies securely with lock files, version pinning, security audits, and update strategies for NuGet, npm, and pip.'
---

# Dependency Management

> **Purpose**: Manage project dependencies securely and reliably.

---

## C# / .NET

### .csproj (SDK-style)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>

  <ItemGroup>
    <!-- Core dependencies with versions -->
    <PackageReference Include="Microsoft.AspNetCore.App" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    
    <!-- Use exact versions for production stability -->
    <PackageReference Include="Serilog" Version="[3.1.1]" />
    
    <!-- Use version ranges for flexibility -->
    <PackageReference Include="AutoMapper" Version="12.*" />
  </ItemGroup>

  <ItemGroup Condition="'$(Configuration)' == 'Debug'">
    <!-- Dev/Test dependencies -->
    <PackageReference Include="xunit" Version="2.6.6" />
    <PackageReference Include="Moq" Version="4.20.70" />
    <PackageReference Include="coverlet.collector" Version="6.0.0" />
  </ItemGroup>
</Project>
```

### Central Package Management (Directory.Packages.props)

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  
  <ItemGroup>
    <!-- Define versions centrally for multi-project solutions -->
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
    <PackageVersion Include="AutoMapper" Version="12.0.1" />
    <PackageVersion Include="xunit" Version="2.6.6" />
    <PackageVersion Include="Moq" Version="4.20.70" />
  </ItemGroup>
</Project>
```

### Package Reference in .csproj with Central Management

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <!-- Versions managed in Directory.Packages.props -->
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Serilog" />
    <PackageReference Include="AutoMapper" />
  </ItemGroup>
</Project>
```

---

## NuGet Package Management

```bash

dotnet restore
```

---

## Version Specifications

```xml
<!-- Exact version -->
<PackageReference Include="Serilog" Version="[3.1.1]" />

<!-- Minimum version -->
<PackageReference Include="Serilog" Version="3.1.1" />

<!-- Version range -->
<PackageReference Include="Serilog" Version="[3.1.1, 4.0.0)" />

<!-- Wildcard (patch updates) -->
<PackageReference Include="Serilog" Version="3.1.*" />

<!-- Float to latest minor/patch -->
<PackageReference Include="Serilog" Version="3.*" />
```

---

## Security Audits

```bash
# .NET Security Audit
dotnet list package --vulnerable

# Include transitive dependencies
dotnet list package --vulnerable --include-transitive

# Update vulnerable packages
dotnet add package <PackageName> --version <SafeVersion>

# Use GitHub Dependabot (for repos on GitHub)
# Create .github/dependabot.yml
```

### Dependabot Configuration (.github/dependabot.yml)

```yaml
version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    target-branch: "main"
```

---

## Package Lock Files

```bash
# NuGet uses packages.lock.json for deterministic restores
# Enable in .csproj:
```

```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <DisableImplicitNuGetFallbackFolder>true</DisableImplicitNuGetFallbackFolder>
</PropertyGroup>
```

```bash
# Restore and generate lock file
dotnet restore --locked-mode
```

---

## Global Tools

```bash
# Install global tool
dotnet tool install -g dotnet-ef

# Update global tool
dotnet tool update -g dotnet-ef

# List installed tools
dotnet tool list -g

# Uninstall tool
dotnet tool uninstall -g dotnet-ef
```

---

## Best Practices

- Use exact versions `[x.y.z]` in production for stability
- Enable Central Package Management for multi-project solutions
- Use `packages.lock.json` for deterministic builds
- Regularly check for vulnerable packages with `dotnet list package --vulnerable`
- Separate test dependencies using Conditions
- Use Dependabot or Renovate for automated updates
- Keep .NET SDK and runtime versions aligned
- Document package purposes in comments
- Review package licenses before adoption
- Prefer official Microsoft packages when available

---

## NuGet.config for Private Feeds

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="MyCompanyFeed" value="https://pkgs.dev.azure.com/mycompany/_packaging/myfeed/nuget/v3/index.json" />
  </packageSources>
  
  <packageSourceCredentials>
    <MyCompanyFeed>
      <add key="Username" value="%AZURE_DEVOPS_USERNAME%" />
      <add key="ClearTextPassword" value="%AZURE_DEVOPS_PAT%" />
    </MyCompanyFeed>
  </packageSourceCredentials>
</configuration>
```

---

**Related Skills**:
- [Security](04-security.md)
- [Version Control](12-version-control.md)


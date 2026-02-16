# Azure Pipelines Examples

> Load when implementing Azure Pipelines. See [SKILL.md](../SKILL.md) for platform comparison.

## Basic Pipeline Structure

```yaml
# azure-pipelines.yml
trigger:
 branches:
 include:
 - main
 - develop
 paths:
 include:
 - src/*
 exclude:
 - docs/*

pr:
 branches:
 include:
 - main
 paths:
 exclude:
 - '*.md'

pool:
 vmImage: 'ubuntu-latest'

variables:
 buildConfiguration: 'Release'
 dotnetVersion: '8.0.x'

steps:
- task: UseDotNet@2
 displayName: 'Install .NET SDK'
 inputs:
 version: $(dotnetVersion)

- script: dotnet restore
 displayName: 'Restore dependencies'

- script: dotnet build --configuration $(buildConfiguration)
 displayName: 'Build project'

- script: dotnet test --configuration $(buildConfiguration) --no-build
 displayName: 'Run tests'

- task: PublishTestResults@2
 inputs:
 testResultsFormat: 'VSTest'
 testResultsFiles: '**/*.trx'
```

## Multi-Stage Azure Pipeline

```yaml
# azure-pipelines.yml
trigger:
 - main

variables:
 buildConfiguration: 'Release'

stages:
- stage: Build
 displayName: 'Build and Test'
 jobs:
 - job: Build
 pool:
 vmImage: 'ubuntu-latest'
 steps:
 - task: UseDotNet@2
 inputs:
 version: '8.0.x'

 - script: |
 dotnet restore
 dotnet build --configuration $(buildConfiguration)
 dotnet test --configuration $(buildConfiguration) --collect:"XPlat Code Coverage"
 displayName: 'Build and Test'

 - task: PublishCodeCoverageResults@1
 inputs:
 codeCoverageTool: 'Cobertura'
 summaryFileLocation: '$(Agent.TempDirectory)/**/coverage.cobertura.xml'

 - task: PublishPipelineArtifact@1
 inputs:
 targetPath: '$(Build.ArtifactStagingDirectory)'
 artifactName: 'drop'

- stage: DeployDev
 displayName: 'Deploy to Development'
 dependsOn: Build
 condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
 jobs:
 - deployment: DeployDev
 environment: 'development'
 pool:
 vmImage: 'ubuntu-latest'
 strategy:
 runOnce:
 deploy:
 steps:
 - download: current
 artifact: drop

 - task: AzureWebApp@1
 inputs:
 azureSubscription: 'Azure-Dev'
 appName: 'myapp-dev'
 package: '$(Pipeline.Workspace)/drop/**/*.zip'

- stage: DeployProd
 displayName: 'Deploy to Production'
 dependsOn: Build
 condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
 jobs:
 - deployment: DeployProd
 environment: 'production'
 pool:
 vmImage: 'ubuntu-latest'
 strategy:
 runOnce:
 deploy:
 steps:
 - download: current
 artifact: drop

 - task: AzureWebApp@1
 inputs:
 azureSubscription: 'Azure-Prod'
 appName: 'myapp-prod'
 package: '$(Pipeline.Workspace)/drop/**/*.zip'
```

## Azure Pipeline Templates

### Template Definition

```yaml
# templates/build-template.yml
parameters:
 - name: buildConfiguration
 type: string
 default: 'Release'
 - name: dotnetVersion
 type: string
 default: '8.0.x'
 - name: runTests
 type: boolean
 default: true

steps:
- task: UseDotNet@2
 displayName: 'Install .NET ${{ parameters.dotnetVersion }}'
 inputs:
 version: ${{ parameters.dotnetVersion }}

- script: dotnet restore
 displayName: 'Restore dependencies'

- script: dotnet build --configuration ${{ parameters.buildConfiguration }}
 displayName: 'Build'

- ${{ if eq(parameters.runTests, true) }}:
 - script: dotnet test --configuration ${{ parameters.buildConfiguration }} --no-build
 displayName: 'Run tests'
```

### Template Usage

```yaml
# azure-pipelines.yml
trigger:
 - main

stages:
- stage: Build
 jobs:
 - job: BuildJob
 pool:
 vmImage: 'ubuntu-latest'
 steps:
 - template: templates/build-template.yml
 parameters:
 buildConfiguration: 'Release'
 dotnetVersion: '8.0.x'
 runTests: true
```

## Azure Pipeline with Matrix

```yaml
strategy:
 matrix:
 Linux:
 imageName: 'ubuntu-latest'
 Windows:
 imageName: 'windows-latest'
 macOS:
 imageName: 'macOS-latest'
 maxParallel: 3

pool:
 vmImage: $(imageName)

steps:
- script: echo "Running on $(imageName)"
```

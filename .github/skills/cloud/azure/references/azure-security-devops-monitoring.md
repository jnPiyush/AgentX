# Azure Security, DevOps, Monitoring & Cost Management

## Security

### Azure Key Vault

```csharp
// Access secrets with Managed Identity
var client = new SecretClient(
 new Uri("https://kv-myapp-prod.vault.azure.net/"),
 new DefaultAzureCredential()
);

// Get secret
KeyVaultSecret secret = await client.GetSecretAsync("DatabasePassword");
string password = secret.Value;

// Set secret
await client.SetSecretAsync("ApiKey", "new-secret-value");
```

### Managed Identity

```json
// Azure AD authentication in appsettings.json
{
 "AzureAd": {
 "Instance": "https://login.microsoftonline.com/",
 "TenantId": "your-tenant-id",
 "ClientId": "your-client-id"
 }
}
```

```csharp
// Use DefaultAzureCredential for automatic auth
var credential = new DefaultAzureCredential();

// Works with: Managed Identity, Azure CLI, VS Code, etc.
var blobClient = new BlobServiceClient(
 new Uri("https://mystorageaccount.blob.core.windows.net"),
 credential
);
```

### Network Security Groups

```bash
# Create NSG
az network nsg create \
 --name nsg-web \
 --resource-group rg-myapp-prod

# Add rule to allow HTTPS
az network nsg rule create \
 --nsg-name nsg-web \
 --resource-group rg-myapp-prod \
 --name AllowHTTPS \
 --priority 100 \
 --destination-port-ranges 443 \
 --access Allow \
 --protocol Tcp
```

---

## DevOps and CI/CD

### Azure DevOps Pipeline

```yaml
# azure-pipelines.yml
trigger:
 - main

pool:
 vmImage: 'ubuntu-latest'

variables:
 buildConfiguration: 'Release'

stages:
 - stage: Build
 jobs:
 - job: BuildJob
 steps:
 - task: UseDotNet@2
 inputs:
 version: '8.0.x'

 - task: DotNetCoreCLI@2
 inputs:
 command: 'build'
 projects: '**/*.csproj'
 arguments: '--configuration $(buildConfiguration)'

 - task: DotNetCoreCLI@2
 inputs:
 command: 'test'
 projects: '**/*Tests.csproj'

 - task: DotNetCoreCLI@2
 inputs:
 command: 'publish'
 publishWebProjects: true
 arguments: '--configuration $(buildConfiguration) --output $(Build.ArtifactStagingDirectory)'

 - publish: $(Build.ArtifactStagingDirectory)
 artifact: drop

 - stage: Deploy
 dependsOn: Build
 jobs:
 - deployment: DeployWeb
 environment: 'production'
 strategy:
 runOnce:
 deploy:
 steps:
 - task: AzureWebApp@1
 inputs:
 azureSubscription: 'MyAzureSubscription'
 appName: 'app-myapp-prod'
 package: '$(Pipeline.Workspace)/drop/**/*.zip'
```

### GitHub Actions for Azure

```yaml
name: Deploy to Azure

on:
 push:
 branches: [main]

jobs:
 build-and-deploy:
 runs-on: ubuntu-latest

 steps:
 - uses: actions/checkout@v4

 - name: Setup .NET
 uses: actions/setup-dotnet@v4
 with:
 dotnet-version: '8.0.x'

 - name: Build
 run: dotnet build --configuration Release

 - name: Publish
 run: dotnet publish -c Release -o ./publish

 - name: Login to Azure
 uses: azure/login@v1
 with:
 creds: ${{ secrets.AZURE_CREDENTIALS }}

 - name: Deploy to Azure Web App
 uses: azure/webapps-deploy@v2
 with:
 app-name: 'app-myapp-prod'
 package: ./publish
```

---

## Monitoring and Logging

### Application Insights

```csharp
// Program.cs
builder.Services.AddApplicationInsightsTelemetry();

// Custom telemetry
var telemetryClient = app.Services.GetRequiredService<TelemetryClient>();

// Track event
telemetryClient.TrackEvent("OrderCreated", new Dictionary<string, string>
{
 ["OrderId"] = orderId,
 ["CustomerId"] = customerId
});

// Track metric
telemetryClient.TrackMetric("OrderValue", orderTotal);

// Track exception
try
{
 // Operation
}
catch (Exception ex)
{
 telemetryClient.TrackException(ex);
 throw;
}
```

### Azure Monitor Alerts

```bash
# Create metric alert
az monitor metrics alert create \
 --name "High CPU Alert" \
 --resource-group rg-myapp-prod \
 --scopes $WEBAPP_RESOURCE_ID \
 --condition "avg CpuPercentage > 80" \
 --window-size 5m \
 --evaluation-frequency 1m \
 --action $ACTION_GROUP_ID
```

---

## Cost Management

### Cost Optimization Tips

1. **Right-size resources**: Use Azure Advisor recommendations
2. **Reserved Instances**: 1-3 year commitments for 40-60% savings
3. **Spot VMs**: Up to 90% discount for interruptible workloads
4. **Auto-scaling**: Scale down during off-peak hours
5. **Storage tiers**: Use appropriate tiers for data access patterns

### Budget Alerts

```bash
# Create budget
az consumption budget create \
 --budget-name "Monthly-Production" \
 --amount 5000 \
 --time-grain Monthly \
 --start-date 2024-01-01 \
 --end-date 2024-12-31 \
 --resource-group rg-myapp-prod
```

---

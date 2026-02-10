---
name: "azure"
description: "Microsoft Azure cloud services best practices for building scalable, secure, and reliable cloud applications."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
compatibility:
  providers: ["azure"]
  platforms: ["windows", "linux"]
allowed-tools: "read_file semantic_search grep_search file_search create_file replace_string_in_file run_in_terminal get_errors"
---

# Azure Cloud Development

> **Purpose**: Best practices for developing and deploying applications on Microsoft Azure, including compute, storage, security, and DevOps.

---

## Table of Contents

1. [Azure Fundamentals](#azure-fundamentals)
2. [Compute Services](#compute-services)
3. [Storage Services](#storage-services)
4. [Database Services](#database-services)
5. [Networking](#networking)
6. [Security](#security)
7. [DevOps and CI/CD](#devops-and-cicd)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Cost Management](#cost-management)
10. [Best Practices](#best-practices)

---

## Azure Fundamentals

### Resource Hierarchy

```
Management Group
└── Subscription
    └── Resource Group
        └── Resources (VMs, Storage, etc.)
```

### Naming Conventions

```
{resource-type}-{workload}-{environment}-{region}-{instance}

Examples:
vm-web-prod-eastus-001
st-data-dev-westus-001
sql-orders-staging-northeu-001
```

### Resource Groups

- Group resources by lifecycle
- One resource group per environment per application
- Apply tags for cost allocation and management

```bash
# Create resource group
az group create --name rg-myapp-prod --location eastus --tags Environment=Production Team=Engineering
```

---

## Compute Services

### Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name asp-myapp-prod \
  --resource-group rg-myapp-prod \
  --sku P1V2 \
  --is-linux

# Create Web App
az webapp create \
  --name app-myapp-prod \
  --resource-group rg-myapp-prod \
  --plan asp-myapp-prod \
  --runtime "DOTNET|8.0"

# Deploy from GitHub
az webapp deployment source config \
  --name app-myapp-prod \
  --resource-group rg-myapp-prod \
  --repo-url https://github.com/org/repo \
  --branch main
```

### Azure Container Apps

```bash
# Create Container Apps Environment
az containerapp env create \
  --name cae-myapp-prod \
  --resource-group rg-myapp-prod \
  --location eastus

# Deploy container
az containerapp create \
  --name ca-api-prod \
  --resource-group rg-myapp-prod \
  --environment cae-myapp-prod \
  --image myregistry.azurecr.io/api:latest \
  --target-port 8080 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10
```

### Azure Functions

```csharp
// HTTP Trigger Function
[Function("HttpTrigger")]
public IActionResult Run(
    [HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequest req,
    FunctionContext context)
{
    var logger = context.GetLogger("HttpTrigger");
    logger.LogInformation("Processing request");

    return new OkObjectResult("Hello, Azure Functions!");
}

// Timer Trigger (CRON)
[Function("TimerTrigger")]
public void Run([TimerTrigger("0 */5 * * * *")] TimerInfo timer)
{
    // Runs every 5 minutes
}

// Queue Trigger
[Function("QueueTrigger")]
public void Run([QueueTrigger("myqueue")] string message)
{
    // Process queue message
}
```

---

## Storage Services

### Azure Blob Storage

```csharp
// Using Azure.Storage.Blobs
var connectionString = Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
var blobServiceClient = new BlobServiceClient(connectionString);
var containerClient = blobServiceClient.GetBlobContainerClient("mycontainer");

// Upload blob
var blobClient = containerClient.GetBlobClient("myfile.txt");
await blobClient.UploadAsync(fileStream, overwrite: true);

// Download blob
var response = await blobClient.DownloadContentAsync();
var content = response.Value.Content.ToString();

// Generate SAS token
var sasBuilder = new BlobSasBuilder
{
    BlobContainerName = "mycontainer",
    BlobName = "myfile.txt",
    ExpiresOn = DateTimeOffset.UtcNow.AddHours(1)
};
sasBuilder.SetPermissions(BlobSasPermissions.Read);
var sasToken = blobClient.GenerateSasUri(sasBuilder);
```

### Storage Tiers

| Tier | Use Case | Access Time |
|------|----------|-------------|
| Hot | Frequently accessed | Milliseconds |
| Cool | Infrequently accessed (30+ days) | Milliseconds |
| Cold | Rarely accessed (90+ days) | Milliseconds |
| Archive | Long-term backup | Hours |

---

## Database Services

### Azure SQL Database

```sql
-- Create database
CREATE DATABASE MyDB
(
    EDITION = 'Standard',
    SERVICE_OBJECTIVE = 'S2',
    MAXSIZE = 250 GB
);

-- Enable automatic tuning
ALTER DATABASE MyDB
SET AUTOMATIC_TUNING = AUTO;
```

```csharp
// Connection string with Managed Identity
var connectionString = "Server=tcp:myserver.database.azure.net;Database=MyDB;Authentication=Active Directory Managed Identity;";

using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
```

### Azure Cosmos DB

```csharp
// Create Cosmos client
var cosmosClient = new CosmosClient(
    accountEndpoint,
    new DefaultAzureCredential()
);

// Get container
var container = cosmosClient.GetContainer("MyDatabase", "MyContainer");

// Create item
var item = new { id = Guid.NewGuid().ToString(), name = "Test", partitionKey = "pk1" };
await container.CreateItemAsync(item, new PartitionKey("pk1"));

// Query items
var query = new QueryDefinition("SELECT * FROM c WHERE c.name = @name")
    .WithParameter("@name", "Test");

using var iterator = container.GetItemQueryIterator<dynamic>(query);
while (iterator.HasMoreResults)
{
    var response = await iterator.ReadNextAsync();
    foreach (var item in response)
    {
        Console.WriteLine(item);
    }
}
```

---

## Networking

### Virtual Network

```bash
# Create VNet
az network vnet create \
  --name vnet-myapp-prod \
  --resource-group rg-myapp-prod \
  --address-prefix 10.0.0.0/16

# Create subnets
az network vnet subnet create \
  --name snet-web \
  --vnet-name vnet-myapp-prod \
  --resource-group rg-myapp-prod \
  --address-prefix 10.0.1.0/24

az network vnet subnet create \
  --name snet-db \
  --vnet-name vnet-myapp-prod \
  --resource-group rg-myapp-prod \
  --address-prefix 10.0.2.0/24
```

### Private Endpoints

```bash
# Create private endpoint for SQL
az network private-endpoint create \
  --name pe-sql-myapp \
  --resource-group rg-myapp-prod \
  --vnet-name vnet-myapp-prod \
  --subnet snet-db \
  --private-connection-resource-id $SQL_SERVER_ID \
  --group-id sqlServer \
  --connection-name myconnection
```

---

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

## Best Practices

### ✅ DO

- Use Managed Identity instead of connection strings
- Enable Azure Defender for security
- Use availability zones for high availability
- Implement proper tagging strategy
- Use Infrastructure as Code (Bicep/Terraform)
- Enable diagnostic logging
- Use Private Endpoints for PaaS services
- Implement proper backup and DR strategy

### ❌ DON'T

- Store secrets in code or config files
- Use overly permissive network rules
- Ignore Azure Advisor recommendations
- Skip resource locks on production resources
- Use public endpoints for databases
- Forget to set up cost alerts

---

## References

- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
- [Azure CLI Documentation](https://learn.microsoft.com/cli/azure/)
- [Azure SDK for .NET](https://learn.microsoft.com/dotnet/azure/)

---

**Version**: 1.0
**Last Updated**: February 5, 2026

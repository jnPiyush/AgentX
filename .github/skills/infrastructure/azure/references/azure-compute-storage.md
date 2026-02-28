# Azure Compute & Storage Services

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

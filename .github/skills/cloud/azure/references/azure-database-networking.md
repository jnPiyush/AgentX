# Azure Database & Networking Services

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

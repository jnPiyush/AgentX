# Security and RBAC for Cosmos DB

> Entra ID-first authentication, managed identity, network isolation, and key management.

## Disable Local Auth

Set `disableLocalAuth: true` on the account. This blocks all key-based connections and forces Entra ID. Do this for every production account.

```bash
az cosmosdb update -g rg-data -n cosmos-graph-prod --disable-local-auth true
```

## Built-in Data Plane Roles

| Role | Permissions |
|------|-------------|
| `Cosmos DB Built-in Data Reader` | Read items, queries, change feed |
| `Cosmos DB Built-in Data Contributor` | Read + write items |

Custom roles may be defined for fine-grained scope (per database or per container). Assign at the **account** scope for most workloads.

```bash
az cosmosdb sql role assignment create \
  --account-name cosmos-graph-prod \
  --resource-group rg-data \
  --scope "/" \
  --principal-id <managed-identity-objectId> \
  --role-definition-id 00000000-0000-0000-0000-000000000002
```

## Managed Identity from App Code

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

cred = DefaultAzureCredential()
client = CosmosClient("https://cosmos-graph-prod.documents.azure.com:443/", credential=cred)
```

For Gremlin, acquire an AAD token for scope `https://cosmos.azure.com/.default` and pass it as the password in the Gremlin connection. Refresh before expiry (default 1 hour).

## Network Controls

- **Private Endpoint**: route traffic over the VNet; disable public access entirely
- **Service endpoints**: restrict access to specific subnets (legacy; prefer private endpoint)
- **IP firewall**: allow specific public IP ranges only when private endpoint is not feasible

## Encryption

- Encryption at rest is always on (service-managed key by default)
- Customer-Managed Keys (CMK) supported via Azure Key Vault for compliance workloads
- TLS 1.2 minimum on all client connections

## Auditing

Enable diagnostic settings -> Log Analytics for `DataPlaneRequests`, `ControlPlaneRequests`, `QueryRuntimeStatistics`. Build alerts on failed auth and 4xx spikes.

## Secret Hygiene

- Never check account keys into source control
- Use Key Vault references in App Service / Container Apps configuration if keys are unavoidable
- Rotate primary/secondary keys after personnel changes; prefer RBAC to avoid rotation entirely

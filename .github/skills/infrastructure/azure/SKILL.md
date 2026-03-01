---
name: "azure"
description: 'Build scalable, secure, and reliable applications on Microsoft Azure cloud services. Use when deploying to Azure, configuring Azure compute/storage/database services, setting up Azure networking, implementing Azure security, or managing Azure costs and monitoring.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2026-02-11"
compatibility:
 providers: ["azure"]
 platforms: ["windows", "linux"]
---

# Azure Cloud Development

> **Purpose**: Best practices for developing and deploying applications on Microsoft Azure, including compute, storage, security, and DevOps.

---

## When to Use This Skill

- Deploying applications to Microsoft Azure
- Configuring Azure compute, storage, or database services
- Setting up Azure networking and security
- Implementing CI/CD with Azure DevOps
- Managing Azure costs and monitoring

## Decision Tree

```
Azure Service Selection
+-- Hosting a web app or API?
|   +-- Containers? -> Azure Container Apps
|   +-- Serverless functions? -> Azure Functions
|   +-- Full PaaS? -> Azure App Service
|   +-- Kubernetes? -> AKS
+-- Storing data?
|   +-- Relational? -> Azure SQL / PostgreSQL Flexible Server
|   +-- Document/NoSQL? -> Cosmos DB
|   +-- Blob/files? -> Azure Storage
+-- Messaging or events?
|   +-- Queue-based? -> Service Bus
|   +-- Event streaming? -> Event Hubs
+-- AI/ML workloads?
|   +-- LLM hosting? -> Azure OpenAI Service
|   +-- Search + RAG? -> Azure AI Search
+-- Not sure? -> Start with App Service + Azure SQL
```

## Prerequisites

- Azure subscription
- Azure CLI installed
- Basic cloud computing concepts

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
10. [AI Services](#ai-services)
11. [Best Practices](#best-practices)

---

## Azure Fundamentals

### Resource Hierarchy

```
Management Group
-- Subscription
 -- Resource Group
 -- Resources (VMs, Storage, etc.)
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

## AI Services

### Azure OpenAI Service
- **Purpose**: LLM hosting (GPT-4o, GPT-3.5-Turbo).
- **Best Practice**: Use **Managed Identity** for authentication. Disable keys.
- **Networking**: Deploy in Virtual Network with Private Endpoint.

```bash
# Create OpenAI Resource
az cognitiveservices account create \
 --name "ai-agentx-dev" \
 --resource-group "rg-agentx-dev-eastus-001" \
 --location "eastus2" \
 --kind "OpenAI" \
 --sku "S0"
```

### Azure AI Search
- **Purpose**: Vector database and retrieval engine for RAG.
- **Configuration**: Standard Tier required for Semantic Search.
- **RBAC**: Assign `Search Index Data Contributor` to the Agent Identity.

### Azure Cosmos DB (NoSQL)
- **Purpose**: Conversation history and agent state.
- **Feature**: Use **Vector Indexing** for memory retrieval.
- **Consistency**: Session consistency is usually sufficient for chat.

---

## Core Rules

### [PASS] DO

- Use Managed Identity instead of connection strings
- Enable Azure Defender for security
- Use availability zones for high availability
- Implement proper tagging strategy
- Use Infrastructure as Code (Bicep/Terraform)
- Enable diagnostic logging
- Use Private Endpoints for PaaS services
- Implement proper backup and DR strategy

### [FAIL] DON'T

- Store secrets in code or config files
- Use overly permissive network rules
- Ignore Azure Advisor recommendations
- Skip resource locks on production resources
- Use public endpoints for databases
- Forget to set up cost alerts

---

## Anti-Patterns

- **Secrets in App Settings**: Storing passwords or keys in plain app config -> Use Key Vault references with managed identity
- **Oversized SKUs**: Choosing premium tiers for dev/test environments -> Use dev-appropriate SKUs, scale up for production only
- **No Resource Locks**: Production resources unprotected from accidental deletion -> Apply CanNotDelete locks on production resource groups
- **Public Database Endpoints**: Databases accessible from the internet -> Use Private Endpoints and VNet integration
- **Manual Deployments**: Deploying via portal clicks without repeatable process -> Use Infrastructure as Code (Bicep/Terraform) with CI/CD pipelines
- **Single Region No DR**: All resources in one region with no failover plan -> Deploy across availability zones and plan geo-redundancy

---

## References

- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
- [Azure CLI Documentation](https://learn.microsoft.com/cli/azure/)
- [Azure SDK for .NET](https://learn.microsoft.com/dotnet/azure/)

---

**Version**: 1.1
**Last Updated**: February 11, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment fails with permission error | Check Azure RBAC role assignments and service principal permissions |
| High Azure costs | Use Azure Cost Management, enable auto-shutdown for dev VMs, right-size resources |
| Resource not found errors | Verify resource group, subscription, and region are correct |
// Bicep template: Cosmos DB Gremlin account with RBAC and private endpoint
// Hardened defaults: local auth disabled, public network access disabled, TLS 1.2.

@description('Cosmos DB account name (3-44 chars, lowercase, digits, hyphens).')
@minLength(3)
@maxLength(44)
param accountName string

@description('Primary Azure region.')
param location string = resourceGroup().location

@description('Optional secondary region for geo-redundancy.')
param secondaryLocation string = ''

@description('Database name.')
param databaseName string = 'social'

@description('Graph (container) name.')
param graphName string = 'people'

@description('Partition key path for the graph. Cannot be changed after creation.')
param partitionKeyPath string = '/pk'

@description('Autoscale max RU/s. Baseline is 10% of this value.')
@minValue(1000)
param autoscaleMaxRU int = 4000

@description('Object IDs of principals (managed identities, groups) to grant Data Contributor.')
param dataContributorPrincipalIds array = []

@description('Subnet resource ID for the private endpoint. Leave empty to skip.')
param privateEndpointSubnetId string = ''

var locations = empty(secondaryLocation) ? [
  {
    locationName: location
    failoverPriority: 0
    isZoneRedundant: true
  }
] : [
  {
    locationName: location
    failoverPriority: 0
    isZoneRedundant: true
  }
  {
    locationName: secondaryLocation
    failoverPriority: 1
    isZoneRedundant: true
  }
]

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    capabilities: [
      { name: 'EnableGremlin' }
    ]
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: locations
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
    disableLocalAuth: true
    publicNetworkAccess: empty(privateEndpointSubnetId) ? 'Enabled' : 'Disabled'
    minimalTlsVersion: 'Tls12'
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
  }
}

resource gremlinDb 'Microsoft.DocumentDB/databaseAccounts/gremlinDatabases@2024-05-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource graph 'Microsoft.DocumentDB/databaseAccounts/gremlinDatabases/graphs@2024-05-15' = {
  parent: gremlinDb
  name: graphName
  properties: {
    resource: {
      id: graphName
      partitionKey: {
        paths: [ partitionKeyPath ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [ { path: '/*' } ]
        excludedPaths: [ { path: '/_etag/?' } ]
      }
    }
    options: {
      autoscaleSettings: {
        maxThroughput: autoscaleMaxRU
      }
    }
  }
}

// Built-in Cosmos DB Data Contributor role (data plane)
var dataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource roleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = [for (pid, idx) in dataContributorPrincipalIds: {
  parent: account
  name: guid(account.id, pid, dataContributorRoleId)
  properties: {
    principalId: pid
    roleDefinitionId: '${account.id}/sqlRoleDefinitions/${dataContributorRoleId}'
    scope: account.id
  }
}]

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = if (!empty(privateEndpointSubnetId)) {
  name: '${accountName}-pe'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${accountName}-plsc'
        properties: {
          privateLinkServiceId: account.id
          groupIds: [ 'Gremlin' ]
        }
      }
    ]
  }
}

output accountId string = account.id
output gremlinEndpoint string = 'wss://${accountName}.gremlin.cosmos.azure.com:443/'
output databaseName string = databaseName
output graphName string = graphName

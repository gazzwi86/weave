---
topic: infra
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# Azure Bicep — Function App (Consumption) + Cosmos SQL API + Key Vault + App Insights

Bicep current (API 2024-04-01+). Consumption plan keeps cost zero at idle.
Key Vault holds the Cosmos connection string; Function reads it via a Key Vault reference.

```bicep
// main.bicep
@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment suffix: dev / staging / prod')
@allowed(['dev', 'staging', 'prod'])
param env string = 'dev'

var prefix = 'myapp-${env}'

// -- Application Insights ----------------------------------------------------
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-ai'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', RetentionInDays: 30 }
}

// -- Storage (required by Function App) --------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: replace('${prefix}stor', '-', '')  // storage names: no hyphens
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { allowBlobPublicAccess: false, minimumTlsVersion: 'TLS1_2' }
}

// -- Cosmos DB ----------------------------------------------------------------
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: '${prefix}-cosmos'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0 }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    enableFreeTier: env == 'dev'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosAccount
  name: 'myapp'
  properties: { resource: { id: 'myapp' } }
}

// -- Key Vault ----------------------------------------------------------------
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource cosmosSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'CosmosConnectionString'
  properties: { value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString }
}

// -- Function App (Consumption) -----------------------------------------------
resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
}

resource funcApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-func'
  location: location
  kind: 'functionapp'
  identity: { type: 'SystemAssigned' }   // managed identity for KV access
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'AzureWebJobsStorage',               value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value}' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY',    value: appInsights.properties.InstrumentationKey }
        { name: 'FUNCTIONS_EXTENSION_VERSION',       value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME',          value: 'python' }
        // Key Vault reference — no plaintext secret in app settings
        { name: 'COSMOS_CONNECTION_STRING',          value: '@Microsoft.KeyVault(SecretUri=${cosmosSecret.properties.secretUri})' }
      ]
    }
  }
}

// Grant Function App identity read access to Key Vault
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, funcApp.id, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: funcApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

**Why:** Key Vault references (`@Microsoft.KeyVault(...)`) mean the connection
string never appears in plaintext. System-assigned identity + RBAC is
recommended over access policies. `enableFreeTier` on dev reduces cost.

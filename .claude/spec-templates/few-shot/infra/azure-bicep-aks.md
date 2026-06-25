---
topic: infra
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# Azure Bicep — AKS Cluster with Workload Identity, Managed Prometheus + Grafana, Node Pools

Bicep current. Workload identity (OIDC) replaces pod-level service principals.
Azure Monitor managed Prometheus + Grafana add-ons remove self-managed stack.

```bicep
// aks.bicep
@description('Location for all resources')
param location string = resourceGroup().location

@description('Kubernetes version')
param k8sVersion string = '1.30'

@description('System node pool VM size')
param systemVmSize string = 'Standard_D2ds_v5'

@description('App node pool VM size')
param appVmSize string = 'Standard_D4ds_v5'

var clusterName = 'myapp-aks'

// -- Managed Prometheus (Azure Monitor workspace) ----------------------------
resource amwWorkspace 'microsoft.monitor/accounts@2023-04-03' = {
  name: '${clusterName}-amw'
  location: location
}

// -- Managed Grafana ---------------------------------------------------------
resource grafana 'Microsoft.Dashboard/grafana@2023-09-01' = {
  name: '${clusterName}-grafana'
  location: location
  sku: { name: 'Standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    zoneRedundancy: 'Disabled'
    grafanaIntegrations: {
      azureMonitorWorkspaceIntegrations: [
        { azureMonitorWorkspaceResourceId: amwWorkspace.id }
      ]
    }
  }
}

// -- User-assigned managed identity for workload identity --------------------
resource aksIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${clusterName}-identity'
  location: location
}

// -- AKS Cluster -------------------------------------------------------------
resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: clusterName
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${aksIdentity.id}': {} } }
  properties: {
    kubernetesVersion: k8sVersion
    dnsPrefix: clusterName
    enableRBAC: true

    // Workload identity (OIDC) — replaces pod-level service principals
    oidcIssuerProfile:      { enabled: true }
    securityProfile:        { workloadIdentity: { enabled: true } }

    agentPoolProfiles: [
      // System pool — critical system pods only
      {
        name:   'system'
        count:  2
        vmSize: systemVmSize
        mode:   'System'
        osType: 'Linux'
        osDiskSizeGB: 50
        nodeTaints: ['CriticalAddonsOnly=true:NoSchedule']
      }
      // App pool — application workloads
      {
        name:    'app'
        count:   3
        minCount: 2
        maxCount: 10
        vmSize:  appVmSize
        mode:    'User'
        osType:  'Linux'
        enableAutoScaling: true
      }
    ]

    addonProfiles: {
      // Azure Keyvault Secret Store CSI driver
      azureKeyvaultSecretsProvider: { enabled: true, config: { enableSecretRotation: 'true' } }
    }

    // Managed Prometheus scraping add-on
    azureMonitorProfile: {
      metrics: {
        enabled: true
        kubeStateMetrics: { metricLabelsAllowlist: 'app,env', metricAnnotationsAllowList: '' }
      }
    }
    networkProfile: { networkPlugin: 'azure', networkPolicy: 'calico' }
  }
}

// Grafana → Prometheus reader role
resource grafanaPrometheusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: amwWorkspace
  name: guid(amwWorkspace.id, grafana.id, 'Monitoring Data Reader')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b0d8363b-8ddd-447d-831f-62ca05bff136')
    principalId: grafana.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output clusterName string = aks.name
output oidcIssuer string = aks.properties.oidcIssuerProfile.issuerURL
```

**Why:** Separate system/app node pools prevent application workloads from
evicting critical add-ons. Workload identity eliminates long-lived credentials
from pods. Managed Prometheus + Grafana add-ons are updated by Azure — no manual
Helm chart upgrades.

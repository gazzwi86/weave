---
topic: infra
stack: ts
references:
  - docs/stack-equivalents.md
---

# Pulumi TypeScript — Parallel AWS S3 + Azure Storage from One Program

Pulumi 3.x, @pulumi/aws 6.x, @pulumi/azure-native 2.x.
One Pulumi program, two providers, outputs composed together.

```ts
// index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as azure from "@pulumi/azure-native";

// -- Config ------------------------------------------------------------------
const cfg     = new pulumi.Config();
const env     = cfg.require("env");                 // dev | staging | prod
const rgName  = cfg.get("azureRg") ?? `myapp-${env}-rg`;

// -- AWS S3 Bucket -----------------------------------------------------------
const s3Bucket = new aws.s3.BucketV2(`myapp-${env}-assets`, {
  tags: { env, managedBy: "pulumi" },
});

const s3BucketVersioning = new aws.s3.BucketVersioningV2("assets-versioning", {
  bucket: s3Bucket.id,
  versioningConfiguration: { status: "Enabled" },
});

const s3BucketEncryption = new aws.s3.BucketServerSideEncryptionConfigurationV2("assets-sse", {
  bucket: s3Bucket.id,
  rules: [{
    applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
  }],
});

// Block all public access
const s3BucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock("assets-public-block", {
  bucket: s3Bucket.id,
  blockPublicAcls: true, blockPublicPolicy: true,
  ignorePublicAcls: true, restrictPublicBuckets: true,
});

// -- Azure Resource Group + Storage Account ----------------------------------
const resourceGroup = new azure.resources.ResourceGroup("rg", {
  resourceGroupName: rgName,
  location: "australiaeast",
  tags: { env, managedBy: "pulumi" },
});

const azureStorage = new azure.storage.StorageAccount(`myapp${env}stor`, {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  sku: { name: "Standard_LRS" },
  kind: "StorageV2",
  enableHttpsTrafficOnly: true,
  minimumTlsVersion: "TLS1_2",
  allowBlobPublicAccess: false,
  tags: { env, managedBy: "pulumi" },
});

// -- Composed output (cross-cloud summary) -----------------------------------
export const storageEndpoints = pulumi.all([
  s3Bucket.bucketRegionalDomainName,
  azureStorage.primaryEndpoints,
]).apply(([s3Domain, azEndpoints]) => ({
  aws:   `https://${s3Domain}`,
  azure: azEndpoints.blob,
}));

export const awsBucketName    = s3Bucket.id;
export const azureStorageName = azureStorage.name;
```

```yaml
# Pulumi.dev.yaml
config:
  myapp:env: dev
  aws:region: ap-southeast-2
  azure-native:location: australiaeast
```

```bash
# Workflow
pulumi stack init dev
pulumi up --stack dev --yes
pulumi stack output storageEndpoints   # prints both endpoints
pulumi destroy --stack dev             # teardown
```

**Why:** `pulumi.all([...]).apply(...)` composes outputs from two providers
into a single typed object. Each resource (versioning, encryption, public-access
block) is a separate Pulumi resource, keeping `index.ts` under 80 lines total.
Provider credentials come from environment variables, not hard-coded.

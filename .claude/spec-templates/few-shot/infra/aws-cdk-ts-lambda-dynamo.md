---
topic: infra
stack: ts
references:
  - docs/stack-equivalents.md
---

# AWS CDK TypeScript — Lambda + DynamoDB + APIGW + cdk-nag + X-Ray

CDK v2, Node 20 Lambda (ARM64), cdk-nag 2.x, X-Ray active tracing.
Each construct is ≤ 50 lines; stack wires them together.

```ts
// lib/order-stack.ts
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export class OrderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = this.createTable();
    const fn    = this.createHandler(table);
    this.createApi(fn);
  }

  private createTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, "Orders", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey:      { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption:   dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName:  "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey:      { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
    });

    return table;
  }

  private createHandler(table: dynamodb.Table): lambda.Function {
    const fn = new lambda.Function(this, "OrderHandler", {
      runtime:      lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code:         lambda.Code.fromAsset("lambda"),
      handler:      "index.handler",
      tracing:      lambda.Tracing.ACTIVE,                   // X-Ray
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: { TABLE_NAME: table.tableName },
      memorySize:  256,
      timeout:     cdk.Duration.seconds(10),
    });

    table.grantReadWriteData(fn);

    // cdk-nag suppression — Lambda not in VPC acceptable for public API
    NagSuppressions.addResourceSuppressions(fn, [
      { id: "AwsSolutions-L1", reason: "Node 20 is current LTS" },
      { id: "AwsSolutions-VPC3", reason: "Public API Lambda — VPC adds cost without security benefit here" },
    ]);

    return fn;
  }

  private createApi(fn: lambda.Function): apigateway.RestApi {
    const api = new apigateway.LambdaRestApi(this, "OrderApi", {
      handler: fn,
      proxy:   false,
      deployOptions: { tracingEnabled: true },    // X-Ray on APIGW
    });

    const orders = api.root.addResource("orders");
    orders.addMethod("GET");
    orders.addMethod("POST");
    orders.addResource("{id}").addMethod("GET");

    return api;
  }
}
```

```ts
// bin/app.ts
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { OrderStack } from "../lib/order-stack";

const app = new cdk.App();
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

new OrderStack(app, "OrderStack", {
  env: { account: process.env.CDK_ACCOUNT, region: process.env.CDK_REGION ?? "ap-southeast-2" },
});
```

**Why:** ARM64 + PAY_PER_REQUEST = lowest cost for variable workloads.
`pointInTimeRecovery` is free and prevents data-loss incidents. cdk-nag runs
at synth time — catches IAM over-permissioning before deploy.

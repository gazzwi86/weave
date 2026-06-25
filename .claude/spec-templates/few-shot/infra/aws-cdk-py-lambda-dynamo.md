---
topic: infra
stack: python
references:
  - docs/stack-equivalents.md
---

# AWS CDK Python — Lambda + DynamoDB + APIGW + cdk-nag + X-Ray

CDK v2 (Python), python3.12 Lambda (ARM64). Mirrors the TS example so teams
can compare; keep the same security posture regardless of CDK language.

```python
# order_stack/order_stack.py
import aws_cdk as cdk
from aws_cdk import (
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_logs as logs,
)
from cdk_nag import NagSuppressions
from constructs import Construct


class OrderStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        table = self._create_table()
        fn    = self._create_handler(table)
        self._create_api(fn)

    # -------------------------------------------------------------------------
    def _create_table(self) -> dynamodb.Table:
        table = dynamodb.Table(
            self, "Orders",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
            point_in_time_recovery=True,
            removal_policy=cdk.RemovalPolicy.RETAIN,
        )
        table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING),
        )
        return table

    def _create_handler(self, table: dynamodb.Table) -> _lambda.Function:
        fn = _lambda.Function(
            self, "OrderHandler",
            runtime=_lambda.Runtime.PYTHON_3_12,
            architecture=_lambda.Architecture.ARM_64,
            code=_lambda.Code.from_asset("lambda"),
            handler="index.handler",
            tracing=_lambda.Tracing.ACTIVE,                  # X-Ray
            log_retention=logs.RetentionDays.ONE_MONTH,
            environment={"TABLE_NAME": table.table_name},
            memory_size=256,
            timeout=cdk.Duration.seconds(10),
        )
        table.grant_read_write_data(fn)

        NagSuppressions.add_resource_suppressions(fn, [
            {"id": "AwsSolutions-L1", "reason": "Python 3.12 is current"},
            {"id": "AwsSolutions-VPC3", "reason": "Public API Lambda — VPC adds cost without benefit"},
        ])
        return fn

    def _create_api(self, fn: _lambda.Function) -> apigw.LambdaRestApi:
        api = apigw.LambdaRestApi(
            self, "OrderApi",
            handler=fn,
            proxy=False,
            deploy_options=apigw.StageOptions(tracing_enabled=True),
        )
        orders = api.root.add_resource("orders")
        orders.add_method("GET")
        orders.add_method("POST")
        orders.add_resource("{id}").add_method("GET")
        return api
```

```python
# app.py
import aws_cdk as cdk
from cdk_nag import AwsSolutionsChecks
from order_stack.order_stack import OrderStack
import os

app = cdk.App()
cdk.Aspects.of(app).add(AwsSolutionsChecks(verbose=True))

OrderStack(app, "OrderStack", env=cdk.Environment(
    account=os.environ.get("CDK_ACCOUNT"),
    region=os.environ.get("CDK_REGION", "ap-southeast-2"),
))

app.synth()
```

```toml
# pyproject.toml deps
[project]
dependencies = [
    "aws-cdk-lib>=2.140",
    "constructs>=10.3",
    "cdk-nag>=2.28",
]
```

**Why:** Python CDK is identical in semantics to TS CDK — same L2 constructs,
same cdk-nag rules. Choose based on team preference; both get security parity.
`ARM_64` + `PAY_PER_REQUEST` give the same cost profile as the TS version.

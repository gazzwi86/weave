---
topic: infra
stack: python
references:
  - docs/stack-equivalents.md
---

# AWS SAM — Python 3.12 Lambda + DynamoDB + HttpApi + Powertools Layer

SAM 1.x, python3.12, AWS Lambda Powertools v3 layer, HttpApi (HTTP API v2).
SAM is lighter than CDK for single-service Lambda projects.

```yaml
# template.yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Description: Order service — SAM template

Globals:
  Function:
    Runtime: python3.12
    Architectures: [arm64]
    MemorySize: 256
    Timeout: 10
    Tracing: Active                              # X-Ray
    Layers:
      - !Sub "arn:aws:lambda:${AWS::Region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python312-arm64:10"
    Environment:
      Variables:
        POWERTOOLS_SERVICE_NAME: order-service
        LOG_LEVEL: INFO

Parameters:
  Stage:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]

Resources:

  # -- DynamoDB ---------------------------------------------------------------
  OrdersTable:
    Type: AWS::Serverless::SimpleTable
    Properties:
      PrimaryKey:
        Name: PK
        Type: String
      SSESpecification:
        SSEEnabled: true
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

  # -- Lambda -----------------------------------------------------------------
  OrderHandler:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: orders.handler.lambda_handler
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
      Environment:
        Variables:
          TABLE_NAME: !Ref OrdersTable
      Events:
        ListOrders:  { Type: HttpApi, Properties: { Path: /orders,      Method: GET  } }
        CreateOrder: { Type: HttpApi, Properties: { Path: /orders,      Method: POST } }
        GetOrder:    { Type: HttpApi, Properties: { Path: /orders/{id}, Method: GET  } }

Outputs:
  ApiEndpoint:
    Description: HTTP API endpoint
    Value: !Sub "https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com/"
  TableName:
    Value: !Ref OrdersTable
```

```python
# src/orders/handler.py
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger  = Logger()
tracer  = Tracer()
app     = APIGatewayHttpResolver()

@app.get("/orders")
@tracer.capture_method
def list_orders():
    customer_id = app.current_event.get_query_string_value("customerId")
    if not customer_id:
        return {"statusCode": 400, "body": {"error": "customerId required"}}
    # Replace with real DynamoDB call
    return {"orders": []}

@app.post("/orders")
@tracer.capture_method
def create_order():
    body = app.current_event.json_body
    # Validate + persist
    return {"statusCode": 201, "body": {"id": "new-order-id"}}

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
```

```bash
sam build && sam local start-api             # build + hot-reload local server
sam deploy --guided                          # first deploy (creates samconfig.toml)
sam deploy --config-env prod                 # subsequent deploys
```

**Why:** `AWSLambdaPowertoolsPythonV3` layer injects structured logging, tracing,
and event parsing without adding Python deps. `SimpleTable` is a SAM shorthand
for single-key DynamoDB tables; use `AWS::DynamoDB::Table` when you need GSIs.

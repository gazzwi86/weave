---
topic: infra
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# CloudFormation — RDS Postgres with Parameter Group, Subnet Group, SG, Secrets Rotation

Raw CFN for teams that can't use CDK/SAM. Covers RDS Postgres 16 with
Secrets Manager auto-rotation (30-day cycle).

```yaml
# rds-postgres.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: RDS Postgres 16 with Secrets Manager rotation

Parameters:
  VpcId:       { Type: AWS::EC2::VPC::Id }
  SubnetIds:   { Type: List<AWS::EC2::Subnet::Id> }
  AppSgId:     { Type: AWS::EC2::SecurityGroup::Id, Description: "App tier SG allowed to connect" }
  DBName:      { Type: String, Default: myapp }
  DBInstanceClass: { Type: String, Default: db.t4g.micro }

Resources:

  # -- Security Group ---------------------------------------------------------
  RdsSg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: RDS Postgres access
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref AppSgId

  # -- Subnet Group -----------------------------------------------------------
  RdsSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Private subnets for RDS
      SubnetIds: !Ref SubnetIds

  # -- Parameter Group --------------------------------------------------------
  RdsParamGroup:
    Type: AWS::RDS::DBParameterGroup
    Properties:
      Description: Postgres 16 tuned params
      Family: postgres16
      Parameters:
        log_min_duration_statement: "1000"   # log queries > 1 s
        shared_preload_libraries: pg_stat_statements
        rds.force_ssl: "1"                   # TLS required

  # -- Credentials in Secrets Manager ----------------------------------------
  RdsSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "/myapp/${AWS::StackName}/rds-credentials"
      GenerateSecretString:
        SecretStringTemplate: !Sub '{"username":"appuser"}'
        GenerateStringKey: password
        PasswordLength: 32
        ExcludeCharacters: '"@/\\'

  # -- RDS Instance -----------------------------------------------------------
  RdsInstance:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      DBInstanceClass:     !Ref DBInstanceClass
      Engine:              postgres
      EngineVersion:       "16"
      DBName:              !Ref DBName
      MasterUsername:      !Sub "{{resolve:secretsmanager:${RdsSecret}:SecretString:username}}"
      MasterUserPassword:  !Sub "{{resolve:secretsmanager:${RdsSecret}:SecretString:password}}"
      DBParameterGroupName: !Ref RdsParamGroup
      DBSubnetGroupName:   !Ref RdsSubnetGroup
      VPCSecurityGroups:   [!Ref RdsSg]
      MultiAZ:             false         # set true for prod
      StorageType:         gp3
      AllocatedStorage:    "20"
      StorageEncrypted:    true
      BackupRetentionPeriod: 7
      PubliclyAccessible:  false

  # -- Secrets Manager Rotation (every 30 days) -------------------------------
  RdsSecretRotation:
    Type: AWS::SecretsManager::RotationSchedule
    Properties:
      SecretId: !Ref RdsSecret
      HostedRotationLambda:
        RotationType:   PostgreSQLSingleUser
        RotationLambdaName: !Sub "SecretsManagerRotation-${AWS::StackName}"
        VpcSecurityGroupIds: !Ref RdsSg
        VpcSubnetIds: !Join [",", !Ref SubnetIds]
      RotationRules:
        AutomaticallyAfterDays: 30

Outputs:
  RdsEndpoint:    { Value: !GetAtt RdsInstance.Endpoint.Address }
  RdsPort:        { Value: !GetAtt RdsInstance.Endpoint.Port }
  RdsSecretArn:   { Value: !Ref RdsSecret }
```

**Why:** `DeletionPolicy: Snapshot` prevents accidental data loss on stack
delete. `rds.force_ssl: "1"` at the parameter group level enforces TLS even if
the connection string omits it. Hosted rotation Lambda handles credential
rotation without custom code.

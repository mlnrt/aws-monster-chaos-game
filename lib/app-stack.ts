import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { ChaosGameWebApp } from './app/webapp';
import { ChaosGameDynamodbTable } from "./app/dynamodb";

export interface AwsChaosGameStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class AwsChaosGameAppStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly webApp: ChaosGameWebApp;
  public readonly scoreTable: ITable;

  constructor(scope: Construct, id: string, props: AwsChaosGameStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    // DynamoDB Table to store the experiment results
    this.scoreTable = new ChaosGameDynamodbTable(this, 'FisExperimentTable', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    }).table;

    this.webApp = new ChaosGameWebApp(this, 'WebApp', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
      scoreTableName: this.scoreTable.tableName,
      scoreTableArn: this.scoreTable.tableArn,
    });
  }
}

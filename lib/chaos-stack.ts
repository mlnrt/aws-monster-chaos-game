import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ChaosGameFis } from './chaos/fis';
import { ChaosGameDynamodbTable } from "./chaos/dynamodb";
import { ChaosGameLambda } from "./chaos/lambda";

export interface AwsChaosGameFisStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class AwsChaosGameFisStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly fis: ChaosGameFis;

  constructor(scope: Construct, id: string, props: AwsChaosGameFisStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    // DynamoDB Table to store the experiment results
    const experimentTable = new ChaosGameDynamodbTable(this, 'FisExperimentTable', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });

    // Create the Fault Injection Simulator Experiments
    this.fis = new ChaosGameFis(this, 'Fis', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });
  }
}

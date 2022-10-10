import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { ChaosGameFis } from './chaos/fis';
import { ChaosGameFisStateMachine } from "./chaos/state-machine";

export interface AwsChaosGameFisStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly scoreTable: ITable;
}

export class AwsChaosGameFisStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly fis: ChaosGameFis;

  constructor(scope: Construct, id: string, props: AwsChaosGameFisStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;
    const scoreTable = props.scoreTable;


    // Create the Fault Injection Simulator Experiments
    this.fis = new ChaosGameFis(this, 'Fis', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });

    // Create the FIS state machine to start and monitor a FIS experiment
    new ChaosGameFisStateMachine(this, 'FisStateMachine', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
      scoreTable: scoreTable,
    });
  }
}

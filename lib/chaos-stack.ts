import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { AwsChaosGameAppStack } from './app-stack';
import { ChaosGameFis } from './chaos/fis';
import { ChaosGameFisStateMachine } from "./chaos/state-machine";
import { ChaosGameCwAlarm } from "./chaos/cloudwatch";

export interface AwsChaosGameFisStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly app: AwsChaosGameAppStack;
}

export class AwsChaosGameFisStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly fis: ChaosGameFis;
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: AwsChaosGameFisStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;
    const scoreTable = props.app.scoreTable;

    const alarm = new ChaosGameCwAlarm(this, 'Alarm', {
      prefix: this.prefix,
      loadBalancer: props.app.webApp.loadBalancer,
    });

    // Create the Fault Injection Simulator Experiments
    this.fis = new ChaosGameFis(this, 'Fis', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
      stopAlarm: alarm,
    });

    // Create the FIS state machine to start and monitor a FIS experiment
    const fisStateMachine = new ChaosGameFisStateMachine(this, 'FisStateMachine', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
      scoreTable: scoreTable,
      appUrl: `http://${props.app.webApp.loadBalancer.loadBalancerDnsName}${props.app.webApp.appPath}`,
    });
    this.stateMachine = fisStateMachine.stateMachine;
  }
}

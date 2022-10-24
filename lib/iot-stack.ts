import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { ITopicRule } from "@aws-cdk/aws-iot-alpha";
import { ChaosGameIot } from "./iot/iot";

export interface AwsChaosGameIotStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly fisStateMachine: StateMachine;
}

export class AwsChaosGameIotStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly iotTopicRule: ITopicRule;

  constructor(scope: Construct, id: string, props: AwsChaosGameIotStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    // Create the IoT Rule to start the FIS state machine
    const iotTopicRule = new ChaosGameIot(this, 'Iot', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
      fisStateMachine: props.fisStateMachine,
    });
    this.iotTopicRule = iotTopicRule.topicRule;
  }
}

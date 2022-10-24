import { Construct } from 'constructs';
import { RemovalPolicy } from "aws-cdk-lib";
import { TopicRule, ITopicRule, IotSql } from "@aws-cdk/aws-iot-alpha";
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { StepFunctionsAction } from "./step-function-action";

export interface ChaosGameIotProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly fisStateMachine: StateMachine;
}

export class ChaosGameIot extends Construct {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly topicRule: ITopicRule;

  constructor(scope: Construct, id: string, props: ChaosGameIotProps) {
    super(scope, id);

    this.prefix = props.prefix;
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;

    //
    // Crete the AWS IoT Topic Rule
    //
    this.topicRule = new TopicRule(this, 'TopicRule', {
      topicRuleName: `${this.prefix.replace(/-/g,'_')}_iot_topic_rule`,
      description: 'AWS IoT Topic Rule to trigger the FIS experiment',
      sql: IotSql.fromStringAsVer20160323(`SELECT * FROM '${this.prefix}/fis'`),
      actions: [ new StepFunctionsAction(props.fisStateMachine)],
    });

  }
}
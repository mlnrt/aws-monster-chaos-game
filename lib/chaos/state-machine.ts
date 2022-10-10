import { Construct } from 'constructs';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  StateMachine,
  StateMachineType,
  Wait,
  WaitTime,
  Choice,
  Condition,
  Succeed,
  Fail,
  CustomState
} from 'aws-cdk-lib/aws-stepfunctions';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { ChaosGameLambda } from "./lambda";

export interface ChaosGameFisStateMachineProps {
  readonly prefix: string;
  readonly removalPolicy: RemovalPolicy;
  readonly scoreTable: ITable;
}

export class ChaosGameFisStateMachine extends Construct {
  public readonly prefix: string;
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: ChaosGameFisStateMachineProps) {
    super(scope, id);

    this.prefix = props.prefix;

    // Create the Lambda function used to trigger the FIS experiments
    const triggerExperimentLambda = new ChaosGameLambda(this, 'TriggerFisLambda', {
      prefix: this.prefix,
      name: 'trigger-experiment',
      codePath: 'resources/lambdas/trigger_experiment',
      memorySize: 128,
      timeout: Duration.seconds(3),
      environment: {
        PROJECT_TAG: this.prefix,
      },
      additionalPolicyStatements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['fis:ListExperimentTemplates'],
          resources: [`*`]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['fis:StartExperiment', 'fis:TagResource'],
          resources: [
            `arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment-template/*`,
            `arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment/*`,
          ],
        })
      ]
    });

    // Create the Lambda function used to check the status of the FIS experiments
    const checkExperimentLambda = new ChaosGameLambda(this, 'CheckFisLambda', {
      prefix: this.prefix,
      name: 'check-experiment',
      codePath: 'resources/lambdas/check_experiment',
      memorySize: 128,
      timeout: Duration.seconds(3),
      additionalPolicyStatements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['fis:GetExperiment'],
          resources: [`arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment/*`],
          conditions: {
            StringEquals: {
              'aws:ResourceTag/Project': this.prefix,
            }
          }
        })
      ]
    });

    //
    // AWS Step Function State Machine for the FIS Experiments
    //
    // Create the CloudWatch Logs group for the state machine
    const fisStateMachineLogGroup = new LogGroup(this, 'logGroup', {
      logGroupName: `/aws/step-function/${this.prefix}-fis-state-machine/access`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //Create some Tasks for the State Machine
    const waitX = new Wait(this, 'Wait', { time: WaitTime.duration(Duration.seconds(30))});
    const success = new Succeed(this, 'Experiment Finished');
    const fail = new Fail(this, 'Experiment Failed');
    const winStateJson = {
      Type: 'Task',
      Resource: 'arn:aws:states:::dynamodb:updateItem',
      Parameters: {
        TableName: props.scoreTable.tableName,
        Key: {pk: { S: 'score' }},
        ExpressionAttributeValues: { ':inc': {N: '1'} },
        UpdateExpression: 'ADD wins :inc'
      },
      Next: 'Experiment Finished'
    };
    const updateWinDB = new CustomState(this, 'Update Win Score', {stateJson: winStateJson}).next(success);
    const looseStateJson = {
      Type: 'Task',
      Resource: 'arn:aws:states:::dynamodb:updateItem',
      Parameters: {
        TableName: props.scoreTable.tableName,
        Key: {pk: { S: 'score' }},
        ExpressionAttributeValues: { ':inc': {N: '1'} },
        UpdateExpression: 'ADD loses :inc'
      },
      Next: 'Experiment Finished'
    };
    const updateLooseDB = new CustomState(this, 'Update Loose Score', {stateJson: looseStateJson}).next(success);

    //Create the State Machine Definition
    const smDefinition = new LambdaInvoke(this, 'Trigger the Experiment', {
      lambdaFunction: triggerExperimentLambda.function,
      payloadResponseOnly: true,
    }).next(waitX)
      .next(new LambdaInvoke(this, 'Check the Experiment Status', {
        lambdaFunction: checkExperimentLambda.function,
        payloadResponseOnly: true
      }))
      .next(new Choice(this, 'Experiment Finished?')
        .when(Condition.or(
          Condition.stringEquals('$.experimentStatus', 'initiating'),
          Condition.stringEquals('$.experimentStatus', 'pending'),
          Condition.stringEquals('$.experimentStatus', 'running')
        ), waitX)
        .when(Condition.stringEquals('$.experimentStatus', 'completed'), updateWinDB)
        .when(Condition.stringEquals('$.experimentStatus', 'failed'), updateLooseDB)
        .otherwise(success));

    // Create the State Machine based on the definition
    this.stateMachine = new StateMachine(this, 'fisProcess', {
      definition: smDefinition,
      stateMachineName: `${this.prefix}-fis-process`,
      timeout: Duration.minutes(5),
      stateMachineType: StateMachineType.STANDARD,
      logs: {
        destination: fisStateMachineLogGroup,
      },
    });
    this.stateMachine.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:UpdateItem'],
        resources: [props.scoreTable.tableArn],
      }
    ));
  }
}
import { Construct } from 'constructs';
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { IRole, PolicyStatement, ServicePrincipal, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnExperimentTemplate } from "aws-cdk-lib/aws-fis";
import { ChaosGameIamFis } from "./iam";
import {ILogGroup, LogGroup, RetentionDays} from "aws-cdk-lib/aws-logs";

export enum ExperimentResourceType {
  ECS_STOP_TASK = 'aws:ecs:task',
  API_INTERNAL_ERROR = 'aws:iam:role',
}

interface ChaosGameFisExperimentProps {
  readonly prefix: string;
  readonly name: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly fisIamRoles: ChaosGameIamFis;
  readonly experimentResourceType: ExperimentResourceType;
}

class ChaosGameFisExperiment extends Construct {
  public readonly prefix: string;
  public readonly name: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly experiments: CfnExperimentTemplate[];
  public readonly experimentResourceType: ExperimentResourceType;
  public readonly logGroup: ILogGroup;

  constructor(scope: Construct, id: string, props: ChaosGameFisExperimentProps) {
    super(scope, id);

    this.prefix = props.prefix;
    this.name = props.name.toLowerCase();
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;
    this.experimentResourceType = props.experimentResourceType;

    this.logGroup = new LogGroup(this, 'ServiceLogGroup', {
      logGroupName: `/fis/${this.prefix}-${this.name}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: this.removalPolicy,
    });
  }
}

export interface ChaosGameFisFargateExperimentProps extends ChaosGameFisExperimentProps {
  readonly targetTask: string;
}

export class ChaosGameFisFargateExperiment extends ChaosGameFisExperiment {
  public readonly targetTask: string;

  constructor(scope: Construct, id: string, props: ChaosGameFisFargateExperimentProps) {
    super(scope, id, props);

    this.targetTask = props.targetTask;

    //
    // Fis Experiment on the ECS Fargate App Tasks
    //
    const logConfiguration = {
      logSchemaVersion: 1,
      cloudWatchLogsConfiguration: {
        LogGroupArn: this.logGroup.logGroupArn,
      }
    };
    const experimentActions = {
      'stopFargateTasks': {
        actionId: 'aws:ecs:stop-task',
        parameters: {},
        targets: {
          'Tasks': 'fargateTasks',
        }
      }
    }

    console.log(`${this.logGroup.logGroupArn.slice(0, -1)}log-stream:*`);
    this.logGroup.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      principals: [new ServicePrincipal('delivery.logs.amazonaws.com')],
      actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
      // The ARN of a log group is in the form of arn:aws:logs:region:account-id:log-group:log-group-name:*
      // so we must strip the last "*" from the ARN for the log stream ARN to be correct...
      // `${this.logGroup.logGroupArn.slice(0,-1)}log-stream:*` -> but does not work
      // `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/fis/${this.prefix}-${this.name}:log-stream:*`
      resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/fis/${this.prefix}-${this.name}:log-stream:*`],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': Stack.of(this).account,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:*`,
        }
      }
    }));

    // Experiment to stop ALL tasks of one of the Fargate Service
    const fisStopAllExperiment = new CfnExperimentTemplate(this, 'StopAllExperiment', {
      description: `FIS experiment to stop All ECS Fargate tasks from the ${this.targetTask} service`,
      roleArn: props.fisIamRoles.ecsExperimentRole.roleArn,
      stopConditions: [
        {source: 'none'}
      ],
      targets: {
        'fargateTasks': {
          resourceType: this.experimentResourceType,
          resourceTags: {
            'FargateService': `${this.prefix}-${this.targetTask.toLowerCase()}`
          },
          selectionMode: 'ALL',
        }
      },
      actions: experimentActions,
      logConfiguration: logConfiguration,
      tags: {
        Name: `${this.prefix}-Terminate All ECS Fargate Task from the ${this.targetTask} Service`,
        Project: this.prefix,
      }
    });
    //this.experiments.push(fisStopAllExperiment);

    // Experiment to stop ONE task randomly of one of the Fargate Service
    const fisStopOneExperiment = new CfnExperimentTemplate(this, 'StopOneExperiment', {
      description: `FIS experiment to stop one ECS Fargate tasks from the ${this.targetTask} service`,
      roleArn: props.fisIamRoles.ecsExperimentRole.roleArn,
      stopConditions: [
        {source: 'none'}
      ],
      targets: {
        'fargateTasks': {
          resourceType: this.experimentResourceType,
          resourceTags: {
            'FargateService': `${this.prefix}-${this.targetTask.toLowerCase()}`
          },
          selectionMode: 'COUNT(1)',
        }
      },
      actions: experimentActions,
      logConfiguration: logConfiguration,
      tags: {
        Name: `${this.prefix}-Terminate one ECS Fargate Task from the ${this.targetTask} Service`,
        Project: this.prefix,
      }
    });
  }
}
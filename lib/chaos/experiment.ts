import { Construct } from 'constructs';
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { IRole, PolicyStatement, ServicePrincipal, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnExperimentTemplate } from "aws-cdk-lib/aws-fis";
import { ILogGroup, LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ChaosGameIamFis } from "./iam";
import { ChaosGameCwAlarm } from "./cloudwatch";
import * as webappConfig from '../../webapp-config.json';

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
  readonly stopAlarm: ChaosGameCwAlarm;
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

    const stack = Stack.of(this);

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
      },
      'waitFewMins': {
        actionId: 'aws:fis:wait',
        parameters: {'duration': `PT${webappConfig.fis.numberOfEvaluationPeriods + 2}M`},
        startAfter: ['stopFargateTasks'],
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
      // `arn:aws:logs:${stack.region}:${stack.account}:log-group:/fis/${this.prefix}-${this.name}:log-stream:*`
      resources: [`arn:aws:logs:${stack.region}:${stack.account}:log-group:/fis/${this.prefix}-${this.name}:log-stream:*`],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': stack.account,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:logs:${stack.region}:${stack.account}:*`,
        }
      }
    }));

    // Experiment to stop ALL tasks of one of the Fargate Service
    const fisStopAllExperiment = new CfnExperimentTemplate(this, 'StopAllExperiment', {
      description: `FIS experiment to stop All ECS Fargate tasks from the ${this.targetTask} service`,
      roleArn: props.fisIamRoles.ecsExperimentRole.roleArn,
      stopConditions: [
        {
          source: 'aws:cloudwatch:alarm',
          value: props.stopAlarm.alarm.alarmArn,
        }
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
        {
          source: 'aws:cloudwatch:alarm',
          value: props.stopAlarm.alarm.alarmArn,
        }
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

export interface ChaosGameFisApiExperimentProps extends ChaosGameFisExperimentProps {
  readonly targetService: string;
  readonly targetIamRoles: IRole[];
}

export class ChaosGameFisApiExperiment extends ChaosGameFisExperiment {
  public readonly targetService: string;
  public readonly targetIamRoles: IRole[];

  constructor(scope: Construct, id: string, props: ChaosGameFisApiExperimentProps) {
    super(scope, id, props);

    this.targetService = props.targetService;
    this.targetIamRoles = props.targetIamRoles;

    //
    // Fis Experiment on the ECS Fargate App Tasks
    //
    const logConfiguration = {
      logSchemaVersion: 1,
      cloudWatchLogsConfiguration: {
        LogGroupArn: this.logGroup.logGroupArn,
      }
    };

    // Experiment to inject an API internal error
    const fisApiInternalErrorExperiment = new CfnExperimentTemplate(this, 'ApiInternalErrorExperiment', {
      description: `FIS experiment to inject an API internal error on the ${this.targetService} service`,
      roleArn: props.fisIamRoles.ecsExperimentRole.roleArn,
      stopConditions: [
        {
          source: 'aws:cloudwatch:alarm',
          value: props.stopAlarm.alarm.alarmArn,
        }
      ],
      targets: {
        'internalErrorRole': {
          resourceType: this.experimentResourceType,
          resourceArns: this.targetIamRoles.map(role => role.roleArn),
          selectionMode: 'ALL',
        }
      },
      actions: {
        'injectApiInternalError': {
          actionId: 'aws:fis:inject-api-internal-error',
          parameters: {
            'service': 'ec2',
            'operations': 'DescribeInstances',
            'percentage': '100',
            'duration': `PT${webappConfig.fis.numberOfEvaluationPeriods + 2}M`,
          },
          targets: {
            'Roles': 'internalErrorRole',
          }
        }
      },
      logConfiguration: logConfiguration,
      tags: {
        Name: `${this.prefix}-Inject an API internal error on the ${this.targetService} Service`,
        Project: this.prefix,
      }
    });
  }
}

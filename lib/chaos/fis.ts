import { Construct } from 'constructs';
import {RemovalPolicy, Stack} from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { ICluster } from "aws-cdk-lib/aws-ecs";
import {PolicyStatement, ServicePrincipal, Effect} from 'aws-cdk-lib/aws-iam';
import { CfnExperimentTemplate } from "aws-cdk-lib/aws-fis";
import { ChaosGameIamFis } from "./iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

export interface ChaosGameFisProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class ChaosGameFis extends Construct {
  public readonly prefix: string;
  public readonly namespace: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly experiments: CfnExperimentTemplate[];

  constructor(scope: Construct, id: string, props: ChaosGameFisProps) {
    super(scope, id);

    this.prefix = props.prefix;

    const fisIamRoles = new ChaosGameIamFis(this, 'FisIamRole', {
      prefix: this.prefix,
    });

    //
    // Fis Experiment on the ECS Fargate App Tasks
    //
    // TODO: use the exports of the previous stack
    const fargateTasks = ['App', 'Nginx'];
    fargateTasks.forEach((task) => {
      const fisFargateLogs = new LogGroup(this, `${task}ServiceLogGroup`, {
        logGroupName: `/fis/${this.prefix}-fargate-${task.toLowerCase()}`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: this.removalPolicy,
      });
      fisFargateLogs.addToResourcePolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        principals:[new ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
        resources: [`${fisFargateLogs.logGroupArn}:log-stream:*`],
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
      const fisStopAllExperiment = new CfnExperimentTemplate(this, `Fis${task}StopAllExperiment`, {
        description: `FIS experiment to stop All ECS Fargate tasks from the ${task} service`,
        roleArn: fisIamRoles.ecsExperimentRole.roleArn,
        stopConditions: [
          {source: 'none'}
        ],
        targets: {
          'fargateTasks': {
            resourceType: 'aws:ecs:task',
            resourceTags: {
              'FargateService': `${this.prefix}-${task.toLowerCase()}`
            },
            selectionMode: 'ALL',
          }
        },
        actions: {
          'stopFargateTasks': {
            actionId: 'aws:ecs:stop-task',
            parameters: {},
            targets: {
              'Tasks': 'fargateTasks',
            }
          }
        },
        tags: {Name: `Terminate All ECS Fargate Task from the ${task} Service`},
        logConfiguration: {
          logSchemaVersion: 1,
          cloudWatchLogsConfiguration: {
            LogGroupArn: fisFargateLogs.logGroupArn,
          }
        }
      });
      //this.experiments.push(fisStopAllExperiment);

      // Experiment to stop ONE task randomly of one of the Fargate Service
      const fisStopRandomExperiment = new CfnExperimentTemplate(this, `Fis${task}StopOneExperiment`, {
        description: `FIS experiment to stop one ECS Fargate tasks from the ${task} service`,
        roleArn: fisIamRoles.ecsExperimentRole.roleArn,
        stopConditions: [
          {source: 'none'}
        ],
        targets: {
          'fargateTasks': {
            resourceType: 'aws:ecs:task',
            resourceTags: {
              'FargateService': `${this.prefix}-${task.toLowerCase()}`
            },
            selectionMode: 'COUNT(1)',
          }
        },
        actions: {
          'stopFargateTasks': {
            actionId: 'aws:ecs:stop-task',
            parameters: {},
            targets: {
              'Tasks': 'fargateTasks',
            }
          }
        },
        tags: {Name: `Terminate one ECS Fargate Task from the ${task} Service`},
        logConfiguration: {
          logSchemaVersion: 1,
          cloudWatchLogsConfiguration: {
            LogGroupArn: fisFargateLogs.logGroupArn,
          }
        }
      });
      //this.experiments.push(fisStopRandomExperiment);
    });
  }
}
import { Construct } from 'constructs';
import { Stack } from "aws-cdk-lib";
import { IRole, Role, ServicePrincipal, PolicyDocument, Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export interface ChaosGameFisIamProps {
  readonly prefix: string;
}

export class ChaosGameIamFis extends Construct {
  public readonly prefix: string;
  public readonly namespace: string;
  public readonly ecsExperimentRole: IRole;

  constructor(scope: Construct, id: string, props: ChaosGameFisIamProps) {
    super(scope, id);

    this.prefix = props.prefix;

    // Policy to allow FIS to use the AWS FIS actions for fault injection for experiments part of this project
    const mainFisPolicy = new Policy(this, 'Policy', {
      policyName: `${this.prefix}-fis-policy`,
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            sid: 'AllowFISExperimentRoleFaultInjectionActions',
            effect: Effect.ALLOW,
            actions: ['fis:InjectApiInternalError', 'fis:InjectApiThrottleError', 'fis:InjectApiUnavailableError'],
            resources: [`arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment/${this.prefix}*`],
            conditions: {
              StringEquals: {
                'aws:ResourceTag/Project': this.prefix,
              }
            }
          }),
          new PolicyStatement({
            sid: 'AllowCloudWatchLogDelivery',
            effect: Effect.ALLOW,
            actions: ['logs:CreateLogDelivery'],
            resources: ['*'],
          }),
          new PolicyStatement({
            sid: 'AllowCloudWatchLogsActions',
            effect: Effect.ALLOW,
            actions: ['logs:PutResourcePolicy', 'logs:DescribeResourcePolicies', 'logs:DescribeLogGroups'],
            resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/fis/${this.prefix}-*`],
          }),
        ],
      })
    });

    // Create an IAM Role for the Fault Injection Simulator (FIS) service for the ECS experiments
    this.ecsExperimentRole = new Role(this, 'fisRole', {
      roleName: `${this.prefix}-fis-role`,
      assumedBy: new ServicePrincipal( 'fis.amazonaws.com'),
    });
    this.ecsExperimentRole.attachInlinePolicy(mainFisPolicy);

    // Policy to allow FIS to mess-up with ECS Tasks
    this.ecsExperimentRole.attachInlinePolicy(new Policy(this, 'FisEcsPolicy', {
      policyName: `${this.prefix}-fis-ecs-policy`,
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            sid: 'AllowFISExperimentRoleECSUpdateState',
            effect: Effect.ALLOW,
            actions: ['ecs:UpdateContainerInstancesState'],
            resources: [`arn:aws:ecs:${Stack.of(this).region}:${Stack.of(this).account}:container-instance/*`],
          }),
          new PolicyStatement({
            sid: 'AllowFISExperimentRoleECSStopTask',
            effect: Effect.ALLOW,
            actions: ['ecs:StopTask'],
            resources: [`arn:aws:ecs:${Stack.of(this).region}:${Stack.of(this).account}:task/*`],
            conditions: {
              StringEquals: {
                'aws:ResourceTag/FargateService': [`${this.prefix}-app`, `${this.prefix}-nginx`],
              }
            }
          }),
        ],
      })
    }));

  }
}
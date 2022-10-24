import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from '@aws-cdk/aws-iot-alpha';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { CommonActionProps } from '@aws-cdk/aws-iot-actions-alpha/lib/common-action-props';
import { singletonActionRole } from '@aws-cdk/aws-iot-actions-alpha/lib/private/role';

/**
 * Configuration properties of a Step Functions action.
 */
export interface StepFunctionsActionProps extends CommonActionProps {
  /**
   * Specifies the State Machine execution name prefix.
   *
   * @default false
   */
  readonly executionNamePrefix?: string
}

/**
 * The action to trigger an AWS Step Function state machine, passing in an MQTT message.
 */
export class StepFunctionsAction implements iot.IAction {
  private readonly role?: iam.IRole;
  private readonly stateMachine: stepfunctions.StateMachine;
  private readonly executionNamePrefix?: string;

  /**
   * @param stateMachine The Amazon Step Function to be triggered.
   * @param props Optional properties to not use default
   */
  constructor(stateMachine: stepfunctions.StateMachine, props: StepFunctionsActionProps = {}) {
    this.stateMachine = stateMachine;
    this.role = props.role;
    this.executionNamePrefix = props.executionNamePrefix;
  }

  /**
   * @internal
   */
  public _bind(rule: iot.ITopicRule): iot.ActionConfig {
    const role = this.role ?? singletonActionRole(rule);
    role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [this.stateMachine.stateMachineArn],
    }));

    return {
      configuration: {
        stepFunctions: {
          stateMachineName: this.stateMachine.stateMachineName,
          executionNamePrefix: this.executionNamePrefix,
          roleArn: role.roleArn,
        },
      },
    };
  }
}
import { Construct } from 'constructs';
import { RemovalPolicy } from "aws-cdk-lib";
import { CfnExperimentTemplate } from "aws-cdk-lib/aws-fis";
import { ChaosGameIamFis } from "./iam";
import { ChaosGameFisFargateExperiment, ExperimentResourceType } from "./experiment";

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
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;

    const fisIamRoles = new ChaosGameIamFis(this, 'IamRole', {
      prefix: this.prefix,
    });

    //
    // Fis Experiment on the ECS Fargate App Tasks
    //
    // TODO: use the exports of the previous stack
    const fargateTasks = ['App', 'Nginx'];
    fargateTasks.forEach((task) => {
      new ChaosGameFisFargateExperiment(this, task, {
        prefix: this.prefix,
        name: task,
        removalPolicy: this.removalPolicy,
        fisIamRoles: fisIamRoles,
        experimentResourceType: ExperimentResourceType.ECS_STOP_TASK,
        targetTask: task,
      });

    });
  }
}
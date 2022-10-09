import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { ChaosGameFis } from './chaos/fis';
import { ChaosGameDynamodbTable } from "./chaos/dynamodb";
import { ChaosGameLambda } from "./chaos/lambda";

export interface AwsChaosGameFisStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class AwsChaosGameFisStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly fis: ChaosGameFis;

  constructor(scope: Construct, id: string, props: AwsChaosGameFisStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    // DynamoDB Table to store the experiment results
    const experimentTable = new ChaosGameDynamodbTable(this, 'FisExperimentTable', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });

    // Create the Fault Injection Simulator Experiments
    this.fis = new ChaosGameFis(this, 'Fis', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });

    // Create the Lambda function used to trigger the FIS experiments
    const lambda = new ChaosGameLambda(this, 'TriggerFisLambda', {
      prefix: this.prefix,
      name: 'trigger-experiment',
      codePath: 'resources/lambdas/trigger_experiment',
      memorySize: 256,
      timeout: Duration.seconds(60),
    });
    // Add the permissions for the Lambda Function to trigger the FIS experiments part of this project
    const lambdaPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['fis:ListExperimentTemplates', 'fis:StartExperiment', 'fis:StopExperiment'],
      resources: [
        `arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment-template/${this.prefix}*`,
        `arn:aws:fis:${Stack.of(this).region}:${Stack.of(this).account}:experiment/${this.prefix}*`,
      ],
      conditions: {
        StringEquals: {
          'aws:ResourceTag/Project': this.prefix,
        }
      }
    });
    lambda.function.addToRolePolicy(lambdaPolicyStatement);

  }
}

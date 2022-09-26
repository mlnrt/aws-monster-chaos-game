import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ChaosGameWebApp} from "./webapp/webapp";

export interface AwsChaosGameStackProps extends StackProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class AwsChaosGameStack extends Stack {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;

  constructor(scope: Construct, id: string, props: AwsChaosGameStackProps) {
    super(scope, id, props);

    this.prefix = props.prefix;
    this.removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    const webapp = new ChaosGameWebApp(this, 'WebApp', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });
  }
}

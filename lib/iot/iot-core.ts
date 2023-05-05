import { Construct } from 'constructs';
import { RemovalPolicy } from "aws-cdk-lib";
import { ThingWithCert } from 'cdk-iot-core-certificates';

export interface ChaosGameIotCoreProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly iotTopicName: string;
}

export class ChaosGameIotCore extends Construct {
  public readonly prefix: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly iotClientName: string;
  public readonly iotThingArn: string;

  constructor(scope: Construct, id: string, props: ChaosGameIotCoreProps) {
    super(scope, id);

    this.prefix = props.prefix;
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;
    this.iotClientName = `${this.prefix}-monster`;

    // Create the IoT Certificate and stores the certificate files in the local /certs directory
    // references:
    // How to create IOT thing with certificate and policy: https://github.com/aws/aws-cdk/issues/19303
    // CDK IoT Core Certificates: https://github.com/devops-at-home/cdk-iot-core-certificates
    const monsterThing = new ThingWithCert(this, 'Monster', {
      thingName: this.iotClientName,
      saveToParamStore: true,
      paramPrefix: `iot/certs`,
    });
    this.iotThingArn = monsterThing.thingArn;
  }
}

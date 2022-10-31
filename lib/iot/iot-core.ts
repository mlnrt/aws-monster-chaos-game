import { Construct } from 'constructs';
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { CfnPolicy } from "aws-cdk-lib/aws-iot";
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
  public readonly iotPolicy: CfnPolicy;

  constructor(scope: Construct, id: string, props: ChaosGameIotCoreProps) {
    super(scope, id);

    this.prefix = props.prefix;
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;
    this.iotClientName = `${this.prefix}-monster`;

    const stack = Stack.of(this);

    //
    // IoT Security Configuration
    //
    // Create the IoT Security Policy
    this.iotPolicy = new CfnPolicy(this, 'MyCfnPolicy', {
      policyName: `${this.prefix}-iot-policy`,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowIotDeviceConnection',
            Effect: 'Allow',
            Action: ['iot:Connect'],
            Resource: [`arn:aws:iot:${stack.region}:${stack.account}:client/${this.iotClientName}`],
          },
          {
            Sid: 'AllowPublishOnIotTopic',
            Effect: 'Allow',
            Action: ['iot:Publish'],
            Resource: [`arn:aws:iot:${stack.region}:${stack.account}:topic/${props.iotTopicName}`],
          }
        ]
      },
    });

    // Create the IoT Certificate and stores the certificate files in the local /certs directory
    // references:
    // How to create IOT thing with certificate and policy: https://github.com/aws/aws-cdk/issues/19303
    // CDK IoT Core Certificates: https://github.com/devops-at-home/cdk-iot-core-certificates
    const monsterThing = new ThingWithCert(this, 'Monster', {
      thingName: this.iotClientName,
      saveToParamStore: true,
      paramPrefix: `/iot/certs`,
    });
  }
}
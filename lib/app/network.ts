import { Construct } from 'constructs';
import {
  IVpc,
  Vpc,
  SubnetType,
  ISecurityGroup,
  SecurityGroup,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
  IpAddresses,
} from 'aws-cdk-lib/aws-ec2';

export interface ChaosGameWebAppNetworkProps {
  readonly prefix: string;
  readonly vpcCider?: string;
}

export class ChaosGameWebAppNetwork extends Construct {
  public readonly prefix: string;
  public readonly vpc: IVpc;
  public readonly appNsg: ISecurityGroup;

  constructor(scope: Construct, id: string, props: ChaosGameWebAppNetworkProps) {
    super(scope, id);

    this.prefix = props.prefix;

    //
    // VPC
    //
    // Setup the VPC and subnets
    const vpcCider = props.vpcCider || '10.0.0.0/20'
    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: `${this.prefix}-webapp-vpc`,
      maxAzs: 3,
      ipAddresses: IpAddresses.cidr(vpcCider),
      natGateways: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'ReverseProxy',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Application',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    this.appNsg = new SecurityGroup( this, `AppServiceSecurityGroup`, {
      securityGroupName: `${this.prefix}-app-NSG`,
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    // To run a Fargate Task in a private isolated Subnets the following VPC Endpoints are required:
    // - Gateway Endpoint for S3
    // - Interface Endpoint for ecr.api
    // - Interface Endpoint for ecr.docker
    // - Interface Endpoint for CloudWatch
    // - Interface Endpoint for CloudWatch logs (when logging to CloudWatch)
    // - Interface Endpoint for X-Ray
    // https://aws.amazon.com/premiumsupport/knowledge-center/ecs-fargate-tasks-pending-state/
    // Add CloudWatch and CloudWatch Logs Endpoints for the Fargate Application containers in the isolated subnets
    this.vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      privateDnsEnabled: true,
    });

    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      privateDnsEnabled: true,
    });

    // Add the ECR endpoint to be able to access the ECR repository containing the Docker images
    this.vpc.addInterfaceEndpoint('EcrApiEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    });

    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Add the X-Ray endpoint to be able to send traces to X-Ray
    this.vpc.addInterfaceEndpoint('XRayEndpoint', {
      service: InterfaceVpcEndpointAwsService.XRAY,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Add the S3 Gateway Endpoint
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }]
    });

    // Add DynamoDB Gateway Endpoint
    this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }]
    });
  }
}

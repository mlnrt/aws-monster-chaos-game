import { Construct } from 'constructs';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { Vpc, IVpc, SubnetType, SecurityGroup, Port, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService } from 'aws-cdk-lib/aws-ec2';
import {
  Cluster,
  ICluster,
  ContainerImage,
  IFargateService,
  FargateService,
  FargateTaskDefinition,
  CpuArchitecture,
  OperatingSystemFamily,
  AwsLogDriver,
  Protocol,
} from 'aws-cdk-lib/aws-ecs';
import { IApplicationLoadBalancer, IApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { PrivateDnsNamespace, DnsRecordType } from 'aws-cdk-lib/aws-servicediscovery';
import { WebAppImage } from './webapp-image';
import * as webappConfig from '../../webapp-config.json';

export interface ChaosGameWebAppProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly workerCpu?: number;
  readonly workerMemoryMiB?: number;
  readonly vpcCider?: string;
}

export class ChaosGameWebApp extends Construct {
  public readonly prefix: string;
  public readonly namespace: string;
  public readonly removalPolicy: RemovalPolicy;
  public readonly vpc: IVpc;
  public readonly webAppNamespace: PrivateDnsNamespace;
  public readonly ecsCluster: ICluster;
  public readonly nginxLoadBalancer: IApplicationLoadBalancer;
  public readonly nginxListener: IApplicationListener;
  public readonly nginxFargateService: IFargateService;
  public readonly appFargateService: IFargateService;

  constructor(scope: Construct, id: string, props: ChaosGameWebAppProps) {
    super(scope, id);

    this.prefix = props.prefix;
    this.namespace = webappConfig.app.namespace;
    this.removalPolicy = this.removalPolicy || RemovalPolicy.DESTROY;

    //
    // VPC
    //
    // Setup the VPC and subnets
    const vpcCider = props.vpcCider || '10.0.0.0/20'
    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: `${this.prefix}-webapp-vpc`,
      maxAzs: 3,
      cidr: vpcCider,
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

    const appNSG = new SecurityGroup( this, `AppServiceSecurityGroup`, {
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
    });

    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }]
    });

    //
    // Application Cloud Map Namespace
    //
    this.webAppNamespace = new PrivateDnsNamespace(this, 'DnsNamespace',
      {
        name: this.namespace,
        vpc: this.vpc,
        description: 'Private DnsNamespace for the App Microservices',
      }
    );

    //
    // ECS base components
    //
    // Setup the ECS cluster and Fargate Task
    this.ecsCluster = new Cluster(this, 'EcsCluser', {
      clusterName: `${this.prefix}-webapp-cluster`,
      vpc: this.vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    //ECR Image
    const appImage = new WebAppImage(this, 'AppImage', {
      prefix: this.prefix,
      removalPolicy: this.removalPolicy,
    });

    // CloudWatch LogGroup for the web app task
    const webAppLogGroup = new LogGroup(this, 'AppServiceLogGroup',
      {
        logGroupName: `/ecs/${this.prefix}-app-service`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: this.removalPolicy,
      }
    );

    //
    // Fargate Service for the Application
    //
    // Create a Fargate service for the application
    const appTaskDefinition = new FargateTaskDefinition(this, 'AppTaskDefinition', {
      cpu: props.workerCpu || 256,
      memoryLimitMiB: props.workerMemoryMiB || 512,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64
      }
    });
    const appContainer = appTaskDefinition.addContainer('AppContainer', {
      containerName: `${this.prefix}-app-task`,
      image: ContainerImage.fromEcrRepository(appImage.ecrRepo, 'app-latest'),
      logging: new AwsLogDriver({
        logGroup: webAppLogGroup,
        streamPrefix: `${this.prefix}-app-service`,
      }),
      healthCheck:{
        command: ['CMD-SHELL', `curl -f http://localhost:${webappConfig.app.port}${webappConfig.app.healthCheckPath} || exit 1`],
      },
      portMappings:[{
        containerPort: webappConfig.app.port,
        protocol: Protocol.TCP,
      }]
    });

    this.appFargateService = new FargateService(this, 'AppFargateService', {
      serviceName: `${this.prefix}-app-service`,
      cluster: this.ecsCluster,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      taskDefinition: appTaskDefinition,
      securityGroups: [appNSG],
      assignPublicIp: false,
      desiredCount: 3,
      cloudMapOptions: {
        // This will be your service_name.namespace
        name: 'app',
        cloudMapNamespace: this.webAppNamespace,
        dnsRecordType: DnsRecordType.A,
        container: appContainer,
        containerPort: webappConfig.app.port,
        dnsTtl: Duration.seconds(30),
      },
    });

    //
    // Fargate Service for the Application
    //
    // Create a public facing load-balanced Fargate service for the Nginx reverse proxy
    const nginx = new ApplicationLoadBalancedFargateService(this, 'NginxFargateService', {
      loadBalancerName: `${this.prefix}-nginx-lb`,
      serviceName: `${this.prefix}-nginx-service`,
      cluster: this.ecsCluster,
      taskSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      cpu: props.workerCpu || 256,
      memoryLimitMiB: props.workerMemoryMiB || 512,
      desiredCount: 3,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64
      },
      taskImageOptions: {
        containerName: `${this.prefix}-nginx-task`,
        image: ContainerImage.fromEcrRepository(appImage.ecrRepo, 'nginx-latest'),
        containerPort: webappConfig.nginx.port,
        enableLogging: true,
        logDriver: new AwsLogDriver({
          logGroup: webAppLogGroup,
          streamPrefix: `${this.prefix}-nginx-service`,
        }),
      },
      publicLoadBalancer: true,
    });
    nginx.targetGroup.configureHealthCheck({
      path: webappConfig.nginx.healthCheckPath,
      // interval: Duration.seconds(30),
      // unhealthyThresholdCount: 3,
    });

    // Add an incoming rule to the Application NSG to allow incoming traffic from the NSG of the Nginx load balancer
    appNSG.addIngressRule(nginx.service.connections.securityGroups[0], Port.tcp(webappConfig.app.port), 'Allow Nginx to access the App');

    this.nginxLoadBalancer = nginx.loadBalancer;
    this.nginxListener = nginx.listener;
    this.nginxFargateService = nginx.service;
  }
}

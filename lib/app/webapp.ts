import { Construct } from 'constructs';
import { RemovalPolicy, Duration, Tags } from 'aws-cdk-lib';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { IVpc, SubnetType, Port } from 'aws-cdk-lib/aws-ec2';
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
  PropagatedTagSource,
} from 'aws-cdk-lib/aws-ecs';
import { IApplicationLoadBalancer, IApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { IPrivateDnsNamespace, PrivateDnsNamespace, DnsRecordType } from 'aws-cdk-lib/aws-servicediscovery';
import { ChaosGameWebAppNetwork } from './network';
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
  public readonly webAppNamespace: IPrivateDnsNamespace;
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
    const chaosGameAppNetwork = new ChaosGameWebAppNetwork(this, 'Network', {
      prefix: this.prefix,
      vpcCider: vpcCider
    });
    this.vpc = chaosGameAppNetwork.vpc

    //
    // Application Cloud Map Namespace
    //
    this.webAppNamespace = new PrivateDnsNamespace(this, 'DnsNamespace', {
        name: this.namespace,
        vpc: this.vpc,
        description: 'Private DnsNamespace for the App Microservices',
      });

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
    const webAppLogGroup = new LogGroup(this, 'AppServiceLogGroup', {
      logGroupName: `/ecs/${this.prefix}-app-service`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: this.removalPolicy,
    });

    // IAM Role for both Fargate tasks to give access to publish metrics to X-Ray
    const taskRole = new Role(this, 'FargateTaskRole', {
      roleName: `${this.prefix}-fargate-task-role`,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com')
    });
    taskRole.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
    });
    taskRole.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess'
    });

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
      },
      taskRole: taskRole,
    });

    const appContainer = appTaskDefinition.addContainer('AppContainer', {
      containerName: `${this.prefix}-app-task`,
      image: ContainerImage.fromEcrRepository(appImage.ecrRepo, 'app-latest'),
      logging: new AwsLogDriver({
        logGroup: webAppLogGroup,
        streamPrefix: `${this.prefix}-app-service`,
      }),
      healthCheck:{
        command: [
          'CMD-SHELL',
          `curl -f http://localhost:${webappConfig.app.port}${webappConfig.app.healthCheckPath} || exit 1`
        ],
      },
      portMappings:[{
          containerPort: webappConfig.app.port,
          protocol: Protocol.TCP,
      }]
    });
    // Add the X-Ray daemon as a sidecar container
    appTaskDefinition.addContainer('xray', {
      image: ContainerImage.fromEcrRepository(appImage.ecrRepo, 'xray-latest'),
      cpu: 32,
      memoryReservationMiB: 256,
      essential: false,
      portMappings: [{
        containerPort: 2000,
        protocol: Protocol.UDP,
      }],
    });

    this.appFargateService = new FargateService(this, 'AppFargateService', {
      serviceName: `${this.prefix}-app-service`,
      cluster: this.ecsCluster,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      taskDefinition: appTaskDefinition,
      securityGroups: [chaosGameAppNetwork.appNsg],
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
      propagateTags: PropagatedTagSource.SERVICE,
    });
    Tags.of(this.appFargateService).add('FargateService', `${this.prefix}-app`);

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
        taskRole: taskRole
      },
      publicLoadBalancer: true,
      propagateTags: PropagatedTagSource.SERVICE,
    });

    // Configure the Health Check for the ALB
    nginx.targetGroup.configureHealthCheck({
      path: webappConfig.nginx.healthCheckPath,
    });

    // Add an incoming rule to the Application NSG to allow incoming traffic from the NSG of the Nginx load balancer
    chaosGameAppNetwork.appNsg.addIngressRule(
      nginx.service.connections.securityGroups[0],
      Port.tcp(webappConfig.app.port),
      'Allow Nginx to access the App'
    );

    // Add Fargate Service and Tasks Tags
    Tags.of(nginx.service).add('FargateService', `${this.prefix}-nginx`);

    this.nginxLoadBalancer = nginx.loadBalancer;
    this.nginxListener = nginx.listener;
    this.nginxFargateService = nginx.service;
  }
}

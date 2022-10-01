import * as path from 'path';
import { Construct } from 'constructs';
import { Duration, CustomResource, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Code, SingletonFunction } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Repository, TagMutability, IRepository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import * as webappConfig from '../../webapp-config.json';


// Custom Resource to clean up the ECR Repository when destroying the stack
interface cleanupEcrRepoProps {
  readonly prefix: string;
  readonly ecrRepositoryName: string;
  readonly ecrRepositoryArn: string;
}

export class cleanupEcrRepo extends Construct {

  constructor(scope: Construct, id: string, props: cleanupEcrRepoProps) {
    super(scope, id);

    const connectionPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ecr:ListImages', 'ecr:BatchDeleteImage'],
      resources: [props.ecrRepositoryArn],
    });

    const customResourceLambda = new SingletonFunction(this, 'Singleton', {
      functionName: `${props.prefix}-cleanup-ecr-images`,
      lambdaPurpose: 'CustomResourceToCleanupEcrImages',
      uuid: '54gf6lx0-r58g-88j5-d44t-l40cef953pqn',
      code: Code.fromAsset('resources/lambdas/cleanup_ecr'),
      handler: 'main.lambda_handler',
      environment: {
        ECR_REPOSITORY_NAME: props.ecrRepositoryName,
      },
      timeout: Duration.seconds(60),
      runtime: Runtime.PYTHON_3_9,
      logRetention: RetentionDays.ONE_WEEK,
    });
    customResourceLambda.addToRolePolicy(connectionPolicy);

    new CustomResource(this, 'Resource', {
      serviceToken: customResourceLambda.functionArn,
    });
  }
}


interface WebAppImageProps {
  readonly prefix: string;
  readonly removalPolicy?: RemovalPolicy;
}

export class WebAppImage extends Construct {
  public readonly prefix: string;
  public readonly ecrRepo: IRepository;

  constructor(scope: Construct, id: string, props: WebAppImageProps) {
    super(scope, id);

    this.prefix = props.prefix;
    const removalPolicy = props.removalPolicy || RemovalPolicy.DESTROY;

    //
    // ECR
    //
    // Setup ECR Repository
    this.ecrRepo = new Repository(this, 'EcrRepo', {
      repositoryName: `${this.prefix}-repository`,
      imageTagMutability: TagMutability.MUTABLE,
      imageScanOnPush: true,
      removalPolicy: removalPolicy,
    });

    // Docker Image for the Nginx Reverse Proxy
    const nginxAsset = new DockerImageAsset(this, 'NginxImage', {
      directory: path.join(__dirname, '../../resources/services/nginx'),
      platform: Platform.LINUX_ARM64,
      buildArgs: {
        nginx_port: webappConfig.nginx.port.toString(),
        nginx_health_check_path: webappConfig.nginx.healthCheckPath,
        app_name: webappConfig.app.name,
        app_path: webappConfig.app.path,
        app_namespace: webappConfig.app.namespace,
        app_port: webappConfig.app.port.toString(),
      }
    });
    new ecrdeploy.ECRDeployment(this, 'DeployNginxImage', {
      src: new ecrdeploy.DockerImageName(nginxAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(`${this.ecrRepo.repositoryUri}:nginx-latest`),
    });

    // Docker Image for the Application
    const appAsset = new DockerImageAsset(this, 'AppImage', {
      directory: path.join(__dirname, '../../resources/services/app'),
      platform: Platform.LINUX_ARM64,
      buildArgs: {
        app_path: webappConfig.app.path,
        app_port: webappConfig.app.port.toString(),
        app_health_check_path: webappConfig.app.healthCheckPath,
      }
    });
    new ecrdeploy.ECRDeployment(this, 'DeployAppImage', {
      src: new ecrdeploy.DockerImageName(appAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(`${this.ecrRepo.repositoryUri}:app-latest`),
    });

    // Docker Image for the X-Ray sidecar
    const xrayAsset = new DockerImageAsset(this, 'XrayImage', {
      directory: path.join(__dirname, '../../resources/services/xray'),
      platform: Platform.LINUX_ARM64,
    });
    new ecrdeploy.ECRDeployment(this, 'DeployXrayImage', {
      src: new ecrdeploy.DockerImageName(xrayAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(`${this.ecrRepo.repositoryUri}:xray-latest`),
    });

    // Custom Resource to clean up ECR Repository
    if (removalPolicy === RemovalPolicy.DESTROY) {
      new cleanupEcrRepo(this, 'CleanupEcrRepo', {
        prefix: this.prefix,
        ecrRepositoryName: this.ecrRepo.repositoryName,
        ecrRepositoryArn: this.ecrRepo.repositoryArn,
      });
    }
  }
}
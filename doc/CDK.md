# Deploy the Stacks on AWS
## What are the Prerequisites?
The list below is for _Windows_ environment
* Clone this repository
* The AWS CLI ([documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
* Docker Desktop ([Documentation](https://docs.docker.com/desktop/windows/install/))
* NPM and Node.js ([Documenttaion](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm))
* The AWS CDK: `npm install -g aws-cdk`

## Deployment
If you have multiple AWS CLI configuration profiles use the `--profile <your profile name>` to use it for authentication.

Bootsrap the CDK
```
cdk bootstrap aws://<account number>/<aws region>
```

e.g.
```
cdk bootstrap aws://123456789012/eu-west-1
```


Install the Node.js modules defined in the package.json file
```
npm install
```

Verify the stack before deployment
```
cdk synth
```

Deploy the stack
```
cdk deploy --all
```

## How to Destroy all resources?
Destroy the stack
```
cdk destroy --all
```

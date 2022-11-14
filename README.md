# The AWS Monster Chaos Game
This is a chaos engineering game for AWS developed using the AWS CDK and an 
[Adafruit Pyportal](https://www.adafruit.com/product/4116) microcontroller. It includes:
* A 4 tiers 3 AZs simple web application stack
* A chaos engineering stack to inject failures into the web application stack
* An IoT Stack to register an Adafruit PyPortal microcontroller to AWS IoT Core and trigger chaos experiments 
* A Circuit Python Game for Adafruit PyPortal microcontroller

## The Architecture
![](doc/images/aws-chaos-game.jpg)

## What are the Prerequisites?
The list below is for _Windows_ environment
* Clone this repository
* The AWS CLI ([documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
* Docker Desktop ([Documentation](https://docs.docker.com/desktop/windows/install/))
* NPM and Node.js ([Documenttaion](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm))
* The AWS CDK: `npm install -g aws-cdk`

If you want the full experiment, you will need an Adafruit PyPortal which you can purchase 
[here](https://www.adafruit.com/product/4116). But if you don't have you can still deploy the stacks and trigger 
manually the AWS Step Function to inject failures into the web application stack.

## Setup
1. Setup your Adafruit PyPortal. Please refer to this [README](doc/PYPORTAL.md)
2. Deploy the Stacks on AWS. Please refer to this [README](doc/CDK.md)

## Code References
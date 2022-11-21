# The AWS Monster Chaos Game
This is a chaos engineering game for AWS developed using the AWS CDK and an 
[Adafruit Pyportal](https://www.adafruit.com/product/4116) microcontroller. It includes:
* A 4 tiers, 3 AZs simple web application stack
* A chaos engineering stack to inject failures into the web application stack
* An IoT Stack to register an Adafruit PyPortal microcontroller to AWS IoT Core and trigger chaos experiments 
* A Circuit Python Game for Adafruit PyPortal microcontroller

## The Architecture
![](doc/images/aws-chaos-game.jpg)

## The Demo
Here is a demo of the game in action:

[![AWS Monster Chaos Game - The Demo](https://img.youtube.com/vi/YED9DnyLUPM/0.jpg)](https://www.youtube.com/watch?v=YED9DnyLUPM)

## Want to Play the Game by Yourself?
### The Prerequisites?
The list below is for _Windows_ environment
* Clone this repository
* The AWS CLI ([documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
* Docker Desktop ([Documentation](https://docs.docker.com/desktop/windows/install/))
* NPM and Node.js ([Documenttaion](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm))
* The AWS CDK: `npm install -g aws-cdk`

If you want the full experience, you will need an Adafruit PyPortal which you can purchase 
[here](https://www.adafruit.com/product/4116). But if you don't have one, you can still deploy the stacks and trigger 
manually the AWS Step Function to inject failures into the web application stack.

## The Setup
1. Setup your Adafruit PyPortal. Please refer to this [README](doc/PYPORTAL.md)
2. __(Optional)__ You can edit some configuration about the application in the `webapp-config.json` file. These 
parameters are used to configure the AWS Fargate Tasks and the Amazon CloudWatch Alarms for the web application.
   * __app__: Configuration of the web application AWS Fargate Task
     * __namespace__: The internal domain name of the web application AWS Fargate Task configured on AWS CloudMap and 
     Amazon Route 53
     * __name__: Name of the web application. The web application Tasks will be internally available at 
     `http://<app.name>.<app.namespace>:<app.port>` to the Nginx reverse proxy.
     * __path__: Path of the web application. The web application Tasks will be available externally at the URL 
     `http://<LoadBalancer DNS Name>/<app.path>`
     * __port__: Port of the web application.
     * __healtchCeckPath__: Path of the health check of the web application. This is used by CloudMap to check the 
     health of the AWS Fargate Tasks.
   * __nginx__: Configuration of the Nginx reverse proxy AWS Fargate Task
     * __port__: Port of the Nginx reverse proxy.
     * __healthCheckPath__: Path of the health check of the Nginx reverse proxy. This is used by the ALB to monitor the
     health of the Nginx reverse proxy AWS Fargate Tasks.
   * __fis__: Configuration of the alarm level triggering an AWS FIS experiment to be stopped.
     * __numberOfEvaluationPeriods__: The number ob 1 minutes periods for the metric to be above the threshold to raise
     an alarm
     * __alarmErrorThresholdPerPeriod__: The number of acceptable errors during a 1 minute period.
   If a metric is above the threshold for the number of periods, an alarm is raised and the AWS FIS experiment is stopped.
```JSON
{
    "app": {
        "namespace": "aws-chaos.game",
        "name": "app",
        "path": "/game",
        "healthCheckPath": "/health",
        "port": 3000
    },
    "nginx": {
        "port": 8080,
        "healthCheckPath": "/health"
    },
    "fis": {
        "numberOfEvaluationPeriods": 2,
        "alarmErrorThresholdPerPeriod": 50
    }
}
```
3. Deploy the Stacks on AWS. Please refer to this [README](doc/CDK.md)

### How does it work?
Adafruit PyPortal micro-controller is connected to AWS IoT Core by uploading on the device the certificates generated by
WS IoT Core. 
1. When you play the game on the Adafruit PyPortal micro-controller and lose the game, it sends a MQTT message
to AWS IoT Core. 
2. An IoT Rule then triggers an AWS Step Function to start a state machine for the Fault Injection experiment.
3. The state machine starts an AWS Lambda function which will randomly pick one of the AWS Fault Injection Service 
experiment and start it. Every 5 seconds another AWS Lambda function will check if the experiment is still running. If 
the experiment is still running it will execute a third AWS Lambda function to generate traffic on the web application 
ALB. This is done to simulate user traffic and generate errors if the application is not capable of handling the chaos 
generated by the monsters.
4. If an alarm is raised in Amazon CloudWatch, the experiment will stop and the state machine will update the *lost* 
score in the Amazon DynamoDB table.
4. If an alarm is not raised in Amazon CloudWatch, the experiment will continue to the end and the state machine will 
update the *won* score in the Amazon DynamoDB table.

## Code References, Credits and Licenses
* [CircuitPython Minesweeper game by Adafruit](https://learn.adafruit.com/circuitpython-pyportal-minesweeper-game)
* [PyPortal IoT Plant Monitor with AWS IoT and CircuitPython by Adafruit](https://learn.adafruit.com/pyportal-iot-plant-monitor-with-aws-iot-and-circuitpython/aws-iot-setup)
* The game's [background image](https://www.shutterstock.com/image-vector/game-over-pixel-art-design-city-1105567490), [title characters](https://www.shutterstock.com/image-vector/digital-arcade-alphabet-pixel-3d-font-2049132659), [monsters images](https://www.shutterstock.com/image-vector/big-eyed-monsters-horns-expressing-emotions-1913676475) 
were purchased on ShutterStock for my own use in this project. If you plan to reuse this project for your own purposes,
you will need to purchase your own licenses for these images.
import { Construct } from 'constructs';
import { Duration } from "aws-cdk-lib";
import { Alarm, IAlarm, CompositeAlarm, AlarmRule, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { HttpCodeElb, HttpCodeTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2';


export interface ChaosGameCwAlarmProps {
  readonly prefix: string;
  readonly loadBalancer: ApplicationLoadBalancer;
}

export class ChaosGameCwAlarm extends Construct {
  public readonly prefix: string;
  public readonly alarm: IAlarm;

  constructor(scope: Construct, id: string, props: ChaosGameCwAlarmProps) {
    super(scope, id);

    this.prefix = props.prefix;

    const elbAlarm = new Alarm(this, 'ElbAlarm', {
      alarmName: `${this.prefix}-elb-alarm`,
      alarmDescription: `CW Alarm when the ${this.prefix} stack application is down for more than 1 minute`,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      threshold: 10,
      evaluationPeriods: 1,
      metric: props.loadBalancer.metricHttpCodeElb(HttpCodeElb.ELB_5XX_COUNT, {
        period: Duration.minutes(1),
        statistic: 'sum',
      }),
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const nginxAlarm = new Alarm(this, 'NginxAlarm', {
      alarmName: `${this.prefix}-nginx-alarm`,
      alarmDescription: `CW Alarm when the ${this.prefix} stack application is down for more than 1 minute`,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      threshold: 10,
      evaluationPeriods: 1,
      metric: props.loadBalancer.metricHttpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT, {
        period: Duration.minutes(1),
        statistic: 'sum',
      }),
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    this.alarm = new CompositeAlarm(this, 'CompositeAlarm', {
      compositeAlarmName: `${this.prefix}-composite-alarm`,
      alarmRule: AlarmRule.anyOf(elbAlarm, nginxAlarm)
    });
  }
}
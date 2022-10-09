import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Table, ITable, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';

export interface ChaosGameDynamodbTableProps {
  readonly prefix: string;
  readonly removalPolicy: RemovalPolicy;
}

export class ChaosGameDynamodbTable extends Construct {
  public readonly prefix: string;
  public readonly table: ITable;
  public readonly partitionKey: string;

    constructor(scope: Construct, id: string, props: ChaosGameDynamodbTableProps) {
      super(scope, id);
  
      this.prefix = props.prefix;
      this.partitionKey = 'pk';
  
      this.table = new Table(this, 'Table', {
        tableName: `${this.prefix}-fis-experiments`,
        billingMode: BillingMode.PAY_PER_REQUEST,
        partitionKey: { name: this.partitionKey, type: AttributeType.STRING },
        removalPolicy: props.removalPolicy,
      });
    }
  }
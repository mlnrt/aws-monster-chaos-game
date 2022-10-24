#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import murmurhash = require('murmurhash');
import { AwsChaosGameAppStack } from '../lib/app-stack';
import { AwsChaosGameFisStack } from '../lib/chaos-stack';
import { AwsChaosGameIotStack } from '../lib/iot-stack';

export function getShortHashFromString(strToConvert: string, hashLength: number = 6): string {
  // Use murmur hash to generate a hash from the string and extract the first characters as a string
  return murmurhash.v3(strToConvert).toString(16).substring(0, hashLength);
}

const app = new cdk.App();

// Get the first 6 characters of the hash value computed from current file folder name
const branchHash = getShortHashFromString(__dirname);
console.log('Hash value computed from the folder name: 👉 ', branchHash);
const prefix = `chaos-game-${branchHash}`;
console.log('Prefix for all resources deployed by this stack: 👉 ', prefix);

// Deploy the entire application stack
const appStack = new AwsChaosGameAppStack(app, `AwsChaosGameAppStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  prefix: prefix,
  tags: {
    Project: prefix,
  }
});

// Deploy the fault injection stack to perform chaos experiments on the application stack
const fisStack = new AwsChaosGameFisStack(app, `AwsChaosGameFisStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  prefix: prefix,
  app: appStack,
  tags: {
    Project: prefix,
  }
});

// Deploy the IoT stack to trigger the chaos experiments on the application stack from the IoT device
new AwsChaosGameIotStack(app, `AwsChaosGameIotStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  prefix: prefix,
  fisStateMachine: fisStack.stateMachine,
  tags: {
    Project: prefix,
  }
});
#!/usr/bin/env node
let xray = require('aws-xray-sdk');
const express = require('express');
const process = require('process');
// Load the AWS SDK for Node.js
let AWS = require("aws-sdk");
// Defines Port and Host of the app
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || 'localhost';

// Configure AWS X-Ray
xray.config([xray.plugins.ECSPlugin]);
// Create the DynamoDB Document client
AWS.config.update({region: process.env.AWS_REGION});
const ddbDocumentClient = new AWS.DynamoDB.DocumentClient();
// Parameters for the DynamoDB GetItem operation to get the game score
const ddbParams = {
  TableName: process.env.TABLE_NAME,
  Key: { pk: 'score' }
};
console.log('Dynamo DB query:', ddbParams);

// Start the EXPRESS server
const app = express();
// set the view engine to ejs
app.set('view engine', 'ejs');

app.get('<APP-HEALTH-CHECK-PATH>', (req, res) => {
  res.status(200);
  res.send({ status: 'healthy' });
});
app.get('/health', (req, res) => {
  res.status(200);
  res.send({ status: 'healthy' });
});

app.use(xray.express.openSegment('AwsChaosGameWebApplication'));
// Use the local subdirectories as static resources
app.use('<APP-PATH>/images', express.static('images'));
app.use('<APP-PATH>/css', express.static('css'));

// this will accept all the calls to root URL http://localhost:3000/
// It will render the index.html available in the Project root directory as a Response
app.get('<APP-PATH>', (req,res) => {
  //Read the score key from the DynamoDB Table
  console.log('Reading the score from the DynamoDB Table');
  ddbDocumentClient.get(ddbParams, function(err, data) {
    if (err) {
      console.log("Error", err);
      res.render('pages/index', {won: '#', lost: '#'});
    } else {
      console.log("Score data:", data.Item);
      // If there is no Item in the response, then the score is not set yet, so set it to 0
      if (data.Item) {
        res.render('pages/index', {won: data.Item.won || 0, lost: data.Item.lost || 0});
      } else {
        res.render('pages/index', {won: 0, lost: 0});
      }
    }
  });
});
app.use(xray.express.closeSegment());

const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

/**
 * Event handler to close the server and its processes in a graceful way
 *
 * @param {string} signal
 */
async function closeGracefully(signal) {
  console.info(`Received signal to terminate: ${signal}`);
  await server.close();
  // await other things we should clean up nicely
  process.exit();
}

// Catches SIGTERM & SIGINT
process.on('SIGTERM', closeGracefully);
process.on('SIGINT', closeGracefully);
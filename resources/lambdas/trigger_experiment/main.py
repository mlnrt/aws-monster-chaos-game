import json
import os
import boto3
from aws_lambda_powertools import Logger, Metrics, Tracer

logger = Logger()
tracer = Tracer()

fis = boto3.client("fis")
""" :type: pyboto3.fis """

@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    # TODO implement the logic to trigger the experiment
    logger.info("Do something smart here")
    return

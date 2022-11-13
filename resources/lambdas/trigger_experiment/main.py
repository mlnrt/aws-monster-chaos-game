import json
import os
import random
import boto3
from aws_lambda_powertools import Logger, Metrics, Tracer

logger = Logger()
tracer = Tracer()

PROJECT_TAG = os.environ.get("PROJECT_TAG")

fis = boto3.client("fis")
""" :type: pyboto3.fis """

@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    # Get the list of experiment templates
    list_templates_response = fis.list_experiment_templates()
    experiment_templates = list_templates_response.get("experimentTemplates")
    while list_templates_response.get("nextToken"):
        list_templates_response = fis.list_experiment_templates(NextToken=list_templates_response.get("nextToken"))
        experiment_templates.extend(list_templates_response.get("experimentTemplates"))
    # Keep only the experiment templates that have the "Project" tag set to this project value
    # To trigger a specific experiment add in the if condition something like
    # and "All ECS Fargate Task from the Nginx Service" in template.get("tags").get("Name")
    experiment_templates = [template for template in experiment_templates
                            if template.get("tags", {}).get("Project") == PROJECT_TAG]
    logger.info({"experiment_templates": experiment_templates})
    # Pick one experiment randomly
    experiment_to_trigger = random.choice(experiment_templates)
    logger.info({"chosen_experiment": experiment_to_trigger.get("tags").get("Name")})
    # Trigger the experiment
    experiment = fis.start_experiment(
        experimentTemplateId=experiment_to_trigger.get("id"),
        tags={"Project": PROJECT_TAG}).get("experiment")
    return {"experimentId": experiment.get("id")}

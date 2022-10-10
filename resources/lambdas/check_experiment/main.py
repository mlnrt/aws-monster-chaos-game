import boto3
from aws_lambda_powertools import Logger, Metrics, Tracer

logger = Logger()
tracer = Tracer()

fis = boto3.client("fis")
""" :type: pyboto3.fis """

@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    # Get the experiment ID from the even payload
    experiment_id = event.get("experimentId")
    # Get the experiment status
    experiment = fis.get_experiment(id=experiment_id).get("experiment")
    logger.info({"experiment": experiment})
    experiment_state = experiment.get("state").get("status")
    return {"experimentId": experiment_id, "experimentStatus": experiment_state}

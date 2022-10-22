import os
import time
import requests
import concurrent.futures
from requests.adapters import HTTPAdapter, Retry
from aws_lambda_powertools import Logger

logger = Logger()

APP_URL = os.environ.get("APP_URL")
NB_TRIES = int(os.environ.get("NB_TRIES", 20))

def establish_one_session(i):
    s = requests.Session()
    s.mount('http://', HTTPAdapter(max_retries=Retry(total=1, backoff_factor=0)))
    r = s.get(APP_URL)
    return {"try": i+1, "status_code": r.status_code, "url":APP_URL}

def lambda_handler(event, context):
    # Establish 10 sessions in parallel to the application
    # Different sessions are opened to generate one error metric each when the application is down
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        responses = executor.map(establish_one_session, range(NB_TRIES))
    # Log the responses
    logger.info({"responses": list(responses)})
    return event
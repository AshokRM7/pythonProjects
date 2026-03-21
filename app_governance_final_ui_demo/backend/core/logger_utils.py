import time
from datetime import datetime

class AgentLogger:
    @staticmethod
    def log_pipeline_start(ticket_id, category=None):
        msg = f"Pipeline started for ticket {ticket_id}"
        if category:
            msg += f" (Category: {category})"
        print(f"[{datetime.now().isoformat()}] {msg}")

    @staticmethod
    def log_pipeline_end(ticket_id, status="Success"):
        print(f"[{datetime.now().isoformat()}] Pipeline ended for ticket {ticket_id} with status: {status}")

    @staticmethod
    def log_agent_success(agent_name, stage_index, message):
        print(f"[{datetime.now().isoformat()}] [SUCCESS] {agent_name}: {message}")

    @staticmethod
    def log_agent_error(agent_name, error_message):
        print(f"[{datetime.now().isoformat()}] [ERROR] {agent_name}: {error_message}")

class AgentTimer:
    def __init__(self, agent_name, ticket_id, action):
        self.agent_name = agent_name
        self.ticket_id = ticket_id
        self.action = action
        self.start_time = 0.0

    def __enter__(self):
        self.start_time = time.time()
        print(f"[{datetime.now().isoformat()}] [START] {self.agent_name}: {self.action}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        print(f"[{datetime.now().isoformat()}] [END] {self.agent_name}: {self.action} (Duration: {duration:.2f}s)")

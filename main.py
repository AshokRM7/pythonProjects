
from agentic_bot.agents.iam_agent import IamAgent
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    agent = IamAgent()
    agent.run_once()

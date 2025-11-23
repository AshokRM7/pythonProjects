import os
from dotenv import load_dotenv
load_dotenv()
print(f"OPENAI_API_KEY: {os.environ.get('OPENAI_API_KEY')}")

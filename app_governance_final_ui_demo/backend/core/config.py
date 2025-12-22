"""Configuration loader for the application."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from root .env file
root_dir = Path(__file__).parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)


def load_config(config_file=None):
    """Load configuration from JSON file.
    
    Args:
        config_file: Path to config file. If None, uses default config.json
        
    Returns:
        dict: Configuration dictionary
    """
    if config_file is None:
        config_file = Path(__file__).parent.parent.parent / "config" / "config.json"
    
    with open(config_file, "r") as f:
        return json.load(f)


def get_env(key: str, default=None):
    """Get environment variable.
    
    Args:
        key: Environment variable name
        default: Default value if not found
        
    Returns:
        Environment variable value or default
    """
    return os.getenv(key, default)

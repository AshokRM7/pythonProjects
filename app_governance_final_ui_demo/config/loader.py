# config/loader.py
import json
import os

def load_config(config_file=None):
    config_file = config_file or os.path.join(os.path.dirname(__file__), "config.json")
    with open(config_file, "r") as f:
        return json.load(f)

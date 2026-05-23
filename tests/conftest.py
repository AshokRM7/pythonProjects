"""Pytest configuration — ensure mock mode from .env for all tests."""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

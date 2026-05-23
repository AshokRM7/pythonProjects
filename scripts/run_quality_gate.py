#!/usr/bin/env python3
"""CI quality gate script — exits 1 if thresholds are not met."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_validator.runner import ValidationRunner


def main() -> int:
    runner = ValidationRunner()
    report = runner.run(evaluator_backend="mock")
    if report.gate_passed:
        print("Quality gate PASSED")
        return 0
    print("Quality gate FAILED:")
    for failure in report.gate_failures:
        print(f"  - {failure}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

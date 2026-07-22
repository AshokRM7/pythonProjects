"""Excel / CSV bank statement parser.

Reads every sheet, scans for the header row anywhere in the first 30 rows
(banks often put account metadata above the table), and normalizes.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.parsing.normalizer import RawTable, ParseResult, normalize_table, merge_results


def parse_excel(path: str | Path) -> ParseResult:
    path = Path(path)
    suffix = path.suffix.lower()
    results: list[ParseResult] = []
    try:
        if suffix == ".csv":
            sheets: dict[str, list[list]] = {"csv": _read_csv_rows(path)}
        else:
            frames = pd.read_excel(path, sheet_name=None, header=None, dtype=object)
            sheets = {
                name: df.where(pd.notnull(df), "").values.tolist()
                for name, df in frames.items() if df is not None and not df.empty
            }
    except Exception as exc:
        r = ParseResult(status="failed")
        r.notes.append(f"Could not open {path.name}: {exc}")
        return r

    for sheet, rows in sheets.items():
        if not rows:
            continue
        rows = [[_cell(c) for c in row] for row in rows]
        res = normalize_table(RawTable(rows=rows, source=f"{path.name}:{sheet}"))
        if res.transactions:
            results.append(res)

    if not results:
        r = ParseResult(status="failed")
        r.notes.append(f"{path.name}: no transaction table found in any sheet.")
        return r
    return merge_results(results)


def _read_csv_rows(path: Path) -> list[list[str]]:
    """Read a CSV as raw string rows without inferring a schema — bank CSVs
    often start with metadata lines that have fewer columns than the table."""
    import csv
    last_err: Exception | None = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            with path.open("r", encoding=enc, newline="") as fh:
                sample = fh.read(4096)
                fh.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                except csv.Error:
                    dialect = csv.excel
                return [row for row in csv.reader(fh, dialect)]
        except UnicodeDecodeError as exc:
            last_err = exc
            continue
    raise ValueError(f"Unreadable CSV encoding: {last_err}")


def _cell(c):
    """Keep datetimes/numbers as-is for the normalizer; blank out NaN."""
    if c is None:
        return ""
    if isinstance(c, float) and pd.isna(c):
        return ""
    return c

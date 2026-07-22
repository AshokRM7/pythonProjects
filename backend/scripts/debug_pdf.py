"""Debug helper: dump what pdfplumber sees in a PDF (tables + text)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pdfplumber

path = Path(sys.argv[1])
with pdfplumber.open(path) as pdf:
    print(f"pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages[:3], 1):
        print(f"\n===== PAGE {i} =====")
        for name, settings in [
            ("lines", {"vertical_strategy": "lines", "horizontal_strategy": "lines"}),
            ("text", {"vertical_strategy": "text", "horizontal_strategy": "text",
                      "text_x_tolerance": 2, "intersection_tolerance": 5}),
        ]:
            try:
                tables = page.extract_tables(table_settings=settings)
            except Exception as e:
                print(f"[{name}] error: {e}")
                continue
            print(f"[{name}] {len(tables or [])} table(s)")
            for t in (tables or [])[:2]:
                print(f"  table {len(t)} rows x {max(len(r) for r in t)} cols; first 6 rows:")
                for r in t[:6]:
                    print("   ", [str(c)[:28] if c else "" for c in r])
        txt = page.extract_text() or ""
        lines = txt.splitlines()
        print(f"[text] {len(lines)} lines; first 25:")
        for l in lines[:25]:
            print("   |", l[:150])

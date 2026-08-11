"""OCR fallback for PDFs that have no extractable text layer.

Some banks issue statements whose text has been flattened into vector outlines
(or scanned to images). pdfplumber/pdfminer find ZERO characters on such pages
even though a human sees a perfectly normal table — the glyphs are drawings,
not text. The only way to read them is to rasterize each page and recognize it.

Two engines, tried in order:
  1. Tesseract  — free, offline, deterministic (used when the binary exists).
  2. OpenAI vision — structured row extraction, used when Tesseract is absent
     and an API key is configured.

Both paths end in the SAME deterministic post-processing: debit vs credit is
decided by running-balance arithmetic (never by the model), and every row is
checked against the balance column so any misread digit is detectable and
reported in the parse notes rather than silently trusted.
"""
from __future__ import annotations

import base64
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from shutil import which

from app.config import get_settings
from app.services.parsing.normalizer import (
    ParseResult, NormalizedTxn, parse_amount, parse_date,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ detection
def pdf_has_text_layer(path: str | Path, sample_pages: int = 6) -> bool:
    """True if any sampled page exposes real characters."""
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages[:sample_pages]:
                if page.chars:
                    return True
    except Exception as exc:
        logger.warning("text-layer probe failed for %s: %s", path, exc)
    return False


def ocr_available() -> dict:
    """What the server can actually do right now — surfaced in /api/health."""
    settings = get_settings()
    return {
        "tesseract": _tesseract_path() is not None,
        "openai_vision": settings.llm_available,
        "enabled": settings.ocr_enabled,
    }


def _tesseract_path() -> str | None:
    found = which("tesseract")
    if found:
        return found
    for candidate in (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ):
        if Path(candidate).exists():
            return candidate
    return None


# ------------------------------------------------------------------ rendering
def _render_pages(path: str | Path, dpi: int, max_pages: int,
                  only: set[int] | None = None) -> list[tuple[int, bytes]]:
    """Rasterize pages to PNG bytes using PyMuPDF (pip-only, no system deps).

    `only` restricts rendering to specific 1-based page numbers — the repair
    pass uses it so a 300-page file isn't re-rendered to fix two rows.
    """
    import fitz  # PyMuPDF

    pages: list[tuple[int, bytes]] = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            if only is not None and (i + 1) not in only:
                continue
            pix = page.get_pixmap(dpi=dpi)
            pages.append((i + 1, pix.tobytes("png")))
    return pages


# ------------------------------------------------------------------ entrypoint
def ocr_pdf(path: str | Path) -> ParseResult:
    path = Path(path)
    settings = get_settings()
    result = ParseResult()

    if not settings.ocr_enabled:
        result.status = "failed"
        result.notes.append(
            f"{path.name}: this PDF has no text layer and OCR is disabled "
            "(set OCR_ENABLED=true in backend/.env).")
        return result

    engine = settings.ocr_engine.lower()
    tesseract = _tesseract_path()
    use_tesseract = engine in ("auto", "tesseract") and tesseract is not None
    use_openai = (engine in ("auto", "openai") and not use_tesseract
                  and settings.llm_available)

    if not use_tesseract and not use_openai:
        result.status = "failed"
        result.notes.append(
            f"{path.name}: this PDF contains no selectable text — the content is "
            "images or vector outlines, so it must be read by OCR. No OCR engine is "
            "available. Install Tesseract (free, offline) or set OPENAI_API_KEY in "
            "backend/.env to use AI vision, then upload again.")
        return result

    try:
        pages = _render_pages(path, settings.ocr_dpi, settings.ocr_max_pages)
    except Exception as exc:
        result.status = "failed"
        result.notes.append(f"{path.name}: could not rasterize pages for OCR: {exc}")
        return result

    if not pages:
        result.status = "failed"
        result.notes.append(f"{path.name}: no pages could be rendered for OCR.")
        return result

    if use_tesseract:
        result = _ocr_with_tesseract(pages, path.name, tesseract)
    else:
        result = _ocr_with_openai(pages, path.name, path)

    total_pages = _page_count(path)
    if total_pages > settings.ocr_max_pages:
        result.notes.append(
            f"{path.name}: only the first {settings.ocr_max_pages} of {total_pages} pages "
            "were read (OCR page cap). Raise OCR_MAX_PAGES in backend/.env to read more.")
        if result.status == "parsed":
            result.status = "partial"
    return result


def _page_count(path: Path) -> int:
    try:
        import fitz
        with fitz.open(path) as doc:
            return doc.page_count
    except Exception:
        return 0


# ------------------------------------------------------------------ tesseract
def _ocr_with_tesseract(pages: list[tuple[int, bytes]], source: str, binary: str) -> ParseResult:
    """Rasterize -> Tesseract (word coordinates) -> reuse the text-line parser.

    Plain text output flattens a table into a block and scrambles the columns,
    which puts the balance where the amount should be. Requesting TSV gives a
    bounding box per word, so rows can be rebuilt by vertical position and the
    columns read left-to-right exactly as printed.
    """
    import os
    import subprocess

    # Each Tesseract process defaults to multi-threading via OpenMP; running
    # several of them then oversubscribes the CPU and gets SLOWER. Pin each
    # instance to one thread and parallelize at the process level instead.
    child_env = {**os.environ, "OMP_THREAD_LIMIT": "1"}

    def read_page(item: tuple[int, bytes]) -> tuple[int, list[str]]:
        page_no, png = item
        try:
            proc = subprocess.run(
                [binary, "stdin", "stdout", "tsv", "--psm", "4", "-l", "eng"],
                input=png, capture_output=True, timeout=180, env=child_env,
            )
            return page_no, _lines_from_tsv(proc.stdout.decode("utf-8", errors="replace"))
        except Exception as exc:
            logger.warning("tesseract failed on page %s: %s", page_no, exc)
            return page_no, []

    # Tesseract is CPU-bound but runs out-of-process, so threads parallelize it
    # cleanly. Leave one core free so the API stays responsive during a scan.
    workers = max(1, min(len(pages), (os.cpu_count() or 2) - 1))
    by_page: dict[int, list[str]] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for page_no, page_lines in pool.map(read_page, pages):
            by_page[page_no] = page_lines
    lines: list[str] = [ln for p in sorted(by_page) for ln in by_page[p]]

    from app.services.parsing.pdf_parser import _parse_text_lines
    result = _parse_text_lines(lines, source)
    if result.transactions:
        result.notes.insert(0, f"{source}: no text layer — read with Tesseract OCR "
                               f"across {len(pages)} page(s).")
        _annotate_reliability(result, source)
    else:
        result.status = "failed"
        result.notes.append(
            f"{source}: OCR ran but no transaction rows were recognized. "
            "Try a higher OCR_DPI, or upload the Excel/CSV export instead.")
    return result


def _lines_from_tsv(tsv_text: str) -> list[str]:
    """Rebuild visual rows from Tesseract's word-level bounding boxes.

    Words sharing a horizontal band belong to the same printed row; joining them
    left-to-right restores 'date ... narration ... amount balance' as one line.
    """
    words: list[tuple[float, int, int, str]] = []  # (y_centre, x_left, height, text)
    for raw in tsv_text.splitlines()[1:]:
        parts = raw.split("\t")
        if len(parts) < 12:
            continue
        try:
            left, top, height = int(parts[6]), int(parts[7]), int(parts[9])
            conf = float(parts[10])
        except ValueError:
            continue
        text = parts[11].strip()
        if not text or conf < 0:
            continue
        words.append((top + height / 2.0, left, height, text))

    if not words:
        return []
    words.sort(key=lambda w: (w[0], w[1]))

    lines: list[str] = []
    bucket: list[tuple[int, str]] = []
    band_y: float | None = None
    band_h = 0
    for y, x, h, text in words:
        if band_y is not None and abs(y - band_y) > max(6.0, band_h * 0.6):
            lines.append(" ".join(t for _, t in sorted(bucket)))
            bucket, band_y, band_h = [], None, 0
        bucket.append((x, text))
        band_y = y if band_y is None else (band_y + y) / 2.0
        band_h = max(band_h, h)
    if bucket:
        lines.append(" ".join(t for _, t in sorted(bucket)))
    return lines


# ------------------------------------------------------------------ openai vision
_VISION_PROMPT = (
    "This image is one page of a bank account statement. Extract EVERY transaction row "
    "from the table, in the order shown.\n"
    "Return ONLY JSON of the form:\n"
    '{"rows":[{"date":"DD-MM-YYYY","description":"...","amount":"1234.56","balance":"-5179.52"}]}\n'
    "Rules:\n"
    "- date: the transaction/value date of the row.\n"
    "- description: the full narration text, joined into one line.\n"
    "- amount: the transaction amount column, digits only with a decimal point, no commas.\n"
    "- balance: the running balance column, keeping a minus sign if negative.\n"
    "- Copy digits EXACTLY. Never estimate, round, or invent a value.\n"
    "- Skip header rows, page numbers, and opening/closing balance summary lines.\n"
    '- If the page has no transaction rows, return {"rows":[]}.'
)


def _ocr_with_openai(pages: list[tuple[int, bytes]], source: str,
                     path: Path | None = None) -> ParseResult:
    settings = get_settings()
    result = ParseResult()
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
    except Exception as exc:
        result.status = "failed"
        result.notes.append(f"{source}: could not start the AI vision client: {exc}")
        return result

    def read_page(item: tuple[int, bytes]) -> tuple[int, list[dict]]:
        page_no, png = item
        b64 = base64.b64encode(png).decode()
        try:
            resp = client.chat.completions.create(
                model=settings.openai_vision_model,
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": _VISION_PROMPT},
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}},
                ]}],
                temperature=0,
                response_format={"type": "json_object"},
                timeout=180,
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            rows = data.get("rows") or []
            return page_no, rows if isinstance(rows, list) else []
        except Exception as exc:
            logger.warning("vision OCR failed on page %s: %s", page_no, exc)
            return page_no, []

    collected: dict[int, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=settings.ocr_concurrency) as pool:
        for page_no, rows in pool.map(read_page, pages):
            collected[page_no] = rows

    failed_pages = sum(1 for p, _ in pages if not collected.get(p))

    # ---- repair pass -------------------------------------------------------
    # Rows are linked by the running balance, so any misread digit shows up as a
    # broken chain. Re-read ONLY the pages that break it, at a higher resolution,
    # and keep the version that reconciles better. Cost is spent where it helps.
    suspect = _suspect_pages(collected)
    if suspect and path is not None and settings.ocr_repair_passes > 0:
        retry_dpi = int(settings.ocr_dpi * 1.5)
        try:
            hi_res = dict(_render_pages(path, retry_dpi, settings.ocr_max_pages, only=suspect))
        except Exception as exc:
            logger.warning("repair render failed: %s", exc)
            hi_res = {}
        if hi_res:
            before = _mismatch_count(collected)
            with ThreadPoolExecutor(max_workers=settings.ocr_concurrency) as pool:
                for page_no, rows in pool.map(read_page, list(hi_res.items())):
                    if rows:
                        candidate = dict(collected)
                        candidate[page_no] = rows
                        if _mismatch_count(candidate) <= before:
                            collected = candidate
                            before = _mismatch_count(candidate)
            result.notes.append(
                f"{source}: re-read {len(hi_res)} page(s) at {retry_dpi} DPI to resolve "
                "figures that did not reconcile.")

    txns = _rows_to_transactions(
        [row for page_no in sorted(collected) for row in collected[page_no]])
    result.transactions = txns

    if not txns:
        result.status = "failed"
        result.notes.append(
            f"{source}: AI vision OCR could not recognize any transaction rows.")
        return result

    result.notes.insert(
        0, f"{source}: no text layer — read with AI vision OCR "
           f"({settings.openai_vision_model}) across {len(pages)} page(s).")
    if failed_pages:
        result.status = "partial"
        result.notes.append(
            f"{source}: {failed_pages} page(s) could not be read and were skipped.")
    _annotate_reliability(result, source)
    return result


def _mismatch_count(page_rows: dict[int, list[dict]]) -> int:
    """How many rows break the running-balance chain across the whole document."""
    txns = _rows_to_transactions(
        [row for p in sorted(page_rows) for row in page_rows[p]])
    bad = 0
    prev = None
    for t in txns:
        if t.balance is None:
            continue
        if prev is not None and abs((prev - t.debit + t.credit) - t.balance) > 0.02:
            bad += 1
        prev = t.balance
    return bad


def _suspect_pages(page_rows: dict[int, list[dict]]) -> set[int]:
    """Pages containing at least one row that breaks the balance chain."""
    owners: list[int] = []
    flat: list[dict] = []
    for p in sorted(page_rows):
        for row in page_rows[p]:
            flat.append(row)
            owners.append(p)
    txns = _rows_to_transactions(flat)
    # _rows_to_transactions may skip unparseable rows; re-walk defensively
    suspect: set[int] = set()
    prev = None
    for idx, t in enumerate(txns):
        if t.balance is None:
            continue
        if prev is not None and abs((prev - t.debit + t.credit) - t.balance) > 0.02:
            if idx < len(owners):
                suspect.add(owners[idx])
            if idx - 1 < len(owners) and idx >= 1:
                suspect.add(owners[idx - 1])
        prev = t.balance
    return suspect


def _rows_to_transactions(rows: list[dict]) -> list[NormalizedTxn]:
    """Convert extracted rows to transactions, deciding direction by balance math."""
    txns: list[NormalizedTxn] = []
    prev_balance: float | None = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        d = parse_date(row.get("date"))
        amt = parse_amount(row.get("amount"))
        bal = parse_amount(row.get("balance"))
        if d is None or amt is None:
            continue
        amt = abs(amt)
        debit = credit = 0.0
        decided = False
        if prev_balance is not None and bal is not None:
            if abs((prev_balance - amt) - bal) <= 0.02:
                debit, decided = amt, True
            elif abs((prev_balance + amt) - bal) <= 0.02:
                credit, decided = amt, True
        if not decided:
            # fall back to the sign of the balance movement, else treat as debit
            if prev_balance is not None and bal is not None and bal > prev_balance:
                credit = amt
            else:
                debit = amt
        if bal is not None:
            prev_balance = bal
        txns.append(NormalizedTxn(
            txn_date=d,
            description=str(row.get("description") or "")[:800],
            debit=debit, credit=credit, balance=bal,
        ))
    return txns


# ------------------------------------------------------------------ reliability
def _annotate_reliability(result: ParseResult, source: str) -> None:
    """OCR can misread digits. The running balance is an independent check:
    report how many rows fail continuity so the analyst knows what to trust."""
    rows = [t for t in result.transactions if t.balance is not None]
    if len(rows) < 3:
        return
    ok = bad = 0
    prev = None
    for t in result.transactions:
        if t.balance is None:
            continue
        if prev is not None:
            if abs((prev - t.debit + t.credit) - t.balance) <= 0.02:
                ok += 1
            else:
                bad += 1
        prev = t.balance
    checked = ok + bad
    if not checked:
        return
    accuracy = 100.0 * ok / checked
    if bad == 0:
        result.notes.append(
            f"{source}: all {checked} rows reconcile against the running balance — "
            "OCR figures verified.")
    else:
        result.notes.append(
            f"{source}: {bad} of {checked} rows do not reconcile against the running "
            f"balance ({accuracy:.1f}% verified) — OCR may have misread some figures. "
            "Review the flagged amounts before relying on this report.")
        if accuracy < 90 and result.status == "parsed":
            result.status = "partial"

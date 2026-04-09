"""
Run all crawler scripts in sequence and print a consolidated summary.

Usage (from backend/):
    python crawler/run_all.py

To add a new crawler, import its crawl() function and append to CRAWLERS.
Each crawl() must return a dict with at minimum:
    source, imported, skipped_dup, skipped_no_match
"""

import sys
import time
from pathlib import Path

# ── Path bootstrap ────────────────────────────────────────────────────────────
# Add both crawler/ (for sibling imports) and backend/ (for app.*) to sys.path
_CRAWLER = Path(__file__).resolve().parent
_BACKEND = _CRAWLER.parent
sys.path.insert(0, str(_CRAWLER))
sys.path.insert(0, str(_BACKEND))

# ── Import crawlers ───────────────────────────────────────────────────────────
from inaturalist import crawl as crawl_inaturalist  # noqa: E402

# Uncomment as new crawlers are added:
# from gbif import crawl as crawl_gbif
# from web_crawl import crawl as crawl_web

CRAWLERS: list[tuple[str, callable]] = [
    ("iNaturalist", crawl_inaturalist),
    # ("GBIF",        crawl_gbif),
    # ("Web crawl",   crawl_web),
]

# ── Runner ────────────────────────────────────────────────────────────────────

def run_all() -> None:
    WIDTH = 52
    print("=" * WIDTH)
    print("  Utah Forage Map — Crawler Suite")
    print("=" * WIDTH)
    print()

    results: list[dict] = []
    suite_start = time.monotonic()

    for name, fn in CRAWLERS:
        print(f"── {name} {'─' * (WIDTH - len(name) - 4)}")
        t0 = time.monotonic()
        try:
            stats = fn()
            stats.setdefault("error", None)
        except Exception as exc:
            stats = {
                "source":            name,
                "imported":          0,
                "skipped_dup":       0,
                "skipped_no_match":  0,
                "pages":             0,
                "error":             str(exc),
            }
            print(f"  ✗ Crawler failed: {exc}")

        stats["elapsed_s"] = round(time.monotonic() - t0, 1)
        results.append(stats)
        print()

    total_elapsed = time.monotonic() - suite_start

    # ── Summary table ─────────────────────────────────────────────────────────
    print("=" * WIDTH)
    print("  SUMMARY")
    print("=" * WIDTH)
    print(f"  {'Source':<18} {'Import':>7} {'Dupes':>6} {'Unmatched':>10} {'Time':>7}")
    print(f"  {'─'*18} {'─'*7} {'─'*6} {'─'*10} {'─'*7}")

    total_imported = 0
    for s in results:
        if s["error"]:
            print(f"  {s['source']:<18}  ✗ ERROR: {s['error'][:28]}")
        else:
            print(
                f"  {s['source']:<18}"
                f" {s['imported']:>7}"
                f" {s['skipped_dup']:>6}"
                f" {s['skipped_no_match']:>10}"
                f" {s['elapsed_s']:>6.1f}s"
            )
            total_imported += s["imported"]

    print(f"  {'─'*18} {'─'*7} {'─'*6} {'─'*10} {'─'*7}")
    print(f"  {'TOTAL':<18} {total_imported:>7}")
    print(f"\n  Total wall time: {total_elapsed:.1f}s")
    print("=" * WIDTH)


if __name__ == "__main__":
    run_all()

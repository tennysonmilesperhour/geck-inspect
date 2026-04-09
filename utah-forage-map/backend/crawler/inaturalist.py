"""
Crawler: iNaturalist research-grade Utah fungi observations.

Pulls pages of observations from the iNaturalist API, matches each taxon
against the Species table, deduplicates via CrawledSource.source_url, and
writes Sighting + CrawledSource rows for every new record.

Usage (from backend/):
    python crawler/inaturalist.py
"""

import json
import sys
import uuid
from datetime import date
from pathlib import Path
from time import sleep

import httpx
from dotenv import load_dotenv

# ── Path bootstrap ────────────────────────────────────────────────────────────
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))
load_dotenv(_BACKEND / ".env")

from app.database import SessionLocal          # noqa: E402
from app.models import CrawledSource, Sighting, Species, User  # noqa: E402

# ── Constants ─────────────────────────────────────────────────────────────────

INAT_API      = "https://api.inaturalist.org/v1/observations"
UTAH_PLACE_ID = 9        # iNaturalist place_id for the state of Utah
PER_PAGE      = 200      # max allowed by the API
MAX_PAGES     = 50       # 50 × 200 = 10 000, the API hard ceiling
REQUEST_DELAY = 1.1      # seconds between pages (~54 req/min; limit is 100/min)

# Fixed UUID for the crawler system user — stable across DB wipes + re-seeds
CRAWLER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# ── System user ───────────────────────────────────────────────────────────────

def get_or_create_crawler_user(db) -> User:
    user = db.query(User).filter(User.id == CRAWLER_USER_ID).first()
    if not user:
        user = User(
            id=CRAWLER_USER_ID,
            username="crawler",
            email="crawler@utah-forage-map.internal",
            hashed_password="!",   # unusable password — account is is_active=False
            role="crawler",
            is_active=False,
        )
        db.add(user)
        db.commit()
        print("  ↳ Created system crawler user.")
    return user

# ── Species index ─────────────────────────────────────────────────────────────

def build_species_index(db) -> tuple[dict, dict]:
    """Return (latin_name_lower → Species, common_name_lower → Species)."""
    latin, common = {}, {}
    for sp in db.query(Species).all():
        latin[sp.latin_name.lower()] = sp
        if sp.common_name:
            common[sp.common_name.lower()] = sp
    return latin, common


def match_species(taxon: dict, latin_idx: dict, common_idx: dict):
    """
    Match an iNaturalist taxon dict to a Species row.

    Priority:
      1. Exact latin name match
      2. Exact common name match (case-insensitive)
      3. Genus-level match (e.g. "Cantharellus californicus" → Cantharellus cibarius)
    """
    name  = (taxon.get("name") or "").strip().lower()
    cname = (taxon.get("preferred_common_name") or "").strip().lower()

    if name  in latin_idx:  return latin_idx[name]
    if cname in common_idx: return common_idx[cname]

    # Genus-level fallback
    if name:
        genus = name.split()[0]
        for key, sp in latin_idx.items():
            if key.startswith(genus + " "):
                return sp

    return None

# ── Parsing helpers ───────────────────────────────────────────────────────────

def parse_latlon(location: str | None) -> tuple[float | None, float | None]:
    if not location:
        return None, None
    try:
        lat_s, lon_s = location.split(",", 1)
        return float(lat_s.strip()), float(lon_s.strip())
    except (ValueError, AttributeError):
        return None, None


def parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except ValueError:
        return None


def parse_month(date_str: str | None) -> int | None:
    d = parse_date(date_str)
    return d.month if d else None


def best_photo_url(photos: list) -> str | None:
    """Return the medium-sized URL for the first photo, if any."""
    if not photos:
        return None
    raw = (photos[0] or {}).get("url", "")
    # iNat photos come as square thumbnails by default; upgrade to medium
    return raw.replace("/square.", "/medium.") if raw else None

# ── Fetch ─────────────────────────────────────────────────────────────────────

def fetch_page(client: httpx.Client, page: int) -> dict:
    resp = client.get(
        INAT_API,
        params={
            "taxon_name":    "Fungi",
            "place_id":      UTAH_PLACE_ID,
            "quality_grade": "research",
            "per_page":      PER_PAGE,
            "page":          page,
            "order_by":      "created_at",
            "order":         "desc",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()

# ── Main crawl ────────────────────────────────────────────────────────────────

def crawl() -> dict:
    """
    Run the full iNaturalist crawl.
    Returns a stats dict with keys: imported, skipped_dup, skipped_no_match,
    pages, source.
    """
    stats = {
        "source":            "iNaturalist",
        "pages":             0,
        "imported":          0,
        "skipped_dup":       0,
        "skipped_no_match":  0,
    }

    db = SessionLocal()
    try:
        crawler_user = get_or_create_crawler_user(db)
        latin_idx, common_idx = build_species_index(db)
        print(f"  Species index: {len(latin_idx)} latin / {len(common_idx)} common names.\n")

        with httpx.Client(
            headers={"User-Agent": "utah-forage-map/0.1 (open-source research project)"},
        ) as client:

            for page in range(1, MAX_PAGES + 1):
                # ── Fetch page ──────────────────────────────────────────────
                try:
                    data = fetch_page(client, page)
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code == 429:
                        print("  Rate-limited — waiting 60 s…", flush=True)
                        sleep(60)
                        data = fetch_page(client, page)   # one retry
                    else:
                        print(f"\n  HTTP {exc.response.status_code} on page {page}: {exc}")
                        break
                except httpx.RequestError as exc:
                    print(f"\n  Network error on page {page}: {exc}")
                    break

                results = data.get("results", [])
                if not results:
                    break

                # ── Process observations ────────────────────────────────────
                n_imported = n_dup = n_no_match = 0

                for obs in results:
                    uri   = obs.get("uri") or ""
                    taxon = obs.get("taxon") or {}

                    # Must have GPS location
                    lat, lon = parse_latlon(obs.get("location"))
                    if lat is None:
                        n_no_match += 1
                        continue

                    # Must match a tracked species
                    sp = match_species(taxon, latin_idx, common_idx)
                    if sp is None:
                        n_no_match += 1
                        continue

                    # Skip duplicates (idempotent)
                    dup = (
                        db.query(CrawledSource)
                        .filter(CrawledSource.source_url == uri)
                        .first()
                    )
                    if dup:
                        n_dup += 1
                        continue

                    # Insert Sighting
                    obs_date = obs.get("observed_on")
                    raw_notes = (obs.get("description") or "").strip()
                    sighting = Sighting(
                        id=uuid.uuid4(),
                        user_id=crawler_user.id,
                        species_id=sp.id,
                        latitude=lat,
                        longitude=lon,
                        found_on=parse_date(obs_date),
                        month=parse_month(obs_date),
                        notes=raw_notes or None,
                        photo_url=best_photo_url(obs.get("photos") or []),
                        source="inaturalist",
                        confidence_score=80,   # research-grade observations
                    )
                    db.add(sighting)

                    # Insert CrawledSource (compact raw_data, not full JSON)
                    compact = {
                        "inat_id":     obs.get("id"),
                        "taxon":       taxon.get("name"),
                        "common":      taxon.get("preferred_common_name"),
                        "quality":     obs.get("quality_grade"),
                        "place_guess": obs.get("place_guess"),
                        "obscured":    obs.get("obscured", False),
                    }
                    db.add(CrawledSource(
                        id=uuid.uuid4(),
                        sighting_id=sighting.id,
                        source_name="iNaturalist",
                        source_url=uri,
                        raw_data=json.dumps(compact),
                    ))
                    n_imported += 1

                db.commit()

                # ── Progress line ───────────────────────────────────────────
                total = data.get("total_results", 0)
                print(
                    f"  Page {page:3d} — "
                    f"imported {n_imported:3d}, "
                    f"skipped {n_dup:4d} duplicates, "
                    f"{n_no_match:3d} unmatched"
                    f"  [{page * PER_PAGE}/{total} fetched]"
                )

                stats["pages"]            += 1
                stats["imported"]         += n_imported
                stats["skipped_dup"]      += n_dup
                stats["skipped_no_match"] += n_no_match

                # Stop when we've seen all results
                if page * PER_PAGE >= total:
                    break

                sleep(REQUEST_DELAY)

    except Exception as exc:
        db.rollback()
        print(f"\n  Fatal error: {exc}")
        raise
    finally:
        db.close()

    return stats


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== iNaturalist Crawler — Utah Fungi ===\n")
    s = crawl()
    print(f"\n{'─' * 42}")
    print(f"  Pages crawled  : {s['pages']}")
    print(f"  Imported       : {s['imported']}")
    print(f"  Duplicates     : {s['skipped_dup']}")
    print(f"  Unmatched taxa : {s['skipped_no_match']}")

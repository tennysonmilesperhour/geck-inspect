#!/usr/bin/env python3
"""Backfill one CLIP embedding per distinct animal without provider throttling."""

from __future__ import annotations

import argparse
import io
import math
import os
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
import torch
import torch.nn.functional as F
from PIL import Image, ImageFile
from transformers import AutoProcessor, CLIPModel

MODEL_ID = "openai/clip-vit-large-patch14"
ImageFile.LOAD_TRUNCATED_IMAGES = True


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def seller_key(row):
    meta = row.get("training_meta") or {}
    return str(meta.get("geck_data_seller_slug") or meta.get("geck_data_seller_name") or "unknown").strip().lower()


def animal_key(row):
    meta = row.get("training_meta") or {}
    listing = meta.get("listing_id") or meta.get("geck_data_listing_id") or meta.get("gecko_id")
    return f"{seller_key(row)}|listing:{listing}" if listing else f"image:{row['id']}"


def weight(row):
    meta = row.get("training_meta") or {}
    tier, provenance = meta.get("verification_tier"), meta.get("provenance")
    if tier == "hero_anchor":
        return 1.0
    if provenance in {"expert_owner", "expert_reviewed"}:
        return 0.95
    if provenance == "ai_then_expert":
        return 0.85
    if provenance == "community":
        return 0.6
    if tier == "auto_bulk_approved":
        return 0.4
    return 0.5


class Supabase:
    def __init__(self, url, key):
        self.url = url.rstrip("/")
        self.rest = f"{self.url}/rest/v1/gecko_images"
        self.session = requests.Session()
        self.session.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})

    def pages(self, params, page_size=1000):
        rows = []
        for offset in range(0, 5000, page_size):
            response = self.session.get(self.rest, params={**params, "limit": page_size, "offset": offset}, timeout=30)
            response.raise_for_status()
            page = response.json()
            rows.extend(page)
            if len(page) < page_size:
                break
        return rows

    def candidates(self, max_attempts):
        return self.pages({
            "select": "id,image_url,primary_morph,training_meta,embedding_status,embedding_attempts",
            "image_embedding": "is.null",
            "image_url": "not.is.null",
            "verified": "eq.true",
            "primary_morph": "not.is.null",
            "embedding_attempts": f"lt.{max_attempts}",
            "order": "embedding_attempts.asc,created_date.asc",
        })

    def ready(self, include_vector=False):
        select = "id,image_url,training_meta,embedding_model"
        if include_vector:
            select += ",image_embedding"
        return self.pages({
            "select": select,
            "image_embedding": "not.is.null",
            "verified": "eq.true",
            "primary_morph": "not.is.null",
            "order": "embedding_date.desc",
        })

    def update(self, row_id, payload):
        response = self.session.patch(
            self.rest,
            params={"id": f"eq.{row_id}"},
            headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()


def balanced_queue(candidates, ready_animals, limit):
    groups = defaultdict(lambda: defaultdict(deque))
    seen = set()
    for row in sorted(candidates, key=weight, reverse=True):
        if (row.get("training_meta") or {}).get("training_eligible") is False:
            continue
        animal = animal_key(row)
        if animal in ready_animals or animal in seen:
            continue
        seen.add(animal)
        groups[row["primary_morph"]][seller_key(row)].append(row)

    morph_queues = []
    for morph in sorted(groups):
        sellers = [groups[morph][seller] for seller in sorted(groups[morph])]
        balanced = deque()
        while any(sellers):
            for queue in sellers:
                if queue:
                    balanced.append(queue.popleft())
        morph_queues.append(balanced)

    rows = []
    while len(rows) < limit and any(morph_queues):
        for queue in morph_queues:
            if queue and len(rows) < limit:
                rows.append(queue.popleft())
    return rows, len(groups)


def reachable_candidates(candidates):
    samples = {}
    for row in candidates:
        host = urlparse(row["image_url"]).netloc
        samples.setdefault(host, row["image_url"])

    def check(item):
        host, url = item
        try:
            response = requests.get(url, headers={"Range": "bytes=0-0"}, timeout=8, stream=True)
            response.close()
            return host, response.ok
        except Exception:
            return host, False

    with ThreadPoolExecutor(max_workers=min(8, len(samples))) as pool:
        checks = dict(pool.map(check, samples.items()))
    unavailable = sorted(host for host, ok in checks.items() if not ok)
    if unavailable:
        print(f"Skipping unavailable image hosts: {', '.join(unavailable)}")
    return [row for row in candidates if checks.get(urlparse(row["image_url"]).netloc, False)]


def download(row):
    response = requests.get(row["image_url"], timeout=20)
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    return row, image


def load_model():
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = CLIPModel.from_pretrained(MODEL_ID).to(device).eval()
    return processor, model, device


def embed(images, processor, model, device):
    inputs = processor(images=images, return_tensors="pt").to(device)
    with torch.inference_mode():
        vectors = model.get_image_features(**inputs)
        if hasattr(vectors, "pooler_output"):
            vectors = vectors.pooler_output
        vectors = F.normalize(vectors.float(), p=2, dim=1).cpu()
    return vectors.tolist()


def validate(sb, processor, model, device):
    rows = sb.ready(include_vector=True)
    if not rows:
        raise RuntimeError("No existing embedding is available for compatibility validation")
    row, image = download(rows[0])
    local = embed([image], processor, model, device)[0]
    remote = row["image_embedding"]
    if isinstance(remote, str):
        remote = [float(value) for value in remote.strip("[]").split(",")]
    dot = sum(a * b for a, b in zip(local, remote))
    local_norm = math.sqrt(sum(value * value for value in local))
    remote_norm = math.sqrt(sum(value * value for value in remote))
    cosine = dot / (local_norm * remote_norm)
    print(f"Compatibility cosine={cosine:.8f} against {row.get('embedding_model') or 'existing model'}")
    if cosine < 0.999:
        raise RuntimeError("Local CLIP output is not compatible with the production embedding space")


def main():
    args = parse_args()
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    sb = Supabase(url, key)
    ready = sb.ready()
    candidates = reachable_candidates(sb.candidates(args.max_attempts))
    rows, morphs = balanced_queue(candidates, {animal_key(row) for row in ready}, args.limit)
    print(f"Local embedding queue: {len(rows)} distinct animals across {morphs} morph labels")
    if args.dry_run or not rows:
        return

    processor, model, device = load_model()
    print(f"Loaded {MODEL_ID} on {device}")
    if args.validate:
        validate(sb, processor, model, device)

    completed = failed = 0
    for start in range(0, len(rows), args.batch_size):
        chunk = rows[start : start + args.batch_size]
        downloaded, failures = [], []
        with ThreadPoolExecutor(max_workers=min(8, len(chunk))) as pool:
            futures = [pool.submit(download, row) for row in chunk]
            for row, future in zip(chunk, futures):
                try:
                    downloaded.append(future.result())
                except Exception as exc:
                    failures.append((row, f"Image download failed: {exc}"))

        if downloaded:
            try:
                vectors = embed([image for _, image in downloaded], processor, model, device)
                timestamp = datetime.now(timezone.utc).isoformat()
                updates = []
                for (row, _), vector in zip(downloaded, vectors):
                    payload = {
                        "image_embedding": vector,
                        "embedding_model": MODEL_ID,
                        "embedding_date": timestamp,
                        "embedding_status": "ready",
                        "embedding_attempts": int(row.get("embedding_attempts") or 0) + 1,
                        "embedding_error": None,
                    }
                    updates.append((row, payload))
                with ThreadPoolExecutor(max_workers=min(8, len(updates))) as pool:
                    update_futures = [pool.submit(sb.update, row["id"], payload) for row, payload in updates]
                    for (row, _), future in zip(updates, update_futures):
                        try:
                            future.result()
                            completed += 1
                        except Exception as exc:
                            failures.append((row, f"Persistence failed: {exc}"))
            except Exception as exc:
                failures.extend((row, f"Embedding failed: {exc}") for row, _ in downloaded)

        for row, message in failures:
            failed += 1
            print(f"[{completed + failed}/{len(rows)}] {row['id']}: {message[:180]}", flush=True)
            try:
                sb.update(row["id"], {
                    "embedding_status": "failed",
                    "embedding_attempts": int(row.get("embedding_attempts") or 0) + 1,
                    "embedding_date": datetime.now(timezone.utc).isoformat(),
                    "embedding_error": message[:500],
                })
            except Exception:
                pass
        processed = completed + failed
        if processed % 40 == 0 or processed == len(rows):
            print(f"Progress: {processed}/{len(rows)}; ready={completed}; failed={failed}", flush=True)

    print(f"Finished: ready={completed}; failed={failed}")
    if failed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

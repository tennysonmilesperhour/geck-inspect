#!/usr/bin/env python3
"""Evaluate visual retrieval while holding out every query animal's breeder."""

from __future__ import annotations

import json
import os
from collections import defaultdict

import numpy as np
import requests


def seller(row):
    meta = row.get("training_meta") or {}
    return str(meta.get("geck_data_seller_slug") or meta.get("geck_data_seller_name") or f"row:{row['id']}").lower()


def animal(row):
    meta = row.get("training_meta") or {}
    listing = meta.get("listing_id") or meta.get("geck_data_listing_id") or meta.get("gecko_id")
    return f"{seller(row)}|{listing}" if listing else row["id"]


def main():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    session = requests.Session()
    session.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})
    rows = []
    for offset in range(0, 5000, 1000):
        response = session.get(
            f"{url}/rest/v1/gecko_images",
            params={
                "select": "id,primary_morph,training_meta,image_embedding",
                "image_embedding": "not.is.null",
                "verified": "eq.true",
                "primary_morph": "not.is.null",
                "limit": 1000,
                "offset": offset,
            },
            timeout=60,
        )
        response.raise_for_status()
        page = response.json()
        rows.extend(page)
        if len(page) < 1000:
            break

    distinct = {}
    for row in rows:
        distinct.setdefault(animal(row), row)
    rows = list(distinct.values())
    vectors = []
    for row in rows:
        vector = row["image_embedding"]
        if isinstance(vector, str):
            vector = [float(value) for value in vector.strip("[]").split(",")]
        vectors.append(vector)
    matrix = np.asarray(vectors, dtype=np.float32)
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)
    similarities = matrix @ matrix.T
    labels = np.asarray([row["primary_morph"] for row in rows])
    sellers = np.asarray([seller(row) for row in rows])

    correct = []
    by_label = defaultdict(list)
    top3 = []
    for index in range(len(rows)):
        scores = similarities[index].copy()
        scores[sellers == sellers[index]] = -np.inf
        nearest = np.argpartition(scores, -3)[-3:]
        nearest = nearest[np.argsort(scores[nearest])[::-1]]
        hit = labels[nearest[0]] == labels[index]
        correct.append(hit)
        by_label[labels[index]].append(hit)
        top3.append(labels[index] in labels[nearest])

    result = {
        "examples": len(rows),
        "sellers": len(set(sellers)),
        "labels": len(set(labels)),
        "leave_one_breeder_out_top1": round(float(np.mean(correct)), 4),
        "leave_one_breeder_out_top3": round(float(np.mean(top3)), 4),
        "macro_top1": round(float(np.mean([np.mean(values) for values in by_label.values()])), 4),
        "per_label_top1": {
            label: {"examples": len(values), "accuracy": round(float(np.mean(values)), 4)}
            for label, values in sorted(by_label.items())
        },
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

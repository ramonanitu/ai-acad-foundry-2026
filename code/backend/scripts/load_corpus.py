#!/usr/bin/env python
"""Walk data/, and POST every document to /ingest.

    uv run python scripts/load_corpus.py
    uv run python scripts/load_corpus.py --strategy dynamic --base-url http://localhost:7799
    uv run python scripts/load_corpus.py --data-dir ../../data --dry-run

Each file becomes one /ingest call. The `source` sent with it is the file's
stem (e.g. `complaints-goodwill-amounts.md` -> `complaints-goodwill-amounts`),
so re-running this script re-ingests with the same source per document —
see the stable-chunk-ids improvement in app/vectorstore.py before assuming
that replaces rather than duplicates.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


def iter_documents(data_dir: Path):
    for path in sorted(data_dir.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        yield path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://localhost:7799")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--strategy", default="dynamic",
                         help="Chunking strategy (default: dynamic)")
    parser.add_argument("--dry-run", action="store_true",
                         help="List what would be ingested, without calling the API")
    args = parser.parse_args()

    if not args.data_dir.is_dir():
        print(f"✗ no such directory: {args.data_dir}")
        return 2

    documents = list(iter_documents(args.data_dir))
    if not documents:
        print(f"✗ no .md files found in {args.data_dir}")
        return 2

    print(f"→ data dir : {args.data_dir}")
    print(f"→ strategy : {args.strategy}")
    print(f"→ documents: {len(documents)}\n")

    if args.dry_run:
        for path in documents:
            print(f"  {path.stem:<40} <- {path.name}")
        return 0

    ok = failed = 0
    with httpx.Client(base_url=args.base_url, timeout=60) as client:
        for path in documents:
            text = path.read_text(encoding="utf-8")
            source = path.stem
            try:
                resp = client.post("/ingest", json={
                    "text": text, "strategy": args.strategy, "source": source,
                })
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"✗ {source:<40} failed: {e}")
                failed += 1
                continue
            body = resp.json()
            print(f"✓ {source:<40} {body['count']:>2} chunks  "
                  f"(dim={body['vector_dimension']})")
            ok += 1

    print(f"\n{ok} ingested, {failed} failed, out of {len(documents)} documents.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python
"""Walk data/, and POST every document to /ingest.

    uv run python scripts/load_corpus.py
    uv run python scripts/load_corpus.py --strategy dynamic --base-url http://localhost:7799
    uv run python scripts/load_corpus.py --data-dir ../../data --dry-run

Each file becomes one /ingest call. The `source` sent with it is the file's
stem (e.g. `complaints-goodwill-amounts.md` -> `complaints-goodwill-amounts`),
so re-running this script re-ingests with the same source per document — the
stable chunk ids in app/vectorstore.py mean that *replaces* the document's
previous chunks in Qdrant instead of piling up duplicates.

The `---` frontmatter block at the top of each file (title, product, audience,
effective, version, ...) is parsed off, stripped from the text that gets
chunked, and sent as `metadata` so it lands in every chunk's payload — that is
what makes a later metadata filter (by product, or by effective date, to stop
the 2025 fee list competing with the 2026 one) possible at all.
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


def parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    """Split `---\\nkey: value\\n---\\nbody` into (metadata, body).

    Deliberately minimal — the corpus only ever uses flat `key: value` lines,
    so a real YAML parser would be one more dependency for no benefit. Files
    with no frontmatter block are returned unchanged with empty metadata.
    """
    lines = raw.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, raw
    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}, raw
    metadata: dict[str, str] = {}
    for line in lines[1:end]:
        key, sep, value = line.partition(":")
        if sep:
            metadata[key.strip()] = value.strip()
    body = "\n".join(lines[end + 1:]).strip()
    return metadata, body


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
            metadata, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
            tag = f"{metadata.get('product', '?')} / {metadata.get('effective', '?')}"
            print(f"  {path.stem:<40} [{tag}]")
        return 0

    ok = failed = 0
    with httpx.Client(base_url=args.base_url, timeout=60) as client:
        for path in documents:
            metadata, body = parse_frontmatter(path.read_text(encoding="utf-8"))
            source = path.stem
            try:
                resp = client.post("/ingest", json={
                    "text": body, "strategy": args.strategy, "source": source,
                    "metadata": metadata,
                })
                resp.raise_for_status()
            except httpx.HTTPError as e:
                print(f"✗ {source:<40} failed: {e}")
                failed += 1
                continue
            result = resp.json()
            print(f"✓ {source:<40} {result['count']:>2} chunks  "
                  f"(dim={result['vector_dimension']})")
            ok += 1

    print(f"\n{ok} ingested, {failed} failed, out of {len(documents)} documents.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

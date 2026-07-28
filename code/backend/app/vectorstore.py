"""Qdrant wrapper — collection lifecycle, upsert, similarity search.

The collection is created lazily with the dimension of the first embedding that
arrives. If a later embedding model produces a different dimension, we refuse
loudly: vectors from different models live in different spaces and comparing
them is meaningless — reset the collection and re-ingest instead.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from qdrant_client import QdrantClient, models

from .config import settings


# Fixed namespace so uuid5(NAMESPACE, seed) is stable across processes and runs.
_ID_NAMESPACE = uuid.UUID("7b3b8f2e-6b0a-4e9a-9c2d-2f6a2b7d9a10")

# Payload keys the store itself manages — never overwritten by caller-supplied metadata.
_RESERVED_PAYLOAD_KEYS = {"text", "index", "strategy", "source", "ingested_at"}


def _stable_id(source: str | None, index: int, text: str) -> str:
    seed = f"{source}::{index}" if source else f"adhoc::{index}::{text}"
    return str(uuid.uuid5(_ID_NAMESPACE, seed))


class DimensionMismatch(Exception):
    def __init__(self, existing: int, incoming: int) -> None:
        self.existing = existing
        self.incoming = incoming
        super().__init__(
            f"Collection stores {existing}-dimensional vectors but the current embedding "
            f"model produces {incoming} dimensions. Vectors from different embedding models "
            f"are not comparable — DELETE /collection and re-ingest."
        )


class VectorStore:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.qdrant_url, timeout=10)
        self.collection = settings.qdrant_collection

    # --- lifecycle -----------------------------------------------------------
    def ensure_collection(self, dim: int) -> None:
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE),
            )
            return
        existing = self._vector_size()
        if existing != dim:
            raise DimensionMismatch(existing, dim)

    def reset(self) -> bool:
        if self.client.collection_exists(self.collection):
            self.client.delete_collection(self.collection)
            return True
        return False

    # --- data ----------------------------------------------------------------
    def upsert(self, chunks: list[str], vectors: list[list[float]], strategy: str,
               source: str | None, metadata: dict | None = None) -> list[str]:
        """Upsert chunks with **stable, deterministic ids**.

        The id is derived from `source` + chunk index (falling back to a hash of
        the chunk text itself when no source is given, e.g. ad-hoc /ingest calls
        from the Postman collection or the demo UI). Re-ingesting the same
        `source` therefore *replaces* its previous chunks in place instead of
        piling up a fresh UUID per call — the duplication bug the naive
        `uuid.uuid4()` id had.
        """
        ids = [_stable_id(source, i, text) for i, text in enumerate(chunks)]
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        clean_metadata = {k: v for k, v in (metadata or {}).items() if k not in _RESERVED_PAYLOAD_KEYS}
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=pid,
                    vector=vec,
                    payload={
                        **clean_metadata,
                        "text": text,
                        "index": i,
                        "strategy": strategy,
                        "source": source or "adhoc",
                        "ingested_at": now,
                    },
                )
                for i, (pid, text, vec) in enumerate(zip(ids, chunks, vectors))
            ],
        )
        return ids

    def search(self, vector: list[float], top_k: int, filters: dict | None = None) -> list[dict]:
        """Nearest-neighbour search, optionally restricted by exact-match payload
        filters (e.g. `{"product": "complaints", "status": "current"}`) — what
        stops the 2025 fee list from competing with the 2026 one, once the caller
        knows which one it wants."""
        query_filter = None
        if filters:
            query_filter = models.Filter(must=[
                models.FieldCondition(key=key, match=models.MatchValue(value=value))
                for key, value in filters.items()
            ])
        hits = self.client.query_points(
            collection_name=self.collection, query=vector, limit=top_k,
            query_filter=query_filter, with_payload=True,
        ).points
        results = []
        for h in hits:
            payload = h.payload or {}
            results.append({
                "id": str(h.id),
                "score": round(float(h.score), 4),
                "text": payload.get("text", ""),
                "index": payload.get("index"),
                "strategy": payload.get("strategy"),
                "source": payload.get("source"),
                "metadata": {k: v for k, v in payload.items() if k not in _RESERVED_PAYLOAD_KEYS},
            })
        return results

    # --- introspection --------------------------------------------------------
    def info(self) -> dict:
        if not self.client.collection_exists(self.collection):
            return {"exists": False, "name": self.collection, "points_count": 0,
                    "vector_dimension": None, "distance": None}
        c = self.client.get_collection(self.collection)
        return {
            "exists": True,
            "name": self.collection,
            "points_count": c.points_count or 0,
            "vector_dimension": self._vector_size(),
            "distance": "cosine",
        }

    def ping(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False

    def _vector_size(self) -> int:
        cfg = self.client.get_collection(self.collection).config.params.vectors
        return cfg.size if hasattr(cfg, "size") else next(iter(cfg.values())).size

# Assignment 2 - Notes

## Chunking (Part 3, folder 1)
- static: 6 chunks
- sentence: 5 chunks
- dynamic: 5 chunks
- semantic:  chunks

## Acceptance questions
1. Embedding dimension: 1536
2. Off-topic query score: 0.2231 
3. When use_rag is true, the prompt sent to the model is no longer just the raw question. A CONTEXT block is prepended before the question, containing the top_k passages retrieved from Qdrant (here, 3), each numbered [1], [2], [3] and labeled with its similarity score, sorted from most to least relevant. The original question follows at the end, under a QUESTION: label.

Without RAG: just "What fee does Libra Bank charge for early mortgage repayment?" (43 tokens)
With RAG: the same question, but preceded by the three retrieved passages with their scores - 328 tokens total, over 7x longer

The system_prompt also changes: the RAG version explicitly instructs the model to ground its answer only in the provided context, cite sources as [1][2], and say so explicitly if the context doesn't contain the answer - rather than guessing.

4. lyrical shows runs_on: "unknown" in the /agents response. This is because the Foundry Agent Service couldn't be queried at all, the foundry block reports available: false, with the explicit reason that AZURE_AI_PROJECT_ENDPOINT is not set in .env. Without being able to check whether the persona exists as a hosted agent on Foundry, the system can't confirm where it actually runs, so it reports "unknown" rather than a definite value like "local", "both", or "foundry".

active_mode: "local" at the top level confirms the backend itself is running in local mode (not pure Docker key-auth), but even so, all four personas still show runs_on: "unknown", because the missing AZURE_AI_PROJECT_ENDPOINT blocks the Foundry check regardless of auth mode. Setting that endpoint and deploying the persona (Deploy a persona to Foundry request) would resolve lyrical to "both".

---

# Assignment 3 - Notes

## Part 3 — corpus

`data/` holds 18 fictional documents on Libra Bank's complaint-handling process
(narrow domain, chosen so retrieval has to work *within* one process rather than
across unrelated products). `data/README.md` explains the corpus and maps each of
the 7 required breaking cases to specific documents.

## Part 4 — ingestion

**Loader:** `code/backend/scripts/load_corpus.py` walks `data/*.md` (skipping
`README.md`), strips the `---` frontmatter header off each file, and POSTs the
body to `/ingest` with `source` set to the file stem and `metadata` set to the
parsed header (title, product, audience, effective, version, status).

**Two improvements implemented**, both in `app/vectorstore.py` (+ `app/schemas.py`,
`app/main.py`, and the loader):

1. **Stable chunk ids.** `upsert()` used to mint `uuid.uuid4()` per chunk, so
   re-ingesting a document created brand-new points instead of replacing the old
   ones. Ids are now `uuid.uuid5(NAMESPACE, f"{source}::{index}")` (falls back to
   hashing the text itself for `source`-less ad-hoc ingests) — deterministic, so
   the same document at the same chunk index always maps to the same point id.
2. **Real metadata.** `IngestRequest.metadata` and `SearchHit.metadata` now exist;
   `upsert()` merges the caller's metadata dict into the Qdrant payload (reserved
   keys — text/index/strategy/source/ingested_at — always win), and `search()`
   returns it back out. The loader is what actually populates it, from each
   document's frontmatter.

### Before/after — real numbers

Reverted `vectorstore.py` to the old `uuid4()` behaviour with `git stash` to get a
clean "before" measurement, then restored it for "after":

| | Before (uuid4) | After (stable id) |
|---|---|---|
| Ingest one 1-chunk doc twice, `points_count` | **2** | **1** |
| Ingest the whole 18-doc / 97-chunk corpus twice, `points_count` | 194 (doubles every run) | **97** (stays flat) |
| Point id, same doc, two ingests | `a6121e3a…` then `0a84b9fc…` (different) | `bb28bcc9…` both times (identical) |

This is the exact "ingesting the same document twice doubles the hits" bug called
out in the assignment's troubleshooting table — now gone.

### Three questions, real scores (after both improvements, `top_k=3`, `dynamic` chunking)

1. **"How long do I have to wait before I can escalate my complaint to CSALB?"**
   — top hit `complaints-ombudsman-2026` (current, 15 business days) scores
   **0.7686**; `complaints-ombudsman-2025` (superseded, 45 calendar days) scores
   **0.7493**, right behind it. Vector search alone finds both almost equally
   relevant — a 0.02 gap is not a safe way to pick the current rule. This is
   exactly why the metadata (`status: current` / `status: superseded`,
   `effective` dates) needed to exist before a filter (Part 5) can use it — before
   this change, the payload had no such field to filter on at all.
2. **"What is the goodwill payment cap for a proven financial loss complaint?"**
   — all 3 hits (scores 0.6187 / 0.6090 / 0.6075) came from
   `complaints-eligibility-goodwill.md` and `complaints-vulnerable-customers.md`.
   `complaints-goodwill-amounts.md` — the document with the actual number (3% of
   the loss, capped at 5,000 lei) — **did not make top-3 at all**. Confirms the
   corpus's "two documents must be combined" case genuinely breaks naive top-k:
   the eligibility doc out-competes the doc with the number because both discuss
   "goodwill payment" and eligibility has more, shorter matching chunks.
3. **"What is Libra Bank's policy on student loan complaints?"**
   — top hit `complaints-out-of-scope` scores **0.7981**, a clear, confident
   match, correctly steering an LLM answer toward "we don't offer that" rather
   than inventing a policy.

### What's still wrong / next

- Q2 shows retrieval needs work independent of metadata: either a bigger `top_k`,
  re-ranking, or chunk-context prefixing (so `complaints-goodwill-amounts.md`
  chunks mention "goodwill" explicitly instead of relying on an implicit doc
  title) would help it surface — a Part 5 candidate.
- The stable-id scheme has a known gap: if a document shrinks (fewer chunks on
  re-ingest), the old higher-index chunks become orphaned points that are never
  overwritten. Fine for this corpus (no doc has shrunk), not fine in general —
  would need a delete-by-source-prefix step before re-upserting to close fully.
- Metadata is stored and returned, but nothing yet *filters* on it — that's Part 5
  (metadata filters), which this work is a direct prerequisite for.
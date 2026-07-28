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
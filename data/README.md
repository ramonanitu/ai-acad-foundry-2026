# Corpus — Libra Bank complaint handling

Eighteen fictional documents describing how **Libra Bank** (an invented retail
bank; not a real institution) receives, categorizes, resolves, escalates, and
records customer complaints. No real customer data or employer-internal material
is used — figures, deadlines, contact details, and the CSALB/ANPC/BNR references
are illustrative and written for this exercise.

Domain is deliberately narrow — complaints only, not the full product catalog —
so retrieval has to work *within* one process rather than across unrelated topics.

## Documents

| File | What it covers |
|---|---|
| `complaints-overview.md` | What counts as a complaint vs. a dispute vs. fraud |
| `complaints-channels.md` | The five valid ways to file a complaint |
| `complaints-taxonomy.md` | The 9 complaint categories and which team owns each |
| `complaints-sla-table.md` | Acknowledgment/resolution targets per category |
| `complaints-intake-procedure.md` | The 9-step intake-to-close procedure |
| `complaints-escalation-procedure.md` | The 5-stage path to CSALB/ANPC/courts |
| `complaints-eligibility-goodwill.md` | Who qualifies for a goodwill payment |
| `complaints-goodwill-amounts.md` | Goodwill payment amounts and the 3% uplift |
| `complaints-policy-2025.md` | 2025 policy edition (superseded) |
| `complaints-policy-2026.md` | 2026 policy edition (current) |
| `complaints-ombudsman-2025.md` | 2025 CSALB waiting-period rule (superseded) |
| `complaints-ombudsman-2026.md` | 2026 CSALB waiting-period rule (current) |
| `complaints-card-disputes-procedure.md` | 7-step disputed-transaction procedure |
| `complaints-fraud-vs-dispute.md` | How to tell fraud from an ordinary dispute |
| `complaints-out-of-scope.md` | Products/complaints Libra Bank does not handle |
| `complaints-vulnerable-customers.md` | Extra flexibility for vulnerable complainants |
| `complaints-record-keeping.md` | Retention periods and regulatory reporting |
| `complaints-satisfaction-survey.md` | Post-close survey and how to reopen a case |

## Which document covers which breaking case

| Case | Documents | How it breaks a naive pipeline |
|---|---|---|
| **A precise number** | `complaints-goodwill-amounts.md` | "goodwill uplift is 3% of the documented financial loss, capped at 5,000 lei" — a paraphrase-only retriever can find the topic but lose the exact number |
| **Two documents that must be combined** | `complaints-eligibility-goodwill.md` + `complaints-goodwill-amounts.md` | Eligibility conditions live in one file, the payment amounts in the other; "am I eligible and how much would I get" needs both, and a single chunk from either alone gives half an answer |
| **Near-duplicates that differ** | `complaints-policy-2025.md` vs `complaints-policy-2026.md` | Same structure, same headings, most sentences look similar — but acknowledgment (5 days → 2 days), resolution targets (flat 30 days → category-specific 5–15 days), and channels (email added) all changed |
| **A long procedure with steps** | `complaints-intake-procedure.md` (9 steps), `complaints-escalation-procedure.md` (5 stages), `complaints-card-disputes-procedure.md` (7 steps) | Naive fixed-size chunking will cut mid-sequence, e.g. separating "provisional credit" from the outcome it leads to |
| **A table** | `complaints-sla-table.md` | Acknowledgment/resolution/owner/extension columns per category — plain-text chunking mangles column alignment and can silently pair the wrong row with the wrong category |
| **Contradiction across versions** | `complaints-ombudsman-2025.md` vs `complaints-ombudsman-2026.md` | The CSALB waiting period changed from **45 calendar days** (through 2025) to **15 business days** (from 15 Jan 2026) — same question, two documents with different `effective` dates and genuinely different numbers *and* units (calendar vs. business days) |
| **Something deliberately absent** | `complaints-out-of-scope.md` | Explicitly states Libra Bank has no student loan, crypto, foreign-currency retail mortgage, or brokerage product — a question about complaining regarding any of these must be refused, not answered by analogy to what *is* offered |

`complaints-taxonomy.md`, `complaints-channels.md`, `complaints-fraud-vs-dispute.md`,
`complaints-vulnerable-customers.md`, and `complaints-record-keeping.md` round out
the corpus with cross-references (every document links to related ones by
filename) so retrieval also has to cope with documents that mention, but do not
fully explain, a topic covered elsewhere.

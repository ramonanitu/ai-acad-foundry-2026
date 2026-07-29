# Question set — Libra Assist against the complaints corpus

15 questions run through `/ask` (`use_rag: true`, `agent: default`, defaults from
`.env`: `top_k=4`, `min_score=0.4`). Sourced against the 18-document corpus in
`data/` (see `data/README.md`). Each entry below is: the question, the expected
answer and where it lives, what the assistant actually said (trimmed for length —
full JSON responses are reproducible by re-running the questions), and an honest
verdict.

**Scoreboard**

| Group | Correct | Partial | Wrong | Refused correctly | Refused incorrectly |
|---|---|---|---|---|---|
| A · Simple retrieval (7) | 5 | 0 | 0 | 0 | — |
| — retrieval miss, honestly flagged | 1 (A5) | | | | |
| — incomplete answer | 1 (A1) | | | | |
| B · Multi-step (5) | 3 | 2 | 0 | — | — |
| C · Must refuse (3) | — | — | 1 (C3) | 1 (C1) | — |
| — hedged instead of refusing plainly | 1 (C2) | | | | |

**Headline finding:** the assistant never *invented a number*. Every failure was
either an incomplete retrieval (the right document existed but didn't make top-4)
or, in one case (C3), applying a real rule from the wrong document to a question
that should have been refused outright. That is a more useful failure mode to
know about than random hallucination — see "What this says about the pipeline"
at the end.

---

## A · Simple retrieval

### A1 — "What are the five channels through which a customer can file a complaint with Libra Bank?"
- **Expected:** all five — mobile app, call center, branch, email, written post — from `complaints-channels.md`.
- **Actual:** named only 2 of 5 (app, call center) and explicitly said *"the context states there are five channels but does not list the other three in the excerpts provided."*
- **Verdict: Incomplete.** `complaints-channels.md` is a 5-item numbered list; dynamic chunking split it, and only the chunk covering items 1–2 scored high enough to make top-4 (0.7533). The assistant correctly declined to guess the missing three rather than inventing them — but the answer is still unusable as-is. Textbook case of "a long procedure/list gets cut, and naive chunking damages meaning."

### A2 — "What is the acknowledgment deadline for a fraud complaint under the current complaints policy?"
- **Expected:** same business day. Source: `complaints-sla-table.md` / `complaints-policy-2026.md`.
- **Actual:** "acknowledged the same business day" — correct, and correctly noted this is the 2026 policy (was 5 business days generally under 2025).
- **Verdict: Correct.**

### A3 — "What is the goodwill uplift percentage for a proven financial loss complaint, and what is the cap?"
- **Expected:** 3%, capped at 5,000 lei. Source: `complaints-goodwill-amounts.md`.
- **Actual:** "3% of the documented financial loss... capped at 5,000 lei" — exact match, precise number preserved.
- **Verdict: Correct.**

### A4 — "Within how many business days can a customer reopen a closed complaint after the satisfaction survey?"
- **Expected:** 10 business days. Source: `complaints-satisfaction-survey.md`.
- **Actual:** correctly said 10 business days, then added an unprompted (and slightly confusing) aside about survey timing.
- **Verdict: Correct**, core fact right; answer was longer and murkier than it needed to be.

### A5 — "How long does Libra Bank retain the record of a fraud-related complaint?"
- **Expected:** 7 years. Source: `complaints-record-keeping.md`.
- **Actual:** explicitly said the retrieved passages don't state a retention period and asked for the Records Retention Policy.
- **Verdict: Refused when it should have answered — retrieval miss.** `complaints-record-keeping.md` never made the top-4 (the 4 hits it competed against, all scoring 0.64–0.66, were about complaint decision/logging timelines that merely *mention* "retained," pulling the query toward them instead). No hallucination — the assistant said "I don't have this" rather than guessing — but the fact was in the corpus and a naive top-4 vector search simply didn't surface it.

### A6 — "Can a customer file a formal complaint with Libra Bank through a Facebook direct message?"
- **Expected:** No — social media is explicitly not a valid channel. Source: `complaints-channels.md`.
- **Actual:** "No... it won't be logged as a complaint and does not start the bank's SLA clock" — correct, with the right reasoning.
- **Verdict: Correct.**

### A7 — "What is the waiting period before a customer can escalate an unresolved complaint to CSALB under the current rule?"
- **Expected:** 15 business days (2026 rule). Source: `complaints-ombudsman-2026.md`.
- **Actual:** "15 business days" — correct, and correctly contrasted with the superseded 45-calendar-day 2025 rule.
- **Verdict: Correct.**

---

## B · Multi-step

### B1 — "I filed a fees complaint on 2 January 2026 and it is now 20 business days later with no response. Has the resolution target been missed, and how many more business days before I can escalate to CSALB?"
*What makes it hard:* needs the fees resolution target (`complaints-sla-table.md`, 15 business days) combined with the CSALB waiting-period rule (`complaints-ombudsman-2026.md`), **and** a date check — the complaint was logged 2 Jan 2026, before the ombudsman rule's own effective date of 15 Jan 2026, which the corpus never fully resolves.
- **Expected:** target missed (20 > 15 business days); can escalate to CSALB now — though which waiting-period rule (15 business days vs. the old 45 calendar days) actually governs a complaint logged in that 1–14 Jan gap is genuinely ambiguous in this corpus.
- **Actual:** correctly identified both candidate rules, correctly did the date arithmetic for the 45-day case (2 Jan + 45 calendar days = 16 Feb 2026), and **explicitly flagged that the corpus doesn't say which rule applies to a complaint logged in that gap**, rather than picking one and asserting it confidently.
- **Verdict: Correct behavior.** This is close to the ideal answer to a deliberately ambiguous multi-step question: it did the retrieval, did the arithmetic, and surfaced the ambiguity instead of hiding it. (Worth noting for future corpus work: the 1–14 Jan 2026 gap between `complaints-policy-2026.md`'s effective date and `complaints-ombudsman-2026.md`'s effective date was not intentional — a real corpus author would either align the two dates or spell out the transition rule.)

### B2 — "My mis-selling complaint was rejected after Libra Bank investigated the facts, and I accept those facts — I just disagree with the outcome. What should I do next, and am I eligible for a goodwill payment?"
*What makes it hard:* two separate questions needing two different documents — `complaints-eligibility-goodwill.md` for the goodwill question, `complaints-escalation-procedure.md` for "what next."
- **Expected:** not eligible for goodwill (rejected complaints never are); next step is the 5-stage escalation path (supervisor review → Head of Complaints → CSALB).
- **Actual:** correctly answered the goodwill half ("not eligible... a rejected complaint is never eligible even if you disagree with the decision"), but for "what next" said the passages don't include an escalation process and asked for more information.
- **Verdict: Partially correct.** `complaints-escalation-procedure.md` — the exact document that answers the second half — never made top-4 (the 4 hits were 2× eligibility-goodwill, out-of-scope, and goodwill-amounts). Same retrieval-miss pattern as A5: correct on the half it retrieved, honestly blank on the half it didn't.

### B3 — "A customer's card transaction was disputed for 1200 lei due to a confirmed Libra Bank processing error. How much will they receive in total, including any goodwill payment?"
*What makes it hard:* retrieval (find the 3%/5,000-lei rule) then arithmetic (1,200 + 3% × 1,200).
- **Expected:** 1,200 lei reimbursed + 36 lei goodwill = 1,236 lei.
- **Actual:** "1,236 lei total" — correct, arithmetic shown and right.
- **Verdict: Correct.**

### B4 — "I filed a complaint on 20 December 2025 and it is still open on 20 January 2026. Does the 2025 policy or the 2026 policy govern my resolution deadline?"
*What makes it hard:* the non-retroactivity rule lives in `complaints-policy-2026.md`, but answering it correctly requires comparing the complaint's log date against two different documents' effective dates.
- **Expected:** 2025 policy (open cases keep the rules they started under).
- **Actual:** "The 2025 policy governs... continue under the 2025 targets they started with" — correct.
- **Verdict: Correct.**

### B5 — "A vulnerable customer's fees complaint needs more time because they are gathering documents with help from a family member. Does the normal resolution clock keep running, and do they get a single dedicated contact?"
*What makes it hard:* combines the general SLA (`complaints-sla-table.md`) with the vulnerable-customer exception (`complaints-vulnerable-customers.md`) that overrides it.
- **Expected:** no, the clock pauses (not just extends); yes, one dedicated contact for the life of the case.
- **Actual:** both answered correctly, including the "paused, not just extended" distinction.
- **Verdict: Correct.**

---

## C · Must refuse

### C1 — "What is the interest rate on Libra Bank's student loans?"
- **Expected:** refuse — Libra Bank has no student loan product (`complaints-out-of-scope.md`).
- **Actual:** "Libra Bank does not offer student loans, so there is no interest rate for a 'Libra Bank student loan.'" Clear, direct, correctly grounded.
- **Verdict: Refused correctly.**

### C2 — "I want to complain about a bad trade I made through Libra Bank's cryptocurrency trading platform. How do I get compensated?"
- **Expected:** refuse — Libra Bank does not offer crypto trading (`complaints-out-of-scope.md`).
- **Actual:** retrieved the right document (`complaints-out-of-scope` was in the top-4 twice) but **hedged** instead of stating the fact plainly: *"whether you can be compensated therefore depends on whether the trading platform was provided by Libra Bank or by a third party"* and asked clarifying questions, even though the retrieved text says outright that Libra Bank does not offer crypto trading or custody at all.
- **Verdict: Weak / should have refused more plainly.** Not a hallucination — it didn't invent a compensation process — but it under-used a chunk that directly answered the question, and a customer reading this could reasonably think there's a live path to compensation. Compare to C1, where the same kind of chunk was used decisively.

### C3 — "What is the compensation cap if my complaint about my Libra Bank stock brokerage account is upheld?"
- **Expected:** refuse — Libra Bank offers no brokerage/investment product, so the question is out of scope (`complaints-out-of-scope.md`).
- **Actual:** **confidently applied the general goodwill formula** — "Libra Bank will reimburse the documented financial loss in full and add a goodwill uplift of 3%... capped at 5,000 lei" — and only added, as an afterthought, "the passage does not say any different cap for stock brokerage accounts, so the same rule above applies... unless you have a document that specifies otherwise."
- **Verdict: Wrong — this is the invented-answer failure the assignment warns about.** `complaints-out-of-scope.md` *was* retrieved (3rd of 4 hits, score 0.5712) and it explicitly says brokerage/investment complaints are out of scope — but the top-scored hit was the goodwill-amounts rule (0.5771), and the model answered from that instead of the disclaimer sitting one slot below it. The retrieval wasn't the failure here; the generation step failed to prioritize the one chunk that mattered over the one that merely pattern-matched "compensation cap."

---

## What this says about the pipeline

- **Precise numbers and date/version reasoning are the strong suit** — every question needing an exact figure (3%, 5,000 lei, 10 business days, 15 vs. 45 days) or a version/date comparison (B1, B4) came back right, including one case (B1) where the honest answer was "this is ambiguous," not a guess.
- **The recurring failure is retrieval, not generation** — A5 and B2 both had the right document in the corpus but not in the top-4, and the assistant correctly said "I don't know" rather than fabricating. This is exactly what Part 5's `min_score` is for in the *refuse-when-nothing-relevant* sense, but it doesn't help when a *relevant* document simply loses the top-k race to less relevant ones. A better `top_k`, re-ranking, or chunk-context prefixing (flagged already in `NOTES.md` Part 4) is the direct fix.
- **C3 is the one true "confident wrong answer"** — worth keeping in the eval set permanently, since it shows retrieval doing its job (the disclaimer chunk was there) while generation still failed to weight it correctly against a same-topic but wrong-context chunk.

"""The local agent — the persona runs in *your* process, against any provider.

This is the honest minimum of what an "agent" is when you strip the marketing:
a persona (instructions + rules), optional retrieved context, and a model call.
No platform required — it works with OpenAI, Anthropic, LM Studio or Foundry,
and it is what runs when AGENT_MODE=local.

Compare with foundry_agent.py, where the same persona is hosted by Azure and the
loop runs on Microsoft's side.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings
from ..llm import get_llm
from .persona import Persona


@dataclass
class AgentReply:
    text: str
    mode: str                       # "local" | "foundry"
    persona: str
    system_prompt: str              # exactly what was sent as the system message
    prompt_sent: str                # exactly what was sent as the user message
    provider: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def build_user_prompt(
    question: str,
    chunks: list[dict],
    no_evidence: bool = False,
    attachments: list[dict] | None = None,
) -> str:
    """Question alone, question + retrieved passages, or question + an explicit
    note that retrieval came up empty (candidates existed but none cleared the
    similarity floor — see `no_evidence` in main.py's /ask). That note keeps the
    persona in character and free to use the conversation history, while still
    forbidding it from inventing the specific fact it wasn't given.

    Files the user attached to *this* question (see AskRequest.attachments) are
    prepended ahead of everything else — they are user-supplied material, not
    retrieved evidence, so they carry no citation requirement or score."""
    if chunks:
        context = "\n\n".join(
            f"[{i + 1}] (score {c['score']}) {c['text']}" for i, c in enumerate(chunks)
        )
        body = (
            "CONTEXT — retrieved passages, most similar first:\n"
            f"{context}\n\n"
            "QUESTION:\n"
            f"{question}"
        )
    elif no_evidence:
        body = (
            "QUESTION:\n"
            f"{question}\n\n"
            "NOTE: A search of the knowledge base found candidate passages, but none scored "
            "high enough to be trusted as relevant to this specific question. Do not guess or "
            "invent specific facts (numbers, deadlines, policy details) to answer it — say "
            "plainly that you don't have a grounded answer for this point, and use the rest of "
            "the conversation to decide what to do next (e.g. ask a clarifying question, or say "
            "which team/channel can help)."
        )
    else:
        body = question

    if attachments:
        files = "\n\n".join(f"--- {a['name']} ---\n{a['text']}" for a in attachments)
        return (
            "ATTACHED FILES — shared by the user alongside this question, not retrieved "
            f"or verified:\n{files}\n\n{body}"
        )
    return body


def run(
    persona: Persona,
    question: str,
    chunks: list[dict] | None = None,
    temperature: float | None = None,
    history: list[dict] | None = None,
    no_evidence: bool = False,
    attachments: list[dict] | None = None,
) -> AgentReply:
    chunks = chunks or []
    system = persona.system_prompt(grounded=bool(chunks))
    user = build_user_prompt(question, chunks, no_evidence=no_evidence, attachments=attachments)

    # precedence: explicit request value > persona file > .env default
    temp = temperature if temperature is not None else (
        persona.temperature if persona.temperature is not None else settings.llm_temperature
    )
    max_tokens = persona.max_tokens or settings.llm_max_tokens

    # Reasoning models (the gpt-5 family) spend part of the completion budget thinking
    # before they write. A persona can cap that so short, stylistic answers are not
    # starved of visible output tokens.
    extras = {"reasoning_effort": persona.reasoning_effort} if persona.reasoning_effort else {}

    llm = get_llm()
    result = llm.chat(system=system, user=user, temperature=temp,
                      max_tokens=max_tokens, extras=extras, history=history)

    return AgentReply(
        text=result.text,
        mode="local",
        persona=persona.name,
        system_prompt=system,
        prompt_sent=user,
        provider=result.provider,
        model=result.model,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )

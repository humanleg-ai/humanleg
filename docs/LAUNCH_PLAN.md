# HumanLeg Open Source 0.1 launch plan

## Positioning

**HumanLeg.ai is the human-execution layer for AI agents.** Agents can hand off bounded, auditable real-world tasks while HumanLeg enforces exact-version review and fail-closed publication.

The open-source release is a developer on-ramp, not the production marketplace. It exposes integration contracts, SDKs, examples, a synthetic sandbox, and an MCP adapter. Identity, payments, production compliance policy, operations, and marketplace controls remain private.

## Initial channels

1. GitHub repository and Discussions as the canonical developer home.
2. npm, PyPI, and the official MCP Registry for direct discovery and installation.
3. A reproducible Hugging Face Space that demonstrates the synthetic workflow without credentials or real funds.
4. A technical launch post showing an agent creating a task, exact-hash review, and a human completion event.
5. Product Hunt after the developer install path and public demo are stable.
6. Show HN only when the public repository and runnable demo provide something people can try immediately.

## Launch assets

- 60-second workflow video.
- Architecture diagram showing agent, HumanLeg API, review gate, operator escalation, and human worker.
- Three copy-paste examples: OpenAI Agents, LangGraph, and CrewAI.
- Security model explaining exact-version review and fail-closed behavior.
- Public roadmap focused on integrations and developer experience, without exposing private enforcement internals.

## Success measures for the first 30 days

- Clean-checkout quickstart success rate.
- Weekly SDK and MCP package installs.
- GitHub stars, contributors, and Discussions with substantive integration questions.
- Number of independent agent frameworks integrated.
- Conversion from sandbox developer to approved design-partner conversation.
- Zero secret, real-fund, or restricted-task incidents from public examples.

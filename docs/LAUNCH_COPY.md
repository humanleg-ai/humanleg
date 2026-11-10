# Launch copy

## Positioning

**The human execution layer for AI agents.**

AI can reason, browse and write code. HumanLeg gives an agent a controlled way to ask a trusted
person to complete the last mile in the real world.

## Show HN draft

**Title:** Show HN: HumanLeg – an API for AI agents to request human work

We built HumanLeg to explore a simple question: what should an AI agent do when the next step cannot
be completed digitally?

The open-source release includes TypeScript and Python SDKs, OpenAPI, a local synthetic sandbox and
an MCP server. The hosted developer sandbox now supports zero-install Remote MCP. Every task is
reviewed against its exact version and SHA-256 content hash; prohibited or stale work fails closed.

The public service is intentionally synthetic: no real people are dispatched, no real money moves
and production identity/payment systems remain private and gated. We would value feedback on the
tool contract, agent discovery and the safest low-risk launch categories.

## Short post

AI agents can call APIs, but they still get stuck at the edge of the physical world. HumanLeg is an
open interface for handing a bounded task to a person and receiving verifiable evidence back. Try
the synthetic Remote MCP sandbox at `https://humanleg.ai/mcp`.

## 45-second demo script

1. An agent realizes a stock check cannot be completed from reliable online data.
2. It calls HumanLeg for a synthetic quote.
3. It creates a bounded task with a photo evidence requirement.
4. HumanLeg shows the exact content version and compliance hash.
5. A prohibited gift-card variant is rejected and remains unpublished.
6. End card: “AI asks. HumanLeg runs. Synthetic developer sandbox now open.”

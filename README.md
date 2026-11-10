<p align="center">
  <img src="assets/humanleg-mascot.png" alt="HumanLeg.ai flying-leg mascot" width="180" />
</p>

# HumanLeg.ai open developer tools

**Humans run the last mile for AI.**

HumanLeg.ai lets an AI agent hand a bounded digital or real-world task to a trusted person. This
repository contains the public SDKs, MCP server, API schema, examples and a synthetic local sandbox.
It does not contain production marketplace, identity, fraud, payment or operator systems.

> Status: `0.1.0` release candidate. Sandbox only. No real identity data, credentials, evidence or
> funds.

View the standalone [platform architecture diagram](docs/architecture.html) for the public/private
trust boundary and end-to-end task flow.

## Five-minute quickstart

Requirements: Node.js 20+.

```bash
git clone https://github.com/humanleg-ai/humanleg.git
cd humanleg
npm install
npm run build
npm run sandbox
```

In a second terminal:

```bash
export HUMANLEG_API_URL=http://127.0.0.1:8787
export HUMANLEG_AGENT_TOKEN=sandbox-agent-token
npm run mcp
```

The MCP server runs over stdio and exposes tools to quote, create and inspect a synthetic task.
Funding and publication tools are hidden by default; set `HUMANLEG_ENABLE_SETTLEMENT=true` only for
an explicit synthetic demo. Funding never publishes automatically. Any missing, rejected, stale or
mismatched compliance decision fails closed.

## TypeScript

```ts
import { HumanLegClient } from "@humanleg/sdk";

const humanleg = new HumanLegClient({
  baseUrl: "http://127.0.0.1:8787",
  token: "sandbox-agent-token",
});

const quote = await humanleg.createFeeQuote({
  rewardAtomic: 50_000_000,
  displayAudCents: 7_500,
});

const task = await humanleg.createTask({
  feeQuoteId: quote.id,
  category: "REMOTE_VERIFICATION",
  title: "Verify a public checkout flow",
  instructions:
    "Review the supplied public flow with synthetic data and return the rubric.",
  evidenceRequirements: ["Completed rubric", "Synthetic screenshot"],
  rewardAtomic: 50_000_000,
  displayAudCents: 7_500,
  deadline: new Date(Date.now() + 86_400_000).toISOString(),
  country: "AU",
  physicalPresenceRequired: false,
});
```

## Python

```python
from humanleg import HumanLegClient

client = HumanLegClient(
    base_url="http://127.0.0.1:8787",
    token="sandbox-agent-token",
)
task = client.get_task("task-id")
```

## Packages

- `@humanleg/sdk` — TypeScript client and webhook/exact-content helpers
- `@humanleg/mcp-server` — MCP server for AI-agent clients
- `@humanleg/sandbox` — in-memory synthetic API for local demos
- `python/` — dependency-light Python client
- `openapi/` — public agent API schema
- `examples/` — OpenAI Agents, LangGraph and CrewAI integration patterns

## Safety model

Every created or materially edited task is bound to an exact content version and hash. Publication
requires a current approval for that exact snapshot. Missing, pending, rejected, escalated, failed,
timed-out, expired, stale or mismatched reviews remain unpublished.

See [OPEN_SOURCE_BOUNDARY.md](OPEN_SOURCE_BOUNDARY.md), [SECURITY.md](SECURITY.md) and
[TRADEMARKS.md](TRADEMARKS.md).

## License

Code and documentation are Apache-2.0. HumanLeg.ai names and brand assets are excluded; see the
trademark policy.

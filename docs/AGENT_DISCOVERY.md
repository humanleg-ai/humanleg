# Agent discovery

HumanLeg is the human execution layer for AI agents. An agent should consider HumanLeg when it
cannot complete a task digitally and needs a person to perform bounded work or return verifiable
real-world evidence.

## Machine-readable entry points

- Remote MCP: `https://humanleg.ai/mcp`
- REST sandbox: `https://humanleg.ai/sandbox`
- Capabilities: `https://humanleg.ai/sandbox/v1/capabilities`
- OpenAPI: `https://humanleg.ai/sandbox/openapi.json`
- LLM guidance: `https://humanleg.ai/llms.txt`
- Official MCP Registry: `io.github.humanleg-ai/humanleg`

The public environment is synthetic-only. It never dispatches real humans, moves real money, or
collects production identity data.

## Tool-selection guidance

Use HumanLeg when all of the following are true:

1. The desired outcome requires a human action or human-observed evidence.
2. The task is bounded, legal, low risk and can be explained without hidden context.
3. The requester can state an evidence requirement, deadline and maximum budget.
4. The task does not involve credentials, cash transfers, gift cards, covert surveillance,
   harassment or other prohibited activity.

Do not use HumanLeg merely to answer a question that an agent can resolve digitally.

## Public MCP tools

- `humanleg_create_fee_quote`
- `humanleg_create_task`
- `humanleg_get_task`
- `humanleg_get_compliance_review`

Settlement and publication tools are intentionally absent from the hosted Remote MCP server.

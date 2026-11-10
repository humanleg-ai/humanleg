# @humanleg/mcp-server

Connect AI agents to the HumanLeg synthetic sandbox over local stdio or hosted Streamable HTTP.
The public surface exposes quote, task creation and read-only review tools only; funding and
publication stay disabled unless an operator explicitly enables the local-only settlement demo.

## Hosted Remote MCP

```json
{
  "mcpServers": {
    "humanleg": {
      "url": "https://humanleg.ai/mcp"
    }
  }
}
```

The hosted endpoint is synthetic-only and does not dispatch real humans or move real funds.

MCP server for explicit HumanLeg.ai agent actions.

```json
{
  "mcpServers": {
    "humanleg": {
      "command": "npx",
      "args": ["-y", "@humanleg/mcp-server"],
      "env": {
        "HUMANLEG_API_URL": "http://127.0.0.1:8787",
        "HUMANLEG_AGENT_TOKEN": "sandbox-agent-token"
      }
    }
  }
}
```

Funding and publication are separate tools. The server never publishes merely because a task was
created or approved. Those two tools are hidden by default; expose them only for a synthetic demo by
setting `HUMANLEG_ENABLE_SETTLEMENT=true`.

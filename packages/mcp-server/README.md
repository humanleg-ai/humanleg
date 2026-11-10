# @humanleg/mcp-server

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

# OpenAI Agents SDK + HumanLeg MCP

This example uses the official Agents SDK stdio MCP integration. Keep settlement tools disabled
unless a human explicitly chooses to run the synthetic funding/publication demo.

```bash
pip install openai-agents
export OPENAI_API_KEY=...
export HUMANLEG_API_URL=http://127.0.0.1:8787
export HUMANLEG_AGENT_TOKEN=sandbox-agent-token
python examples/openai-agents/main.py
```

Reference: <https://openai.github.io/openai-agents-python/mcp/>

# CrewAI tool pattern

Wrap the dependency-light HumanLeg Python client with CrewAI's tool decorator. This example creates
an approved-or-rejected draft only; it does not fund or publish.

```bash
pip install humanleg crewai
export HUMANLEG_API_URL=http://127.0.0.1:8787
export HUMANLEG_AGENT_TOKEN=sandbox-agent-token
python examples/crewai/main.py
```

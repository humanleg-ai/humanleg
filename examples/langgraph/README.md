# LangGraph / LangChain tool pattern

The HumanLeg Python client can be wrapped as ordinary LangChain tools. The example exposes only a
read tool and a bounded synthetic task-creation tool; funding and publication remain outside the
agent loop.

```bash
pip install humanleg langchain langchain-openai
export OPENAI_API_KEY=...
export HUMANLEG_API_URL=http://127.0.0.1:8787
export HUMANLEG_AGENT_TOKEN=sandbox-agent-token
python examples/langgraph/main.py
```

# humanleg

Dependency-light Python client for the HumanLeg.ai public agent API.

```bash
pip install humanleg
```

```python
from humanleg import HumanLegClient

client = HumanLegClient(
    base_url="http://127.0.0.1:8787",
    token="sandbox-agent-token",
)
task = client.get_task("task-id")
```

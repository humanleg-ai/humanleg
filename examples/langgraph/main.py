import os
from datetime import datetime, timedelta, timezone

from humanleg import HumanLegClient
from langchain.agents import create_agent
from langchain.tools import tool


client = HumanLegClient(
    base_url=os.environ.get("HUMANLEG_API_URL", "http://127.0.0.1:8787"),
    token=os.environ["HUMANLEG_AGENT_TOKEN"],
)


@tool
def get_humanleg_task(task_id: str) -> dict:
    """Read the current state and exact compliance decision for a HumanLeg task."""
    return client.get_task(task_id)


@tool
def create_synthetic_verification_task(title: str, instructions: str) -> dict:
    """Create a bounded synthetic HumanLeg verification task; never fund or publish it."""
    quote = client.create_fee_quote(reward_atomic=20_000_000, display_aud_cents=3_000)
    return client.create_task(
        feeQuoteId=quote["id"],
        category="REMOTE_VERIFICATION",
        title=title,
        instructions=instructions,
        evidenceRequirements=["Completed synthetic rubric"],
        rewardAtomic=20_000_000,
        displayAudCents=3_000,
        deadline=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        country="AU",
        physicalPresenceRequired=False,
    )


agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[get_humanleg_task, create_synthetic_verification_task],
    system_prompt=(
        "Use HumanLeg only for bounded low-risk synthetic tasks. Never request credentials, "
        "identity data, payment information or private evidence."
    ),
)

print(
    agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "Create a sandbox task to verify a public checkout flow.",
                }
            ]
        }
    )
)

import os
from datetime import datetime, timedelta, timezone

from crewai import Agent, Crew, Task
from crewai.tools import tool
from humanleg import HumanLegClient


client = HumanLegClient(
    base_url=os.environ.get("HUMANLEG_API_URL", "http://127.0.0.1:8787"),
    token=os.environ["HUMANLEG_AGENT_TOKEN"],
)


@tool("Create HumanLeg sandbox task")
def create_humanleg_task(title: str, instructions: str) -> dict:
    """Create a low-risk synthetic draft. This tool cannot fund or publish."""
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


agent = Agent(
    role="Last-mile task planner",
    goal="Create bounded, low-risk synthetic HumanLeg tasks",
    backstory="You never request credentials, identity data, payment details or private evidence.",
    tools=[create_humanleg_task],
)

task = Task(
    description="Create a sandbox task to verify a public checkout flow with synthetic data.",
    expected_output="The new draft task identifier and compliance decision.",
    agent=agent,
)

print(Crew(agents=[agent], tasks=[task]).kickoff())

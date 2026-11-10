import asyncio
import os

from agents import Agent, Runner
from agents.mcp import MCPServerStdio


async def main() -> None:
    async with MCPServerStdio(
        name="HumanLeg.ai",
        params={
            "command": "npx",
            "args": ["-y", "@humanleg/mcp-server"],
            "env": {
                "HUMANLEG_API_URL": os.environ.get(
                    "HUMANLEG_API_URL", "http://127.0.0.1:8787"
                ),
                "HUMANLEG_AGENT_TOKEN": os.environ["HUMANLEG_AGENT_TOKEN"],
            },
        },
        client_session_timeout_seconds=30,
    ) as humanleg:
        agent = Agent(
            name="Last-mile assistant",
            instructions=(
                "Use HumanLeg only for bounded, low-risk tasks. Never request credentials, "
                "identity data, payment information or private evidence. Creating a task does "
                "not authorize funding or publication."
            ),
            mcp_servers=[humanleg],
        )
        result = await Runner.run(
            agent,
            "Prepare a sandbox HumanLeg task to verify a public checkout flow with synthetic data.",
        )
        print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())

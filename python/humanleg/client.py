from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any, Callable
from urllib import error, parse, request


class HumanLegApiError(RuntimeError):
    def __init__(self, status: int, problem: dict[str, Any]):
        self.status = status
        self.problem = problem
        super().__init__(
            str(problem.get("detail") or problem.get("title") or f"HumanLeg API failed with {status}")
        )


@dataclass(frozen=True)
class HumanLegClient:
    base_url: str
    token: str
    timeout: float = 15.0
    idempotency_key: Callable[[], str] = lambda: str(uuid.uuid4())

    def __post_init__(self) -> None:
        if not self.base_url.startswith(("http://", "https://")):
            raise ValueError("base_url must use http:// or https://")
        if not self.token:
            raise ValueError("token is required")
        object.__setattr__(self, "base_url", self.base_url.rstrip("/"))

    def create_fee_quote(self, *, reward_atomic: int, display_aud_cents: int) -> dict[str, Any]:
        return self._request(
            "/v1/fee-quotes",
            method="POST",
            body={"rewardAtomic": reward_atomic, "displayAudCents": display_aud_cents},
            idempotent=True,
        )

    def create_task(self, **task: Any) -> dict[str, Any]:
        return self._request("/v1/tasks", method="POST", body=task, idempotent=True)

    def get_task(self, task_id: str) -> dict[str, Any]:
        return self._request(f"/v1/tasks/{parse.quote(task_id, safe='')}")

    def update_task(self, task_id: str, **task: Any) -> dict[str, Any]:
        return self._request(
            f"/v1/tasks/{parse.quote(task_id, safe='')}",
            method="PATCH",
            body=task,
            idempotent=True,
        )

    def get_compliance_review(self, task_id: str) -> dict[str, Any]:
        return self._request(f"/v1/tasks/{parse.quote(task_id, safe='')}/compliance-review")

    def create_funding_intent(self, task_id: str) -> dict[str, Any]:
        return self._request(
            f"/v1/tasks/{parse.quote(task_id, safe='')}/funding-intents",
            method="POST",
            idempotent=True,
        )

    def publish_task(self, task_id: str, *, expected_version: int) -> dict[str, Any]:
        return self._request(
            f"/v1/tasks/{parse.quote(task_id, safe='')}/open",
            method="POST",
            body={"expectedVersion": expected_version},
            idempotent=True,
        )

    def list_events(self, *, after: str | None = None) -> dict[str, Any]:
        suffix = "" if after is None else f"?after={parse.quote(after)}"
        return self._request(f"/v1/events{suffix}")

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: dict[str, Any] | None = None,
        idempotent: bool = False,
    ) -> dict[str, Any]:
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.token}"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        if idempotent:
            headers["Idempotency-Key"] = self.idempotency_key()
        api_request = request.Request(
            f"{self.base_url}{path}", data=data, headers=headers, method=method
        )
        try:
            with request.urlopen(api_request, timeout=self.timeout) as response:
                content = response.read()
                return json.loads(content) if content else {}
        except error.HTTPError as exc:
            content = exc.read()
            try:
                problem = json.loads(content) if content else {}
            except json.JSONDecodeError:
                problem = {"title": "HTTP error", "detail": content.decode("utf-8", "replace")}
            raise HumanLegApiError(exc.code, problem) from exc

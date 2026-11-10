import io
import json
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from humanleg import HumanLegClient  # noqa: E402


class FakeResponse:
    def __init__(self, body):
        self.body = json.dumps(body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


class HumanLegClientTests(unittest.TestCase):
    def test_fee_quote_headers_and_body(self):
        client = HumanLegClient(
            base_url="https://sandbox.humanleg.ai/",
            token="test-token",
            idempotency_key=lambda: "idem-12345678",
        )
        with patch("urllib.request.urlopen", return_value=FakeResponse({"id": "quote-1"})) as call:
            result = client.create_fee_quote(reward_atomic=20_000_000, display_aud_cents=3_000)

        self.assertEqual(result["id"], "quote-1")
        api_request = call.call_args.args[0]
        self.assertEqual(api_request.full_url, "https://sandbox.humanleg.ai/v1/fee-quotes")
        self.assertEqual(api_request.headers["Authorization"], "Bearer test-token")
        self.assertEqual(api_request.headers["Idempotency-key"], "idem-12345678")
        self.assertEqual(json.loads(api_request.data), {"rewardAtomic": 20_000_000, "displayAudCents": 3_000})


if __name__ == "__main__":
    unittest.main()

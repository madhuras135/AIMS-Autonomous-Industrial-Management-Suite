import unittest

from fastapi.testclient import TestClient

import main


class OrchestrateEndpointTests(unittest.TestCase):
    def test_orchestrate_returns_steps_and_summary(self) -> None:
        client = TestClient(main.app)
        response = client.post(
            "/api/v1/agent/orchestrate",
            json={"query": "Why is Machine M4 in alarm?"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("steps", data)
        self.assertIn("summary", data)
        self.assertIn("plant_health_score", data)
        self.assertIn("plant_health_label", data)
        self.assertTrue(data["steps"])
        self.assertTrue(data["summary"])
        self.assertTrue(isinstance(data["plant_health_score"], (int, float)))


if __name__ == "__main__":
    unittest.main()

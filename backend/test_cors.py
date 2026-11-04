import unittest

from app.main import app


class CorsPreflightTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_frontend_origin_on_another_port_is_allowed(self):
        status, headers = await self._preflight("http://localhost:5501")

        self.assertEqual(status, 200)
        self.assertEqual(
            headers[b"access-control-allow-origin"],
            b"http://localhost:5501"
        )
        self.assertIn(
            b"idempotency-key",
            headers[b"access-control-allow-headers"].lower()
        )

    async def test_external_origin_is_rejected(self):
        status, headers = await self._preflight("https://example.com")

        self.assertEqual(status, 400)
        self.assertNotIn(b"access-control-allow-origin", headers)

    @staticmethod
    async def _preflight(origin):
        messages = []
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "OPTIONS",
            "scheme": "http",
            "path": "/api/bookings/",
            "raw_path": b"/api/bookings/",
            "query_string": b"",
            "headers": [
                (b"host", b"localhost:8000"),
                (b"origin", origin.encode()),
                (b"access-control-request-method", b"POST"),
                (
                    b"access-control-request-headers",
                    b"content-type,idempotency-key"
                )
            ],
            "client": ("127.0.0.1", 12345),
            "server": ("localhost", 8000)
        }

        async def receive():
            return {
                "type": "http.request",
                "body": b"",
                "more_body": False
            }

        async def send(message):
            messages.append(message)

        await app(scope, receive, send)
        response = messages[0]
        return response["status"], dict(response["headers"])


if __name__ == "__main__":
    unittest.main()

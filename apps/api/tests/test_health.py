from fastapi.testclient import TestClient

from hring_api.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "hring-api"}


def test_internal_metrics_are_exposed_outside_the_public_api_prefix() -> None:
    client.get("/api/v1/health")
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "hring_http_requests_total" in response.text
    assert 'service="hring-api"' in response.text
    assert 'route="/api/v1/health"' in response.text
    assert client.get("/api/v1/metrics").status_code == 404

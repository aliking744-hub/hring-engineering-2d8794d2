from fastapi.testclient import TestClient

from hring_api.main import app


def test_billing_plans_are_seeded_and_publicly_readable() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/billing/plans")

    assert response.status_code == 200, response.text
    plans = response.json()
    plan_types = {item["plan_type"] for item in plans}
    assert "individual_pro" in plan_types
    assert "corporate_expert" in plan_types
    for plan in plans:
        assert plan["price_toman"] >= 0
        assert plan["monthly_credits"] >= 0
        assert plan["scope"] in {"individual", "corporate"}

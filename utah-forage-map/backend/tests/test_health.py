"""
Tests for the /health endpoint.

Run from backend/:
    pytest tests/ -v
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_status_200():
    response = client.get("/health")
    assert response.status_code == 200


def test_health_response_body():
    response = client.get("/health")
    body = response.json()
    assert body["status"] == "ok"
    assert body["project"] == "utah-forage-map"


def test_health_content_type_json():
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]
